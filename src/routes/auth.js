import express from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '../lib/auth.js';
import { detallesConAdminEmail } from '../lib/auditoriaAdmin.js';
import { authLimiter, BCRYPT_ROUNDS } from '../lib/security.js';

const prisma = new PrismaClient();
const router = express.Router();
const resetCodes = new Map(); // key: cuentaId, value: { code, expiresAt, sentTo }

async function hasPendingFirstPasswordChange(cuentaId) {
  const required = await prisma.auditoria.findFirst({
    where: { accion: 'auth_force_password_change_required', entidad: 'cuenta', entidadId: cuentaId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!required) return false;
  const completed = await prisma.auditoria.findFirst({
    where: {
      accion: 'auth_password_changed_first_login',
      entidad: 'cuenta',
      entidadId: cuentaId,
      createdAt: { gt: required.createdAt },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return !completed;
}

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    connectionTimeout: 15000,
    socketTimeout: 30000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_APP_PASSWORD,
    },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildRecoveryEmailHtml(code) {
  const safe = escapeHtml(code);
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F8FAFC;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(44,58,141,0.12);">
        <tr><td style="background:linear-gradient(135deg,#2C3A8D 0%,#1e2a6b 100%);padding:28px 24px;text-align:center;">
          <p style="margin:0 0 8px 0;color:#F9A121;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Tk&amp;Te Bolivia</p>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">Recuperación de contraseña</h1>
        </td></tr>
        <tr><td style="padding:28px 24px 8px 24px;">
          <p style="margin:0 0 16px 0;color:#1E293B;font-size:16px;line-height:1.5;">Usa este código para continuar en la web. <strong style="color:#64748b;">Vence en 5 minutos.</strong></p>
          <div style="text-align:center;margin:24px 0;padding:20px;background:linear-gradient(180deg,rgba(106,198,50,0.12) 0%,rgba(249,161,33,0.08) 100%);border-radius:12px;border:1px solid rgba(44,58,141,0.15);">
            <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;color:#2C3A8D;text-transform:uppercase;letter-spacing:0.06em;">Tu código</p>
            <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:0.35em;color:#2C3A8D;font-family:ui-monospace,monospace;">${safe}</p>
          </div>
          <p style="margin:16px 0 0 0;color:#64748b;font-size:13px;line-height:1.5;">Si no solicitaste este correo, ignóralo. Tu cuenta sigue protegida.</p>
        </td></tr>
        <tr><td style="padding:0 24px 24px 24px;">
          <p style="margin:0;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;text-align:center;">© Tk&amp;Te Bolivia · Aprendizaje con propósito</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendRecoveryCodeEmail(toEmail, code) {
  const transporter = getTransporter();
  if (!transporter) throw new Error('SMTP no configurado');
  const html = buildRecoveryEmailHtml(code);
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Código de recuperación — Tk&Te Bolivia',
    text: `Tu código de recuperación es: ${code}. Vence en 5 minutos. Si no lo pediste, ignora este mensaje.`,
    html,
  });
}

/** Valida email + código contra resetCodes (sin consumir el código). */
async function assertValidResetCode(rawEmail, rawCodigo) {
  const email = String(rawEmail || '').trim().toLowerCase();
  const codigo = String(rawCodigo || '').trim();
  if (!email || !codigo) return { ok: false, error: 'Código inválido o expirado' };
  const cuenta = await prisma.cuenta.findFirst({
    where: { email },
    include: { usuario: true, asesora: true },
  });
  if (!cuenta) return { ok: false, error: 'Código inválido o expirado' };
  const saved = resetCodes.get(cuenta.id);
  if (!saved || saved.email !== email || saved.code !== codigo || Date.now() > saved.expiresAt) {
    return { ok: false, error: 'Código inválido o expirado' };
  }
  return { ok: true, cuenta };
}

router.post('/login', authLimiter, async (req, res) => {
  const { identificador, email, password } = req.body || {};
  const rawId = String(identificador || email || '').trim();
  if (!rawId || !password) {
    return res.status(400).json({ error: 'Email/celular y contraseña requeridos' });
  }
  const normalizedEmail = rawId.toLowerCase();
  const cuenta = await prisma.cuenta.findFirst({
    where: {
      activo: true,
      OR: [
        { email: normalizedEmail },
        { usuario: { celular: rawId } },
        { asesora: { celular: rawId } },
      ],
    },
    include: {
      usuario: { include: { plan: true } },
      asesora: { include: { planesAsesora: { include: { plan: true } } } },
    },
  });
  if (!cuenta || !(await bcrypt.compare(password, cuenta.passwordHash))) {
    try {
      await prisma.auditoria.create({
        data: {
          accion: 'intento_login_fallido',
          entidad: 'login',
          entidadId: randomUUID(),
          detalles: {
            descripcion: 'Intento de acceso con credenciales incorrectas o cuenta inexistente.',
            identificadorParcial: rawId.length > 3 ? `${rawId.slice(0, 2)}…` : '—',
          },
        },
      });
    } catch (_) {
      /* no bloquear respuesta */
    }
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const payload = {
    sub: cuenta.id,
    email: cuenta.email,
    rol: cuenta.rol,
    usuarioId: cuenta.usuario?.id,
    asesoraId: cuenta.asesora?.id,
  };
  const token = signToken(payload);
  setAuthCookie(res, token);
  const mustChangePassword = await hasPendingFirstPasswordChange(cuenta.id);
  if (cuenta.rol === 'usuario' && cuenta.usuario?.id) {
    try {
      await prisma.auditoria.create({
        data: {
          accion: 'alumno_inicio_sesion',
          entidad: 'usuario',
          entidadId: cuenta.usuario.id,
          detalles: {
            descripcion: 'El alumno accedió al sistema (inicio de sesión correcto).',
            userAgent: String(req.headers['user-agent'] || '').slice(0, 400),
          },
          usuarioId: cuenta.usuario.id,
        },
      });
    } catch (_) {
      /* no bloquear login */
    }
  }
  res.json({
    token,
    rol: cuenta.rol,
    mustChangePassword,
    usuario: cuenta.usuario ? { id: cuenta.usuario.id, nombre: cuenta.usuario.nombre, apellidos: cuenta.usuario.apellidos, plan: cuenta.usuario.plan } : null,
    asesora: cuenta.asesora ? { id: cuenta.asesora.id, nombre: cuenta.asesora.nombre, apellidos: cuenta.asesora.apellidos } : null,
  });
});

router.post('/recuperar-password/enviar-codigo', authLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'El gmail es obligatorio' });
    const cuenta = await prisma.cuenta.findFirst({
      where: {
        email,
      },
      include: { usuario: true, asesora: true },
    });

    // Mensaje neutro para no filtrar existencia.
    if (!cuenta) return res.json({ ok: true, message: 'Si existe una cuenta, se envio un codigo al correo registrado.' });
    if (!cuenta.email || !cuenta.email.includes('@')) {
      return res.status(400).json({ error: 'Esta cuenta no tiene un gmail valido para recuperar contraseña.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 5 * 60 * 1000;
    resetCodes.set(cuenta.id, { code, expiresAt, sentTo: cuenta.email, email });

    try {
      await sendRecoveryCodeEmail(cuenta.email, code);
    } catch (_e) {
      return res.status(500).json({ error: 'No se pudo enviar el correo. Verifica la configuracion SMTP.' });
    }

    return res.json({ ok: true, message: 'Codigo enviado al correo registrado (vigente 5 minutos).' });
  } catch (e) {
    console.error('[recuperar-password/enviar-codigo]', e);
    return res.status(500).json({ error: 'Error interno al procesar la solicitud.' });
  }
});

router.post('/recuperar-password/verificar-codigo', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const codigo = String(req.body?.codigo || '').trim();
  const v = await assertValidResetCode(email, codigo);
  if (!v.ok) return res.status(400).json({ error: v.error });
  return res.json({ ok: true });
});

router.post('/recuperar-password/confirmar', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const codigo = String(req.body?.codigo || '').trim();
  const nuevaPassword = String(req.body?.nuevaPassword || '');
  if (!email || !codigo || !nuevaPassword) {
    return res.status(400).json({ error: 'Gmail, codigo y nueva contraseña son obligatorios' });
  }
  if (nuevaPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  const v = await assertValidResetCode(email, codigo);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const cuenta = v.cuenta;

  const passwordHash = await bcrypt.hash(nuevaPassword, BCRYPT_ROUNDS);
  await prisma.cuenta.update({ where: { id: cuenta.id }, data: { passwordHash } });
  resetCodes.delete(cuenta.id);

  const adminRecId = cuenta.rol === 'administrador' ? cuenta.id : null;
  await prisma.auditoria.create({
    data: {
      accion: 'auth_recuperacion_password',
      entidad: 'cuenta',
      entidadId: cuenta.id,
      detalles: await detallesConAdminEmail(prisma, adminRecId, {
        descripcion: 'Restablecimiento de contraseña con el código enviado por correo (válido unos minutos).',
        via: 'codigo_email_5min',
      }),
      usuarioId: cuenta.usuario?.id || null,
      asesoraId: cuenta.asesora?.id || null,
      adminId: adminRecId,
    },
  });

  return res.json({ ok: true, message: 'Contraseña actualizada correctamente.' });
});

router.post('/logout', (_, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.post('/cambiar-password-inicial', requireAuth(), async (req, res) => {
  const cuentaId = req.auth.sub;
  const nuevaPassword = String(req.body?.nuevaPassword || '');
  if (nuevaPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  const pending = await hasPendingFirstPasswordChange(cuentaId);
  if (!pending) return res.json({ ok: true, message: 'No tienes cambio inicial pendiente.' });

  const passwordHash = await bcrypt.hash(nuevaPassword, BCRYPT_ROUNDS);
  await prisma.cuenta.update({ where: { id: cuentaId }, data: { passwordHash } });
  const adminPwdId = req.auth.rol === 'administrador' ? cuentaId : null;
  await prisma.auditoria.create({
    data: {
      accion: 'auth_password_changed_first_login',
      entidad: 'cuenta',
      entidadId: cuentaId,
      detalles: await detallesConAdminEmail(prisma, adminPwdId, {
        descripcion: 'Cambio de contraseña obligatorio completado en el primer acceso.',
        ok: true,
      }),
      adminId: adminPwdId,
      usuarioId: req.auth.usuarioId || null,
      asesoraId: req.auth.asesoraId || null,
    },
  });
  res.json({ ok: true });
});

router.get('/me', requireAuth(), async (req, res) => {
  const cuenta = await prisma.cuenta.findUnique({
    where: { id: req.auth.sub },
    include: {
      usuario: { include: { plan: true } },
      asesora: { include: { planesAsesora: { include: { plan: true } } } },
    },
  });
  if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });
  const mustChangePassword = await hasPendingFirstPasswordChange(cuenta.id);
  const nombre =
    cuenta.usuario?.nombre ?? cuenta.asesora?.nombre ?? cuenta.nombre ?? null;
  const apellidos =
    cuenta.usuario?.apellidos ?? cuenta.asesora?.apellidos ?? cuenta.apellidos ?? null;
  const celular =
    cuenta.usuario?.celular ?? cuenta.asesora?.celular ?? cuenta.celular ?? null;
  res.json({
    id: cuenta.id,
    email: cuenta.email,
    rol: cuenta.rol,
    mustChangePassword,
    nombre,
    apellidos,
    celular,
    usuario: cuenta.usuario,
    asesora: cuenta.asesora,
  });
});

export { router as authRouter };
