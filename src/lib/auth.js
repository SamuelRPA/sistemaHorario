import jwt from 'jsonwebtoken';

/** En producción debe definirse JWT_SECRET (≥32 caracteres aleatorios). Ver assertProductionSecurity(). */
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion';
const COOKIE_NAME = 'sistema_horario_token';

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req) {
  const cookie = req.cookies?.[COOKIE_NAME];
  if (cookie) return cookie;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function cookieFlags() {
  if (process.env.COOKIE_CROSS_SITE === '1') {
    return { sameSite: 'none', secure: true };
  }
  return {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

export function setAuthCookie(res, token, maxAge = 7 * 24 * 60 * 60 * 1000) {
  const { sameSite, secure } = cookieFlags();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge,
  });
}

export function clearAuthCookie(res) {
  const { sameSite, secure } = cookieFlags();
  res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true, sameSite, secure });
}

/** Middleware: requiere estar logueado y opcionalmente un rol */
export function requireAuth(roles = []) {
  return (req, res, next) => {
    const token = getTokenFromRequest(req);
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (roles.length && !roles.includes(payload.rol)) {
      return res.status(403).json({ error: 'Rol no permitido' });
    }
    req.auth = payload;
    next();
  };
}
