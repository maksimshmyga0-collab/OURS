import express from 'express';
import https from 'https';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';
  const SUPABASE_TARGET = process.env.VITE_SUPABASE_URL || 'https://dcaryfwvjattucxbckgw.supabase.co';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
  const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

  // Supabase same-origin stream proxy to securely route API requests without CORS issues
  app.use('/supabase-api', (req, res) => {
    const targetUrl = new URL(req.url, SUPABASE_TARGET);

    const headers: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue;
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'host' || lowerKey === 'connection') continue;
      headers[key] = value;
    }
    headers['host'] = new URL(SUPABASE_TARGET).host;

    // Use publishable anon key for client requests; fallback to secret key if no publishable key configured
    const clientKey = req.headers['apikey'];
    const effectiveKey = (typeof clientKey === 'string' && (clientKey.startsWith('sb_publishable_') || clientKey.startsWith('eyJ')))
      ? clientKey
      : (SUPABASE_ANON_KEY || SUPABASE_SECRET_KEY);

    if (effectiveKey) {
      headers['apikey'] = effectiveKey;
    }

    const proxyReq = https.request(
      targetUrl,
      {
        method: req.method,
        headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error('[Supabase Stream Proxy Error]:', err);
      if (!res.headersSent) {
        res.status(502).json({ error: err.message || 'Supabase proxy error' });
      }
    });

    req.pipe(proxyReq);
  });

  app.use(express.json({ limit: '10mb' }));

  // --------------------------------------------------------------------------
  // YooKassa Payment & Verification Endpoints
  // --------------------------------------------------------------------------
  const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
  const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';

  // Helper to securely activate LOVELY / Premium in Supabase database
  async function markPairAsLovely(pairId: string): Promise<boolean> {
    if (!pairId) return false;
    try {
      const nowIso = new Date().toISOString();
      const authKey = SUPABASE_SECRET_KEY || SUPABASE_ANON_KEY;
      if (!authKey) {
        console.warn('[YooKassa] No Supabase key configured to update pair');
        return false;
      }
      const res = await fetch(`${SUPABASE_TARGET}/rest/v1/pairs?id=eq.${encodeURIComponent(pairId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': authKey,
          'Authorization': `Bearer ${authKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          is_lovely: true,
          lovely_purchased_at: nowIso,
          subscription: 'premium',
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[YooKassa] Supabase update failed:', errText);
        return false;
      }

      console.log(`[YooKassa] Successfully activated LOVELY Premium for pair: ${pairId}`);
      return true;
    } catch (err) {
      console.error('[YooKassa] Exception updating pair in Supabase:', err);
      return false;
    }
  }

  // 1. Create YooKassa Payment
  app.post('/api/yookassa/create-payment', async (req, res) => {
    try {
      const { pairId, returnUrl } = req.body;
      if (!pairId) {
        return res.status(400).json({ success: false, error: 'pairId is required' });
      }

      if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
        return res.status(503).json({
          success: false,
          error: 'YOOKASSA_NOT_CONFIGURED',
          message: 'YooKassa credentials (YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY) are not configured on the server.',
        });
      }

      const idempotenceKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'yk-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

      const defaultReturnUrl = returnUrl || `${req.headers.origin || 'http://localhost:3000'}/?payment=return&pairId=${encodeURIComponent(pairId)}`;

      const paymentPayload = {
        amount: {
          value: '199.00',
          currency: 'RUB',
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: defaultReturnUrl,
        },
        description: 'OURS LOVELY — Доступ для пары (2 устройства)',
        metadata: {
          pairId,
        },
      };

      const authHeader = 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

      const ykRes = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'Idempotence-Key': idempotenceKey,
        },
        body: JSON.stringify(paymentPayload),
      });

      const ykData: any = await ykRes.json();

      if (!ykRes.ok || !ykData.id) {
        console.error('[YooKassa] Create payment failed:', ykData);
        return res.status(ykRes.status || 500).json({
          success: false,
          error: ykData.description || 'Ошибка создания платежа в YooKassa',
          details: ykData,
        });
      }

      return res.json({
        success: true,
        paymentId: ykData.id,
        status: ykData.status,
        confirmationUrl: ykData.confirmation?.confirmation_url,
      });
    } catch (err: any) {
      console.error('[YooKassa] Exception creating payment:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // 2. YooKassa Webhook Endpoint
  app.post('/api/yookassa/webhook', async (req, res) => {
    try {
      const event = req.body;
      const paymentObj = event?.object;

      if (event?.event === 'payment.succeeded' && paymentObj?.id) {
        if (YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY) {
          const authHeader = 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');
          const verifyRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentObj.id}`, {
            headers: { 'Authorization': authHeader },
          });
          const verifiedData: any = await verifyRes.json();
          if (verifiedData?.status === 'succeeded') {
            const pairId = verifiedData.metadata?.pairId || paymentObj.metadata?.pairId;
            if (pairId) {
              await markPairAsLovely(pairId);
            }
          }
        } else {
          const pairId = paymentObj.metadata?.pairId;
          if (pairId) {
            await markPairAsLovely(pairId);
          }
        }
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[YooKassa Webhook] Error:', err);
      return res.status(200).json({ success: false });
    }
  });

  // 3. YooKassa Status Check Endpoint
  app.get('/api/yookassa/check-status/:paymentId', async (req, res) => {
    try {
      const { paymentId } = req.params;
      if (!paymentId) {
        return res.status(400).json({ success: false, error: 'paymentId is required' });
      }

      if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
        return res.status(503).json({
          success: false,
          error: 'YOOKASSA_NOT_CONFIGURED',
        });
      }

      const authHeader = 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');
      const ykRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
        headers: { 'Authorization': authHeader },
      });
      const ykData: any = await ykRes.json();

      if (ykData?.status === 'succeeded') {
        const pairId = ykData.metadata?.pairId;
        if (pairId) {
          await markPairAsLovely(pairId);
        }
        return res.json({ success: true, status: 'succeeded', isLovely: true });
      }

      return res.json({ success: true, status: ykData?.status || 'pending', isLovely: false });
    } catch (err: any) {
      console.error('[YooKassa Check Status] Error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'OURS — Backend API & YooKassa Service',
      yookassaConfigured: Boolean(YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY),
      timestamp: new Date().toISOString()
    });
  });

  // --------------------------------------------------------------------------
  // Vite Middleware (Dev) or Static Assets (Prod)
  // --------------------------------------------------------------------------
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OURS] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
