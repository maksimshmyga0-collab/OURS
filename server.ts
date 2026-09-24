import express from 'express';
import https from 'https';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Supabase same-origin stream proxy to eliminate browser CORS/blocking issues in Preview
  app.use('/supabase-api', (req, res) => {
    const targetUrl = new URL(req.url, 'https://dcaryfwvjattucxbckgw.supabase.co');

    const headers: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue;
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'host' || lowerKey === 'connection') continue;
      headers[key] = value;
    }
    headers['host'] = 'dcaryfwvjattucxbckgw.supabase.co';

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
