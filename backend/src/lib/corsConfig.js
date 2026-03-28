/**
 * CORS: en desarrollo permite cualquier origen (Vite proxy). En producción usa CORS_ORIGIN.
 * Ejemplo: CORS_ORIGIN=https://app.ejemplo.com
 * Varios orígenes: CORS_ORIGIN=https://a.com,https://b.com
 */
export function corsOptions() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || !String(raw).trim()) {
    return { origin: true, credentials: true };
  }
  const list = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    origin: list.length === 1 ? list[0] : list,
    credentials: true,
    maxAge: 86400,
  };
}
