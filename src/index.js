import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'express-async-errors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { authRouter } from './routes/auth.js';
import { usuarioRouter } from './routes/usuario.js';
import { asesoraRouter } from './routes/asesora.js';
import { adminRouter } from './routes/admin.js';
import { corsOptions } from './lib/corsConfig.js';
import { assertProductionSecurity, apiLimiter, helmetMiddleware } from './lib/security.js';

assertProductionSecurity();

const app = express();

function looksTechnicalMessage(msg) {
  const s = String(msg || '').toLowerCase();
  return (
    s.includes('prisma') ||
    s.includes('stack') ||
    s.includes('syntaxerror') ||
    s.includes('unexpected token') ||
    s.includes('transaction') ||
    s.includes('sql') ||
    /p\d{4}/i.test(s)
  );
}

function friendlyMessageByStatus(status) {
  if (status === 400) return 'La información enviada no es válida. Revisa los datos e inténtalo de nuevo.';
  if (status === 401) return 'Tu sesión no es válida o expiró. Vuelve a iniciar sesión.';
  if (status === 403) return 'No tienes permisos para realizar esta acción.';
  if (status === 404) return 'No encontramos lo que estás buscando.';
  if (status === 409) return 'No pudimos completar la operación por un conflicto de datos.';
  if (status === 429) return 'Realizaste demasiadas solicitudes. Espera un momento e inténtalo otra vez.';
  if (status >= 500) return 'Ocurrió un problema temporal en el servidor. Intenta nuevamente en unos minutos.';
  return 'No pudimos procesar tu solicitud. Intenta de nuevo.';
}
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
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    const status = res.statusCode || 200;
    if (payload && typeof payload === 'object' && typeof payload.error === 'string') {
      const shouldSanitize = status >= 500 || looksTechnicalMessage(payload.error);
      if (shouldSanitize) {
        return originalJson({ ...payload, error: friendlyMessageByStatus(status) });
      }
    }
    return originalJson(payload);
  };
  next();
});

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
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'La solicitud tiene un formato inválido. Revisa los datos enviados.',
    });
  }
  const status = Number(err?.status) || 500;
  if (status >= 500) {
    console.error('[API ERROR]', err);
  }
  return res.status(status).json({ error: friendlyMessageByStatus(status) });
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
