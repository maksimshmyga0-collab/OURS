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
  const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  // Supabase same-origin stream proxy to securely forward requests without exposing secret key to browser
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

    if (SUPABASE_KEY) {
      headers['apikey'] = SUPABASE_KEY;
      const clientAuth = req.headers['authorization'];
      // If client auth is missing or using placeholder key, provide server key bearer for public endpoints like signup
      if (!clientAuth || clientAuth.includes('public-anon-key') || clientAuth.includes('placeholder')) {
        headers['authorization'] = `Bearer ${SUPABASE_KEY}`;
      }
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

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'OURS — Direct Supabase Integration', timestamp: new Date().toISOString() });
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
