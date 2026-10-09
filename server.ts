import express from 'express';
import https from 'https';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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

    // Use publishable anon key for client requests; NEVER leak or inject secret key to client proxy
    const clientKey = req.headers['apikey'];
    const effectiveKey = (typeof clientKey === 'string' && (clientKey.startsWith('sb_publishable_') || clientKey.startsWith('eyJ')))
      ? clientKey
      : SUPABASE_ANON_KEY;

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
  // Photo Storage Upload Endpoint (Uses Server Service Role Key to upload to ours-photos)
  // --------------------------------------------------------------------------
  // In-memory sliding rate limiter: max 20 uploads per minute per user
  const uploadRateLimitMap = new Map<string, { count: number; resetAt: number }>();

  // --------------------------------------------------------------------------
  // Photo Storage Upload Endpoint (Protected by Supabase Auth + Pair Membership)
  // --------------------------------------------------------------------------
  app.post('/api/storage/upload-photo', async (req, res) => {
    try {
      const { pairId, momentId, photoData } = req.body;
      const cleanPairId = typeof pairId === 'string' ? pairId.trim() : '';
      const cleanMomentId = typeof momentId === 'string' ? momentId.trim() : '';

      if (!cleanPairId || !isValidPairId(cleanPairId)) {
        return res.status(400).json({ success: false, error: 'Valid pairId is required' });
      }

      if (!cleanMomentId || !/^[0-9a-zA-Z_-]{4,64}$/.test(cleanMomentId)) {
        return res.status(400).json({ success: false, error: 'Valid momentId is required' });
      }

      if (!photoData || typeof photoData !== 'string') {
        return res.status(400).json({ success: false, error: 'photoData is required' });
      }

      // If photoData is already a remote public URL, return as-is
      if (photoData.startsWith('http://') || photoData.startsWith('https://')) {
        return res.json({ success: true, url: photoData });
      }

      // 1. Mandatory Supabase Authentication & Pair Membership Verification
      const authHeader = req.headers['authorization'];
      const membership = await verifyUserPairMembership(authHeader, cleanPairId);
      if (!membership.authorized || !membership.userId) {
        return res.status(membership.status || 401).json({
          success: false,
          error: membership.error || 'Unauthorized: Valid Supabase session belonging to this pair is required',
        });
      }

      const verifiedUserId = membership.userId;

      // 2. Sliding window rate limit: max 20 photo uploads per minute per authenticated user
      const nowMs = Date.now();
      const rateInfo = uploadRateLimitMap.get(verifiedUserId) || { count: 0, resetAt: nowMs + 60000 };
      if (nowMs > rateInfo.resetAt) {
        rateInfo.count = 0;
        rateInfo.resetAt = nowMs + 60000;
      }
      rateInfo.count += 1;
      uploadRateLimitMap.set(verifiedUserId, rateInfo);

      if (rateInfo.count > 20) {
        return res.status(429).json({ success: false, error: 'Слишком много запросов. Подождите минуту.' });
      }

      // 3. Payload size check (max ~6MB base64 string = ~4.5MB binary image)
      if (photoData.length > 7 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: 'Размер фото превышает допустимый лимит (5 MB)' });
      }

      if (!SUPABASE_SECRET_KEY) {
        // Fallback: return photoData (data URI) directly if server key not present
        return res.json({ success: true, url: photoData });
      }

      // 4. Validate and decode data URI
      let buffer: Buffer;
      let contentType = 'image/jpeg';
      let ext = 'jpg';

      if (photoData.startsWith('data:')) {
        const matches = photoData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const rawMime = matches[1].toLowerCase();
          // Strictly restrict allowed MIME types
          if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(rawMime)) {
            return res.status(400).json({ success: false, error: 'Недопустимый формат изображения. Разрешены JPEG, PNG, WEBP.' });
          }

          contentType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
          buffer = Buffer.from(matches[2], 'base64');
          if (contentType.includes('png')) ext = 'png';
          if (contentType.includes('webp')) ext = 'webp';
        } else {
          return res.status(400).json({ success: false, error: 'Некорректный формат Data URI' });
        }
      } else {
        return res.status(400).json({ success: false, error: 'Ожидается data URI изображения' });
      }

      // 5. Verify image magic bytes for security
      if (buffer.length < 12) {
        return res.status(400).json({ success: false, error: 'Повреждённый файл изображения' });
      }

      const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
      const isWebp = buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';

      if (!isJpeg && !isPng && !isWebp) {
        return res.status(400).json({ success: false, error: 'Сигнатура файла не соответствует разрешённым форматам изображений' });
      }

      // 6. Safe server-constructed storage path (prevents traversal and unauthorized overwrite)
      const safePair = cleanPairId.replace(/[^a-zA-Z0-9_-]/g, '');
      const safeMoment = cleanMomentId.replace(/[^a-zA-Z0-9_-]/g, '');
      const safeUser = verifiedUserId.replace(/[^a-zA-Z0-9_-]/g, '');
      const filePath = `${safePair}/${safeMoment}/${safeUser}_${Date.now()}.${ext}`;

      const adminSupabase = createClient(SUPABASE_TARGET, SUPABASE_SECRET_KEY, {
        auth: { persistSession: false },
      });

      const { error: upErr } = await adminSupabase.storage
        .from('ours-photos')
        .upload(filePath, buffer, {
          contentType,
          upsert: true,
        });

      if (upErr) {
        console.warn('[Storage Server] Supabase upload warning, returning data URI fallback:', upErr.message);
        return res.json({ success: true, url: photoData });
      }

      const { data: pubData } = adminSupabase.storage
        .from('ours-photos')
        .getPublicUrl(filePath);

      return res.json({ success: true, url: pubData.publicUrl });
    } catch (err: any) {
      console.warn('[Storage Server] Upload handler exception:', err);
      return res.json({ success: true, url: req.body?.photoData || '' });
    }
  });

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

  // Helper to authenticate user from Bearer token and verify pair membership
  async function verifyUserPairMembership(
    authHeader: string | undefined,
    pairId: string
  ): Promise<{ authorized: boolean; userId?: string; error?: string; status?: number }> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authorized: false, error: 'Authorization header with Bearer token is required', status: 401 };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return { authorized: false, error: 'Bearer token is missing', status: 401 };
    }

    const authKey = SUPABASE_SECRET_KEY || SUPABASE_ANON_KEY;
    if (!authKey) {
      return { authorized: false, error: 'Server authentication configuration error', status: 500 };
    }

    try {
      // 1. Verify user session with Supabase Auth
      const userRes = await fetch(`${SUPABASE_TARGET}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY || authKey,
        },
      });

      if (!userRes.ok) {
        return { authorized: false, error: 'Invalid or expired user session', status: 401 };
      }

      const userData: any = await userRes.json();
      const userId = userData?.id;
      if (!userId) {
        return { authorized: false, error: 'User ID could not be identified', status: 401 };
      }

      // 2. Verify user is an active member of this pair in public.pair_members
      const memberRes = await fetch(
        `${SUPABASE_TARGET}/rest/v1/pair_members?pair_id=eq.${encodeURIComponent(pairId)}&user_id=eq.${encodeURIComponent(userId)}&select=pair_id`,
        {
          headers: {
            'apikey': authKey,
            'Authorization': `Bearer ${authKey}`,
          },
        }
      );

      if (!memberRes.ok) {
        return { authorized: false, error: 'Failed to verify pair membership', status: 500 };
      }

      const memberRows: any = await memberRes.json();
      if (!Array.isArray(memberRows) || memberRows.length === 0) {
        return { authorized: false, error: 'Forbidden: You do not belong to this pair', status: 403 };
      }

      return { authorized: true, userId };
    } catch (err: any) {
      console.error('[OURS Server] Membership verification error:', err);
      return { authorized: false, error: 'Membership verification exception', status: 500 };
    }
  }

  const isValidPairId = (id: any): boolean => typeof id === 'string' && /^[0-9a-zA-Z_-]{8,64}$/.test(id.trim());

  // 1. Create YooKassa Payment - Protected: Only authenticated members of the pair can initiate payment
  app.post('/api/yookassa/create-payment', async (req, res) => {
    try {
      const { pairId, returnUrl } = req.body;
      const cleanPairId = typeof pairId === 'string' ? pairId.trim() : '';
      if (!cleanPairId || !isValidPairId(cleanPairId)) {
        return res.status(400).json({ success: false, error: 'Valid pairId is required' });
      }

      // Verify caller is an authenticated member of this pair
      const authHeader = req.headers['authorization'];
      const membership = await verifyUserPairMembership(authHeader, cleanPairId);
      if (!membership.authorized) {
        return res.status(membership.status || 403).json({
          success: false,
          error: membership.error || 'Access denied: You do not belong to this pair',
        });
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

      const defaultReturnUrl = returnUrl || `${req.headers.origin || 'http://localhost:3000'}/?payment=return&pairId=${encodeURIComponent(cleanPairId)}`;

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
          pairId: cleanPairId,
          userId: membership.userId,
        },
      };

      const authHeaderYk = 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

      const ykRes = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeaderYk,
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

  // 2. YooKassa Webhook Endpoint - Strictly verify with YooKassa API before activating Lovely
  app.post('/api/yookassa/webhook', async (req, res) => {
    try {
      const event = req.body;
      const paymentObj = event?.object;

      if (event?.event === 'payment.succeeded' && paymentObj?.id) {
        if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
          console.warn('[YooKassa Webhook] Received webhook but YooKassa keys not configured on server. Ignoring.');
          return res.status(200).json({ success: false, reason: 'unconfigured' });
        }

        const authHeader = 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');
        const verifyRes = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentObj.id)}`, {
          headers: { 'Authorization': authHeader },
        });
        const verifiedData: any = await verifyRes.json();
        if (verifiedData?.status === 'succeeded') {
          const rawPairId = verifiedData.metadata?.pairId || paymentObj.metadata?.pairId;
          const cleanPairId = typeof rawPairId === 'string' ? rawPairId.trim() : '';
          // Strictly validate UUID or pair identifier format
          if (cleanPairId && isValidPairId(cleanPairId)) {
            await markPairAsLovely(cleanPairId);
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
      if (!paymentId || !/^[0-9a-zA-Z_-]{8,64}$/.test(paymentId)) {
        return res.status(400).json({ success: false, error: 'Valid paymentId is required' });
      }

      if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
        return res.status(503).json({
          success: false,
          error: 'YOOKASSA_NOT_CONFIGURED',
        });
      }

      const authHeader = 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');
      const ykRes = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
        headers: { 'Authorization': authHeader },
      });
      const ykData: any = await ykRes.json();

      if (ykData?.status === 'succeeded') {
        const rawPairId = ykData.metadata?.pairId;
        const cleanPairId = typeof rawPairId === 'string' ? rawPairId.trim() : '';
        if (cleanPairId && isValidPairId(cleanPairId)) {
          await markPairAsLovely(cleanPairId);
        }
        return res.json({ success: true, status: 'succeeded', isLovely: true });
      }

      return res.json({ success: true, status: ykData?.status || 'pending', isLovely: false });
    } catch (err: any) {
      console.error('[YooKassa Check Status] Error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // --------------------------------------------------------------------------
  // Persistent Date Invitations REST API Endpoints
  // Backed directly by Supabase PostgreSQL (date_invitations table + moments fallback)
  // No disk JSON dependency, survives redeployments and restarts
  // --------------------------------------------------------------------------

  // 1. Get active date invitation for a pair
  app.get('/api/dates/invitation/:pairId', async (req, res) => {
    const rawPairId = req.params.pairId;
    const cleanPairId = typeof rawPairId === 'string' ? rawPairId.trim() : '';
    if (!cleanPairId || !isValidPairId(cleanPairId)) {
      return res.status(400).json({ success: false, error: 'Valid pairId is required' });
    }

    const authKey = SUPABASE_SECRET_KEY || SUPABASE_ANON_KEY;
    if (!authKey) {
      return res.status(500).json({ success: false, error: 'Database unconfigured' });
    }

    try {
      // 1. Try Supabase date_invitations table
      const dbRes = await fetch(
        `${SUPABASE_TARGET}/rest/v1/date_invitations?pair_id=eq.${encodeURIComponent(cleanPairId)}&order=created_at.desc&limit=1`,
        {
          headers: {
            'apikey': authKey,
            'Authorization': `Bearer ${authKey}`,
          },
        }
      );

      if (dbRes.ok) {
        const rows: any = await dbRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0];
          return res.json({
            success: true,
            invitation: {
              id: row.id,
              pairId: row.pair_id,
              senderUserId: row.creator_user_id,
              senderName: row.sender_name,
              recipientUserId: row.recipient_user_id,
              recipientName: row.recipient_name,
              idea: row.idea,
              status: row.status,
              readByRecipient: row.read_by_recipient,
              createdAt: row.created_at,
              respondedAt: row.responded_at,
            },
          });
        }
      }

      // 2. Fallback to Supabase moments table
      const momentRes = await fetch(
        `${SUPABASE_TARGET}/rest/v1/moments?pair_id=eq.${encodeURIComponent(cleanPairId)}&moment_date=eq.1970-01-01&order=created_at.desc&limit=1`,
        {
          headers: {
            'apikey': authKey,
            'Authorization': `Bearer ${authKey}`,
          },
        }
      );

      if (momentRes.ok) {
        const momentRows: any = await momentRes.json();
        if (Array.isArray(momentRows) && momentRows.length > 0) {
          const m = momentRows[0];
          if (m.prompt && m.prompt.startsWith('DATE_INVITATION:')) {
            try {
              const parsed = JSON.parse(m.prompt.replace('DATE_INVITATION:', ''));
              return res.json({ success: true, invitation: parsed });
            } catch {}
          }
        }
      }

      return res.json({ success: true, invitation: null });
    } catch (err: any) {
      console.error('[Date Invitations API] Error fetching invitation:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // 2. Create or update date invitation for a pair
  app.post('/api/dates/invitation', async (req, res) => {
    try {
      const { pairId, id, senderUserId, senderName, recipientUserId, recipientName, idea, status, readByRecipient } = req.body;
      const cleanPairId = typeof pairId === 'string' ? pairId.trim() : '';
      if (!cleanPairId || !isValidPairId(cleanPairId) || !idea || typeof idea !== 'object') {
        return res.status(400).json({ success: false, error: 'Valid pairId and idea object are required' });
      }

      // Validate idea fields and enforce string bounds
      const cleanIdea = {
        id: String(idea.id || '').slice(0, 50),
        title: String(idea.title || '').slice(0, 100),
        description: String(idea.description || '').slice(0, 300),
        tag: String(idea.tag || '').slice(0, 50),
      };

      if (!cleanIdea.title) {
        return res.status(400).json({ success: false, error: 'Idea title is required' });
      }

      const invId = (typeof id === 'string' && id.trim()) ? id.trim().slice(0, 80) : `inv-${Date.now()}`;
      const cleanStatus = (status === 'accepted' || status === 'declined') ? status : 'pending';
      const nowIso = new Date().toISOString();

      const invitation = {
        id: invId,
        pairId: cleanPairId,
        senderUserId: String(senderUserId || '').trim().slice(0, 64),
        senderName: String(senderName || 'Ты').trim().slice(0, 50),
        recipientUserId: String(recipientUserId || '').trim().slice(0, 64),
        recipientName: String(recipientName || 'Партнёр').trim().slice(0, 50),
        idea: cleanIdea,
        status: cleanStatus,
        readByRecipient: Boolean(readByRecipient),
        createdAt: nowIso,
      };

      const authKey = SUPABASE_SECRET_KEY || SUPABASE_ANON_KEY;
      if (!authKey) {
        return res.status(500).json({ success: false, error: 'Database unconfigured' });
      }

      // Try inserting into Supabase date_invitations table
      let savedToTable = false;
      try {
        const insertRes = await fetch(`${SUPABASE_TARGET}/rest/v1/date_invitations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': authKey,
            'Authorization': `Bearer ${authKey}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            id: invId,
            pair_id: cleanPairId,
            creator_user_id: invitation.senderUserId || null,
            sender_name: invitation.senderName,
            recipient_user_id: invitation.recipientUserId || null,
            recipient_name: invitation.recipientName,
            idea: cleanIdea,
            status: cleanStatus,
            read_by_recipient: Boolean(readByRecipient),
            created_at: nowIso,
            updated_at: nowIso,
          }),
        });
        if (insertRes.ok) {
          savedToTable = true;
        }
      } catch {}

      // Fallback: Supabase moments table
      if (!savedToTable) {
        try {
          await fetch(`${SUPABASE_TARGET}/rest/v1/moments?pair_id=eq.${encodeURIComponent(cleanPairId)}&moment_date=eq.1970-01-01`, {
            method: 'DELETE',
            headers: { 'apikey': authKey, 'Authorization': `Bearer ${authKey}` },
          });

          await fetch(`${SUPABASE_TARGET}/rest/v1/moments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': authKey,
              'Authorization': `Bearer ${authKey}`,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              pair_id: cleanPairId,
              moment_date: '1970-01-01',
              prompt: `DATE_INVITATION:${JSON.stringify(invitation)}`,
            }),
          });
        } catch {}
      }

      return res.json({ success: true, invitation });
    } catch (err: any) {
      console.error('[Date Invitations API] Error saving invitation:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // 3. Mark date invitation as read by recipient
  app.patch('/api/dates/invitation/:pairId/read', async (req, res) => {
    const rawPairId = req.params.pairId;
    const cleanPairId = typeof rawPairId === 'string' ? rawPairId.trim() : '';
    if (!cleanPairId || !isValidPairId(cleanPairId)) {
      return res.status(400).json({ success: false, error: 'Valid pairId is required' });
    }

    const authKey = SUPABASE_SECRET_KEY || SUPABASE_ANON_KEY;
    if (!authKey) {
      return res.status(500).json({ success: false, error: 'Database unconfigured' });
    }

    try {
      // 1. Update in date_invitations table
      await fetch(
        `${SUPABASE_TARGET}/rest/v1/date_invitations?pair_id=eq.${encodeURIComponent(cleanPairId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': authKey,
            'Authorization': `Bearer ${authKey}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ read_by_recipient: true, updated_at: new Date().toISOString() }),
        }
      );

      // 2. Fallback update in moments table
      const momentRes = await fetch(
        `${SUPABASE_TARGET}/rest/v1/moments?pair_id=eq.${encodeURIComponent(cleanPairId)}&moment_date=eq.1970-01-01&order=created_at.desc&limit=1`,
        {
          headers: { 'apikey': authKey, 'Authorization': `Bearer ${authKey}` },
        }
      );
      if (momentRes.ok) {
        const rows: any = await momentRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0];
          if (row.prompt && row.prompt.startsWith('DATE_INVITATION:')) {
            try {
              const parsed = JSON.parse(row.prompt.replace('DATE_INVITATION:', ''));
              parsed.readByRecipient = true;
              await fetch(`${SUPABASE_TARGET}/rest/v1/moments?id=eq.${encodeURIComponent(row.id)}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': authKey,
                  'Authorization': `Bearer ${authKey}`,
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify({ prompt: `DATE_INVITATION:${JSON.stringify(parsed)}` }),
              });
            } catch {}
          }
        }
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // 4. Accept or decline date invitation
  app.patch('/api/dates/invitation/:pairId/respond', async (req, res) => {
    const rawPairId = req.params.pairId;
    const cleanPairId = typeof rawPairId === 'string' ? rawPairId.trim() : '';
    const { status } = req.body;
    if (!cleanPairId || !isValidPairId(cleanPairId) || (status !== 'accepted' && status !== 'declined')) {
      return res.status(400).json({ success: false, error: 'Valid pairId and status (accepted|declined) are required' });
    }

    const authKey = SUPABASE_SECRET_KEY || SUPABASE_ANON_KEY;
    if (!authKey) {
      return res.status(500).json({ success: false, error: 'Database unconfigured' });
    }

    const respondedAt = new Date().toISOString();

    try {
      // 1. Update in date_invitations table
      await fetch(
        `${SUPABASE_TARGET}/rest/v1/date_invitations?pair_id=eq.${encodeURIComponent(cleanPairId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': authKey,
            'Authorization': `Bearer ${authKey}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            status,
            read_by_recipient: true,
            responded_at: respondedAt,
            updated_at: respondedAt,
          }),
        }
      );

      // 2. Fallback update in moments table
      const momentRes = await fetch(
        `${SUPABASE_TARGET}/rest/v1/moments?pair_id=eq.${encodeURIComponent(cleanPairId)}&moment_date=eq.1970-01-01&order=created_at.desc&limit=1`,
        {
          headers: { 'apikey': authKey, 'Authorization': `Bearer ${authKey}` },
        }
      );
      if (momentRes.ok) {
        const rows: any = await momentRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0];
          if (row.prompt && row.prompt.startsWith('DATE_INVITATION:')) {
            try {
              const parsed = JSON.parse(row.prompt.replace('DATE_INVITATION:', ''));
              parsed.status = status;
              parsed.readByRecipient = true;
              parsed.respondedAt = respondedAt;
              await fetch(`${SUPABASE_TARGET}/rest/v1/moments?id=eq.${encodeURIComponent(row.id)}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': authKey,
                  'Authorization': `Bearer ${authKey}`,
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify({ prompt: `DATE_INVITATION:${JSON.stringify(parsed)}` }),
              });
            } catch {}
          }
        }
      }

      return res.json({ success: true, status, respondedAt });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // 5. Delete or clear date invitation
  app.delete('/api/dates/invitation/:pairId', async (req, res) => {
    const rawPairId = req.params.pairId;
    const cleanPairId = typeof rawPairId === 'string' ? rawPairId.trim() : '';
    if (!cleanPairId || !isValidPairId(cleanPairId)) {
      return res.status(400).json({ success: false, error: 'Valid pairId is required' });
    }

    const authKey = SUPABASE_SECRET_KEY || SUPABASE_ANON_KEY;
    if (!authKey) {
      return res.status(500).json({ success: false, error: 'Database unconfigured' });
    }

    try {
      // 1. Delete from date_invitations
      await fetch(
        `${SUPABASE_TARGET}/rest/v1/date_invitations?pair_id=eq.${encodeURIComponent(cleanPairId)}`,
        {
          method: 'DELETE',
          headers: { 'apikey': authKey, 'Authorization': `Bearer ${authKey}` },
        }
      );

      // 2. Delete from moments fallback
      await fetch(
        `${SUPABASE_TARGET}/rest/v1/moments?pair_id=eq.${encodeURIComponent(cleanPairId)}&moment_date=eq.1970-01-01`,
        {
          method: 'DELETE',
          headers: { 'apikey': authKey, 'Authorization': `Bearer ${authKey}` },
        }
      );

      return res.json({ success: true });
    } catch (err: any) {
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
