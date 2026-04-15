import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { authRouter } from './routes/auth.js';
import { usuarioRouter } from './routes/usuario.js';
import { asesoraRouter } from './routes/asesora.js';
import { adminRouter } from './routes/admin.js';
import { corsOptions } from './lib/corsConfig.js';
import { assertProductionSecurity, apiLimiter, helmetMiddleware } from './lib/security.js';

assertProductionSecurity();

const app = express();
// Vite (dev) y Render / nginx envían X-Forwarded-For; express-rate-limit requiere trust proxy coherente.
if (process.env.NODE_ENV !== 'production') {
  app.set('trust proxy', 1);
} else if (process.env.TRUST_PROXY === '1' || process.env.RENDER) {
  app.set('trust proxy', 1);
}

app.use(helmetMiddleware());
app.use(cors(corsOptions()));
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

app.use('/api', apiLimiter);
app.use('/api/auth', authRouter);
app.use('/api/usuario', usuarioRouter);
app.use('/api/asesora', asesoraRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'No encontramos esa ruta de la API.' });
});

app.use((err, req, res, next) => {
  if (!req.path.startsWith('/api')) return next(err);
  const status = Number(err?.status) || 500;
  if (status >= 500) {
    console.error('[API ERROR]', err);
  }
  return res.status(status).json({
    error:
      status >= 500
        ? 'Ocurrió un problema en el servidor. Intenta nuevamente.'
        : 'No pudimos procesar tu solicitud.',
  });
});

/** En producción: sirve el build de Vite si existe (mismo origen que /api). Sin dist, solo API. */
const frontendDist =
  process.env.FRONTEND_DIST || path.join(__dirname, '..', '..', 'frontend', 'dist');
const tieneSpa = process.env.NODE_ENV === 'production' && fs.existsSync(frontendDist);
if (tieneSpa) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[app] Producción sin carpeta SPA en', frontendDist, '— solo rutas /api');
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en puerto ${PORT}`);
});
