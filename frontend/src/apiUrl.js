/**
 * Origen del API en desarrollo o front separado del backend.
 * Vacío = rutas relativas /api… (mismo host: monorepo en Render o proxy de Vite).
 *
 * Ej.: VITE_API_ORIGIN=https://sistemahorario.onrender.com
 */
const origin = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '');

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${p}` : p;
}
