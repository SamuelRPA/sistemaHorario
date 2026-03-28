/**
 * Seguridad HTTP: cabeceras, límites de frecuencia y comprobaciones de entorno.
 * Inyección SQL: Prisma usa consultas parametrizadas; no uses $queryRaw con strings concatenados.
 */
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/** bcrypt: coste computacional (OWASP recomienda ≥10; 12 es un buen equilibrio). */
export const BCRYPT_ROUNDS = 12;

export function helmetMiddleware() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

/** Límite general para todas las rutas /api (excepto si se excluye en el router). */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_API_MAX || 400),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Espera unos minutos e intenta de nuevo.' },
});

/** Rutas de autenticación (login, recuperación): más estricto contra fuerza bruta. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso. Espera unos minutos.' },
});

/**
 * En producción exige JWT_SECRET fuerte. Evita arrancar con valor por defecto.
 */
export function assertProductionSecurity() {
  if (process.env.NODE_ENV !== 'production') return;
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32) {
    console.error('[seguridad] En producción JWT_SECRET debe tener al menos 32 caracteres aleatorios.');
    process.exit(1);
  }
  const weak = ['dev-secret','cambiar','test','secret','password','123456'];
  const lower = secret.toLowerCase();
  if (weak.some((w) => lower.includes(w))) {
    console.error('[seguridad] JWT_SECRET parece débil para producción. Usa una cadena aleatoria larga.');
    process.exit(1);
  }
}
