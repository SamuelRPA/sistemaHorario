import express from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, signToken, setAuthCookie } from '../lib/auth.js';
import { PrismaClient } from '@prisma/client';
import { computeEstadoCuotas, calcMontoPorCuota } from '../lib/cuotas.js';
import { etiquetaAccionAuditoria } from '../lib/auditoriaEtiquetas.js';
import { inicioDiaBolivia, fechaHoraFinSesion } from '../lib/timezone.js';
import { lunesSemanaBolivia, esLunesBolivia, fechaClaseEnSemana } from '../lib/sustitucionSemanal.js';
import { detallesConAdminEmail, formatAdminEtiqueta } from '../lib/auditoriaAdmin.js';
import { BCRYPT_ROUNDS } from '../lib/security.js';

const prisma = new PrismaClient();
const router = express.Router();

async function resolveCuentaEmail(rawEmail, rawCelular) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (email) return email;
  const celularDigits = String(rawCelular || '').replace(/\D/g, '') || String(Date.now());
  let candidate = `cel-${celularDigits}@sin-correo.local`;
  let i = 1;
  while (await prisma.cuenta.findUnique({ where: { email: candidate } })) {
    candidate = `cel-${celularDigits}-${i}@sin-correo.local`;
    i += 1;
  }
  return candidate;
}

router.use(requireAuth(['administrador']));

/** Cuentas con rol administrador (activas), p. ej. filtros de auditoría entre varios admins. */
router.get('/administradores', async (_req, res) => {
  const administradores = await prisma.cuenta.findMany({
    where: { rol: 'administrador', activo: true },
    select: { id: true, email: true, nombre: true, apellidos: true },
    orderBy: { email: 'asc' },
  });
  res.json({ administradores });
});

/** Perfil del administrador (datos en Cuenta) */
router.get('/perfil', async (req, res) => {
  const cuenta = await prisma.cuenta.findUnique({
    where: { id: req.auth.sub },
    select: { email: true, nombre: true, apellidos: true, celular: true, rol: true },
  });
  if (!cuenta || cuenta.rol !== 'administrador') {
    return res.status(403).json({ error: 'Solo administradores' });
  }
  res.json({
    email: cuenta.email,
    nombre: cuenta.nombre ?? '',
    apellidos: cuenta.apellidos ?? '',
    celular: cuenta.celular ?? '',
  });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.patch('/perfil', async (req, res) => {
  const cuentaId = req.auth.sub;
  const cuenta = await prisma.cuenta.findUnique({
    where: { id: cuentaId },
    select: { id: true, rol: true, email: true },
  });
  if (!cuenta || cuenta.rol !== 'administrador') {
    return res.status(403).json({ error: 'Solo administradores' });
  }
  const { nombre, apellidos, celular, email } = req.body || {};
  const data = {};
  if (typeof nombre === 'string') {
    const t = nombre.trim();
    if (!t) return res.status(400).json({ error: 'El nombre es obligatorio' });
    data.nombre = t;
  }
  if (typeof apellidos === 'string') {
    const t = apellidos.trim();
    if (!t) return res.status(400).json({ error: 'Los apellidos son obligatorios' });
    data.apellidos = t;
  }
  if (celular !== undefined) {
    data.celular = celular ? String(celular).trim() : null;
  }
  let emailAnterior;
  let emailNuevo;
  if (email !== undefined) {
    if (typeof email !== 'string') return res.status(400).json({ error: 'Correo no válido' });
    const normalized = email.trim().toLowerCase();
    if (!normalized) return res.status(400).json({ error: 'El correo es obligatorio' });
    if (!EMAIL_RE.test(normalized)) return res.status(400).json({ error: 'Formato de correo no válido' });
    if (normalized !== cuenta.email) {
      const taken = await prisma.cuenta.findFirst({
        where: { email: normalized, NOT: { id: cuentaId } },
        select: { id: true },
      });
      if (taken) return res.status(409).json({ error: 'Ese correo ya está en uso por otra cuenta' });
      data.email = normalized;
      emailAnterior = cuenta.email;
      emailNuevo = normalized;
    }
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Nada que actualizar' });
  }
  try {
    await prisma.cuenta.update({ where: { id: cuentaId }, data });
  } catch (e) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'Ese correo ya está en uso por otra cuenta' });
    }
    throw e;
  }
  if (data.email) {
    const token = signToken({
      sub: cuentaId,
      email: data.email,
      rol: 'administrador',
      usuarioId: null,
      asesoraId: null,
    });
    setAuthCookie(res, token);
  }
  await prisma.auditoria.create({
    data: {
      accion: 'admin_edita_perfil',
      entidad: 'cuenta',
      entidadId: cuentaId,
      detalles: await detallesConAdminEmail(prisma, cuentaId, {
        descripcion: data.email
          ? 'El administrador actualizó su perfil (incluido el correo de inicio de sesión).'
          : 'El administrador actualizó su perfil (nombre, apellidos o celular).',
        campos: Object.keys(data),
        ...(emailAnterior && emailNuevo ? { emailAnterior, emailNuevo } : {}),
      }),
      adminId: cuentaId,
    },
  });
  res.json({ ok: true });
});

/** Listar todos los horarios (con filtro virtual/presencial) */
router.get('/horarios', async (req, res) => {
  try {
    const { modalidad } = req.query;
    const normalizarModalidad = (m) => {
      const v = String(m || '').trim().toLowerCase();
      if (v === 'online' || v === 'virtual') return 'online';
      if (v === 'presencial') return 'presencial';
      return '';
    };
    const modalidadFiltro = normalizarModalidad(modalidad);
    const horariosAll = await prisma.horario.findMany({
      include: {
        asesora: true,
        inscripciones: { where: { estado: 'activa' }, include: { usuario: { include: { plan: true } } } },
      },
    });
    const horarios = modalidadFiltro
      ? horariosAll.filter((h) => normalizarModalidad(h.modalidad) === modalidadFiltro)
      : horariosAll;
    res.json({ horarios });
  } catch (err) {
    console.error('[GET /api/admin/horarios]', err);
    res.status(500).json({ error: err.message || 'Error al cargar horarios' });
  }
});

/** Listar alumnos con búsqueda por nombre, apellidos, funciones (como asesoras). incluirMora=1 añade enMora (no pagaron en fecha). */
router.get('/alumnos', async (req, res) => {
  try {
    const { busqueda, funciones: funcionesQuery, incluirMora } = req.query;
    const include = { plan: true };
    if (incluirMora === '1') include.mensualidades = true;
    const usuarios = await prisma.usuario.findMany({
      include,
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
    });
    let result = usuarios.map((u) => {
      const funciones = u.funciones && Array.isArray(u.funciones) ? u.funciones : (u.funciones && typeof u.funciones === 'object' ? Object.values(u.funciones) : []);
      const item = { ...u, funciones };
      if (incluirMora === '1' && u.mensualidades) {
        const estado = computeEstadoCuotas(u, u.mensualidades);
        item.pagadoEsteMes = estado.pagadoEsteMes;
        item.pagadoAlDia = estado.pagadoAlDia;
        item.enMora = estado.enMora;
        delete item.mensualidades;
      }
      return item;
    });
    if (busqueda && String(busqueda).trim()) {
      const term = String(busqueda).trim().toLowerCase();
      result = result.filter((u) =>
        u.nombre.toLowerCase().includes(term) || u.apellidos.toLowerCase().includes(term)
      );
    }
    if (funcionesQuery) {
      const list = String(funcionesQuery).split(',').map((f) => f.trim()).filter(Boolean);
      if (list.length) {
        result = result.filter((u) => {
          const f = u.funciones || [];
          return list.some((q) => f.includes(q));
        });
      }
    }
    res.json({ alumnos: result });
  } catch (err) {
    console.error('[GET /api/admin/alumnos]', err);
    res.status(500).json({ error: err.message || 'Error al listar alumnos' });
  }
});

/** Listar asesoras con filtro por funciones */
router.get('/asesoras', async (req, res) => {
  try {
    const { funciones } = req.query;
    const asesoras = await prisma.asesora.findMany({
      include: {
        planesAsesora: { include: { plan: true } },
        cuenta: { select: { activo: true, email: true } },
      },
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
    });
    let result = asesoras.map((a) => ({
      ...a,
      activo: a.cuenta?.activo ?? true,
      funciones: a.funciones && Array.isArray(a.funciones) ? a.funciones : (a.funciones && typeof a.funciones === 'object' ? Object.values(a.funciones) : []),
    }));
    if (funciones) {
      const list = String(funciones).split(',').map((f) => f.trim()).filter(Boolean);
      if (list.length) {
        result = result.filter((a) => {
          const f = a.funciones || [];
          return list.some((q) => f.includes(q));
        });
      }
    }
    res.json({ asesoras: result });
  } catch (err) {
    console.error('[GET /api/admin/asesoras]', err);
    res.status(500).json({ error: err.message || 'Error al listar asesoras' });
  }
});

/**
 * Editar asesora (todos los campos; email no editable).
 * activo = false: inhabilita la cuenta y elimina todos sus horarios (inscripciones/sesiones en cascada), liberando cupos.
 */
router.patch('/asesoras/:asesoraId', async (req, res) => {
  const adminId = req.auth.sub;
  const { asesoraId } = req.params;
  const body = req.body || {};
  const asesora = await prisma.asesora.findUnique({ where: { id: asesoraId } });
  if (!asesora) return res.status(404).json({ error: 'Asesora no encontrada' });
  const data = {};
  const campos = ['nombre', 'apellidos', 'celular', 'linkZoomGlobal', 'funciones'];
  for (const key of campos) {
    if (body[key] !== undefined) {
      if (key === 'funciones') data[key] = Array.isArray(body[key]) ? body[key] : [];
      else data[key] = body[key];
    }
  }
  const cambios = [];
  if (Object.keys(data).length) {
    await prisma.asesora.update({ where: { id: asesoraId }, data });
    cambios.push(...Object.keys(data));
  }
  if (typeof body.activo === 'boolean') {
    const cuentaRow = await prisma.cuenta.findUnique({
      where: { id: asesora.cuentaId },
      select: { activo: true },
    });
    const deactivando = body.activo === false && (cuentaRow?.activo ?? true);
    if (deactivando) {
      const nHorarios = await prisma.horario.count({ where: { asesoraId } });
      await prisma.$transaction([
        prisma.horario.deleteMany({ where: { asesoraId } }),
        prisma.cuenta.update({
          where: { id: asesora.cuentaId },
          data: { activo: false },
        }),
      ]);
      await prisma.auditoria.create({
        data: {
          accion: 'admin_desactiva_asesora_libera_horarios',
          entidad: 'asesora',
          entidadId: asesoraId,
          detalles: await detallesConAdminEmail(prisma, adminId, {
            descripcion:
              'Asesora inhabilitada por administración: se eliminaron sus horarios (franjas), inscripciones y sesiones vinculadas. Los cupos quedan libres.',
            horariosEliminados: nHorarios,
          }),
          adminId,
          asesoraId,
        },
      });
    } else {
      await prisma.cuenta.update({
        where: { id: asesora.cuentaId },
        data: { activo: body.activo },
      });
      cambios.push('activo');
    }
  }
  if (Array.isArray(body.planIds)) {
    await prisma.planAsesora.deleteMany({ where: { asesoraId } });
    if (body.planIds.length) {
      await prisma.planAsesora.createMany({
        data: body.planIds.map((planId) => ({ asesoraId, planId })),
      });
    }
    cambios.push('planIds');
  }
  if (cambios.length) {
    await prisma.auditoria.create({
      data: {
        accion: 'admin_edicion_asesora',
        entidad: 'asesora',
        entidadId: asesoraId,
        detalles: await detallesConAdminEmail(prisma, adminId, {
          descripcion: `Cambios en la ficha de asesora: ${cambios.join(', ')}.`,
          campos: cambios,
        }),
        adminId,
        asesoraId,
      },
    });
  }
  res.json({ ok: true });
});

/** Detalle de un slot: alumnos y asesora */
router.get('/horarios/:horarioId', async (req, res) => {
  const horario = await prisma.horario.findUnique({
    where: { id: req.params.horarioId },
    include: {
      asesora: true,
      inscripciones: { where: { estado: 'activa' }, include: { usuario: { include: { plan: true } } } },
      sustitucionesSemanales: {
        orderBy: { semanaInicio: 'desc' },
        include: { asesoraSustituta: { select: { id: true, nombre: true, apellidos: true } } },
      },
    },
  });
  if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });
  res.json(horario);
});

/** Registrar sustitución por una semana (lunes = inicio). La asesora titular no gestiona esa sesión; la hora cuenta para la sustituta al marcar clase. */
router.post('/sustituciones-semanales', async (req, res) => {
  try {
    const adminId = req.auth.sub;
    const { horarioId, semanaInicio, asesoraSustitutaId } = req.body || {};
    if (!horarioId || !semanaInicio || !asesoraSustitutaId) {
      return res.status(400).json({ error: 'Se requiere horarioId, semanaInicio (YYYY-MM-DD, lunes) y asesoraSustitutaId' });
    }
    const raw = new Date(String(semanaInicio).slice(0, 10) + 'T12:00:00.000Z');
    if (!esLunesBolivia(raw)) return res.status(400).json({ error: 'semanaInicio debe ser un lunes' });
    const lunesSemana = lunesSemanaBolivia(raw);
    const lunesJS = lunesSemana.startOf('day').toJSDate();

    const horario = await prisma.horario.findUnique({ where: { id: horarioId }, include: { asesora: true } });
    if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });
    if (horario.asesoraId === asesoraSustitutaId) {
      return res.status(400).json({ error: 'La sustituta debe ser distinta a la asesora titular del horario' });
    }
    const sustituta = await prisma.asesora.findUnique({ where: { id: asesoraSustitutaId } });
    if (!sustituta) return res.status(404).json({ error: 'Asesora sustituta no encontrada' });

    const sub = await prisma.sustitucionSemanal.upsert({
      where: { horarioId_semanaInicio: { horarioId, semanaInicio: lunesJS } },
      create: { horarioId, semanaInicio: lunesJS, asesoraSustitutaId, adminId },
      update: { asesoraSustitutaId, adminId },
      include: { asesoraSustituta: { select: { id: true, nombre: true, apellidos: true } } },
    });

    const fechaClaseDT = fechaClaseEnSemana(horario.diaSemana, lunesSemana);
    const fechaClaseJS = fechaClaseDT.toJSDate();
    const fechaHoraFin = fechaHoraFinSesion(fechaClaseJS, horario.horaFin).toJSDate();

    await prisma.sesion.upsert({
      where: { horarioId_fecha: { horarioId, fecha: fechaClaseJS } },
      create: {
        horarioId,
        fecha: fechaClaseJS,
        fechaHoraFin,
        asesoraEfectivaId: asesoraSustitutaId,
      },
      update: {
        fechaHoraFin,
        asesoraEfectivaId: asesoraSustitutaId,
      },
    });

    await prisma.auditoria.create({
      data: {
        accion: 'admin_sustitucion_semanal',
        entidad: 'sustitucion_semanal',
        entidadId: sub.id,
        detalles: await detallesConAdminEmail(prisma, adminId, {
          descripcion: 'Sustitución semanal asignada: el horario la cubre otra asesora esa semana únicamente.',
          horarioId,
          semanaInicio: lunesJS.toISOString().slice(0, 10),
          asesoraSustitutaId,
          titularId: horario.asesoraId,
        }),
        adminId,
      },
    });

    res.status(201).json({ sustitucion: sub });
  } catch (err) {
    console.error('[POST /sustituciones-semanales]', err);
    res.status(500).json({ error: err.message || 'Error al guardar sustitución' });
  }
});

router.delete('/sustituciones-semanales/:id', async (req, res) => {
  try {
    const adminId = req.auth.sub;
    const sub = await prisma.sustitucionSemanal.findUnique({
      where: { id: req.params.id },
      include: { horario: true },
    });
    if (!sub) return res.status(404).json({ error: 'Sustitución no encontrada' });

    const lunesSemana = lunesSemanaBolivia(sub.semanaInicio);
    const fechaClaseJS = fechaClaseEnSemana(sub.horario.diaSemana, lunesSemana).toJSDate();

    await prisma.sesion.updateMany({
      where: { horarioId: sub.horarioId, fecha: fechaClaseJS, asesoraEfectivaId: sub.asesoraSustitutaId },
      data: { asesoraEfectivaId: null },
    });

    await prisma.sustitucionSemanal.delete({ where: { id: sub.id } });

    await prisma.auditoria.create({
      data: {
        accion: 'admin_sustitucion_semanal',
        entidad: 'sustitucion_semanal',
        entidadId: sub.id,
        detalles: await detallesConAdminEmail(prisma, adminId, {
          descripcion: 'Sustitución semanal eliminada.',
          horarioId: sub.horarioId,
          semanaInicio: sub.semanaInicio.toISOString().slice(0, 10),
          eliminado: true,
        }),
        adminId,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /sustituciones-semanales/:id]', err);
    res.status(500).json({ error: err.message || 'Error al eliminar sustitución' });
  }
});

/** Información completa de un usuario + último registro + historial auditoría */
router.get('/usuarios/:usuarioId', async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.params.usuarioId },
    include: {
      plan: true,
      mensualidades: true,
      abonos: { orderBy: { fecha: 'desc' } },
      inscripciones: { where: { estado: 'activa' }, include: { horario: { include: { asesora: true } } } },
    },
  });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const cuenta = await prisma.cuenta.findUnique({ where: { id: usuario.cuentaId } });
  const auditorias = await prisma.auditoria.findMany({
    where: {
      OR: [{ usuarioId: usuario.id }, { entidad: 'cuenta', entidadId: usuario.cuentaId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const adminIdsHist = [...new Set(auditorias.map((a) => a.adminId).filter(Boolean))];
  const cuentasAdminHist = adminIdsHist.length
    ? await prisma.cuenta.findMany({
        where: { id: { in: adminIdsHist } },
        select: { id: true, email: true, nombre: true, apellidos: true },
      })
    : [];
  const cuentaAdminHistById = new Map(cuentasAdminHist.map((c) => [c.id, c]));
  const mapAuditHist = (a) => {
    const c = a.adminId ? cuentaAdminHistById.get(a.adminId) : null;
    const adminEmail =
      c?.email ||
      (typeof a.detalles === 'object' && a.detalles?.adminEmail ? String(a.detalles.adminEmail) : null);
    const adminDisplay =
      formatAdminEtiqueta(c) ||
      (typeof a.detalles === 'object' && a.detalles?.adminEtiqueta
        ? String(a.detalles.adminEtiqueta)
        : null) ||
      adminEmail;
    return {
      ...a,
      accionEtiqueta: etiquetaAccionAuditoria(a.accion),
      adminEmail,
      adminDisplay,
    };
  };
  const ultimoRegistro = auditorias[0] ? mapAuditHist(auditorias[0]) : null;
  const toNum = (v) => (v != null && v !== '' ? Number(v) : null);
  const usuarioJson = {
    ...usuario,
    email: cuenta?.email,
    montoTotal: toNum(usuario.montoTotal),
    montoEnganche: toNum(usuario.montoEnganche),
    montoPorCuota: toNum(usuario.montoPorCuota),
    fechaPrimerVencimiento: usuario.fechaPrimerVencimiento
      ? usuario.fechaPrimerVencimiento.toISOString().slice(0, 10)
      : null,
    abonos: (usuario.abonos || []).map((a) => ({ ...a, monto: toNum(a.monto) })),
    mensualidades: (usuario.mensualidades || []).map((m) => ({ ...m, monto: toNum(m.monto) })),
  };
  const resumenCuotas = computeEstadoCuotas(usuario, usuario.mensualidades);
  res.json({
    usuario: usuarioJson,
    resumenCuotas,
    ultimoRegistro: ultimoRegistro
      ? {
          accion: ultimoRegistro.accion,
          accionEtiqueta: ultimoRegistro.accionEtiqueta,
          detalles: ultimoRegistro.detalles,
          createdAt: ultimoRegistro.createdAt,
          asesoraId: ultimoRegistro.asesoraId,
          adminId: ultimoRegistro.adminId,
          adminEmail: ultimoRegistro.adminEmail,
          adminDisplay: ultimoRegistro.adminDisplay,
        }
      : null,
    historialAuditoria: auditorias.map(mapAuditHist),
  });
});

/**
 * Editar alumno (todos los campos).
 * activo = false: inhabilita cuenta + usuario, elimina inscripciones (permanentes y por semana) y pone horasSaldo en 0.
 */
router.patch('/usuarios/:usuarioId', async (req, res) => {
  const adminId = req.auth.sub;
  const { usuarioId } = req.params;
  const body = req.body || {};
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: { plan: true } });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const data = {};
  const campos = ['nombre', 'apellidos', 'celular', 'planId', 'pais', 'departamento', 'modalidad', 'tutorLegal', 'horasSaldo', 'clasesPorSemana', 'observaciones', 'cuotasTotales', 'montoTotal', 'montoEnganche', 'montoPorCuota', 'fechaPrimerVencimiento', 'pagoContado', 'activo', 'funciones'];
  for (const key of campos) {
    if (body[key] !== undefined) {
      if (key === 'horasSaldo') data[key] = Math.max(0, Number(body[key]) || 0);
      else if (key === 'clasesPorSemana') data[key] = body[key] === '' || body[key] == null ? null : Math.max(1, Number(body[key]) || 0);
      else if (key === 'cuotasTotales') data[key] = body[key] === '' || body[key] == null ? null : Math.max(0, Number(body[key]) || 0);
      else if (key === 'planId') data[key] = body[key] || null;
      else if (key === 'montoTotal' || key === 'montoPorCuota') data[key] = body[key] === '' || body[key] == null ? null : Number(body[key]);
      else if (key === 'montoEnganche') data[key] = body[key] === '' || body[key] == null ? null : Math.max(0, Number(body[key]) || 0);
      else if (key === 'fechaPrimerVencimiento') data[key] = body[key] === '' || body[key] == null ? null : new Date(String(body[key]));
      else if (key === 'pagoContado' || key === 'activo') data[key] = Boolean(body[key]);
      else if (key === 'funciones') data[key] = Array.isArray(body[key]) ? body[key] : [];
      else data[key] = body[key];
    }
  }
  if (['montoTotal', 'montoEnganche', 'cuotasTotales'].some((k) => body[k] !== undefined)) {
    const merged = { ...usuario, ...data };
    const mt = merged.montoTotal != null ? Number(merged.montoTotal) : null;
    const eng = merged.montoEnganche != null ? Number(merged.montoEnganche) : 0;
    if (mt != null && eng > mt) {
      return res.status(400).json({ error: 'El enganche no puede ser mayor al monto total.' });
    }
    data.montoPorCuota = calcMontoPorCuota({
      montoTotal: merged.montoTotal,
      montoEnganche: merged.montoEnganche,
      cuotasTotales: merged.cuotasTotales,
    });
  }

  const deactivandoAlumno =
    typeof body.activo === 'boolean' && body.activo === false && usuario.activo === true;

  if (deactivandoAlumno) {
    data.activo = false;
    data.horasSaldo = 0;
    const nIns = await prisma.inscripcionHorario.count({ where: { usuarioId } });
    const nInsSem = await prisma.inscripcionHorarioSemana.count({ where: { usuarioId } });
    await prisma.$transaction(async (tx) => {
      await tx.inscripcionHorario.deleteMany({ where: { usuarioId } });
      await tx.inscripcionHorarioSemana.deleteMany({ where: { usuarioId } });
      await tx.cuenta.update({ where: { id: usuario.cuentaId }, data: { activo: false } });
      await tx.usuario.update({ where: { id: usuarioId }, data });
    });
    await prisma.auditoria.create({
      data: {
        accion: 'admin_desactiva_alumno_libera_horarios',
        entidad: 'usuario',
        entidadId: usuarioId,
        detalles: await detallesConAdminEmail(prisma, adminId, {
          descripcion:
            'Alumno inhabilitado por administración: se quitaron todas las inscripciones a horarios (permanentes y por semana), horas saldo puestas en 0 y bloqueado el acceso al sistema.',
          inscripcionesHorarioEliminadas: nIns,
          inscripcionesSemanaEliminadas: nInsSem,
          campos: Object.keys(data),
        }),
        adminId,
        usuarioId,
      },
    });
    return res.json({ ok: true });
  }

  if (typeof body.activo === 'boolean') {
    await prisma.cuenta.update({
      where: { id: usuario.cuentaId },
      data: { activo: Boolean(body.activo) },
    });
  }

  if (Object.keys(data).length) {
    await prisma.usuario.update({ where: { id: usuarioId }, data });
    await prisma.auditoria.create({
      data: {
        accion: 'admin_edicion_alumno',
        entidad: 'usuario',
        entidadId: usuarioId,
        detalles: await detallesConAdminEmail(prisma, adminId, {
          campos: Object.keys(data),
          descripcion: `Datos del alumno modificados: ${Object.keys(data).join(', ')}.`,
        }),
        adminId,
        usuarioId: usuarioId,
      },
    });
  }
  res.json({ ok: true });
});

/** Añadir abono (pago extra) para bajar cuotas del alumno */
router.post('/usuarios/:usuarioId/abonos', async (req, res) => {
  const adminId = req.auth.sub;
  const { usuarioId } = req.params;
  const { monto } = req.body || {};
  const num = Number(monto);
  if (!Number.isFinite(num) || num <= 0) return res.status(400).json({ error: 'Monto debe ser un número positivo' });
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const abono = await prisma.abono.create({
    data: { usuarioId, monto: num },
  });
  await prisma.auditoria.create({
    data: {
      accion: 'admin_registro_abono',
      entidad: 'abono',
      entidadId: abono.id,
      detalles: await detallesConAdminEmail(prisma, adminId, {
        descripcion: `Abono registrado por administración: ${num}.`,
        monto: num,
      }),
      adminId,
      usuarioId,
    },
  });
  res.status(201).json({ ok: true });
});

/** Registrar pago de una cuota (mensualidad por mes/año según calendario de cuotas) */
router.put('/usuarios/:usuarioId/mensualidades', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { mes, anio, pagado } = req.body || {};
    const m = parseInt(mes, 10);
    const a = parseInt(anio, 10);
    if (!Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(a) || a < 2000 || a > 2100) {
      return res.status(400).json({ error: 'Mes y año inválidos' });
    }
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    const pago = pagado !== false;
    const montoVal = usuario.montoPorCuota != null ? usuario.montoPorCuota : null;
    const row = await prisma.mensualidad.upsert({
      where: { usuarioId_mes_anio: { usuarioId, mes: m, anio: a } },
      create: {
        usuarioId,
        mes: m,
        anio: a,
        pagado: pago,
        monto: montoVal ?? undefined,
        fechaPago: pago ? new Date() : null,
      },
      update: {
        pagado: pago,
        monto: montoVal ?? undefined,
        fechaPago: pago ? new Date() : null,
      },
    });
    const adminId = req.auth.sub;
    await prisma.auditoria.create({
      data: {
        accion: 'admin_pago_cuota',
        entidad: 'mensualidad',
        entidadId: row.id,
        detalles: await detallesConAdminEmail(prisma, adminId, {
          descripcion: `Estado de pago de mensualidad registrado (${m}/${a}).`,
          mes: m,
          anio: a,
          pagado: pago,
        }),
        adminId,
        usuarioId,
      },
    });
    res.json({ ok: true, mensualidad: row });
  } catch (err) {
    console.error('[PUT /usuarios/:id/mensualidades]', err);
    res.status(500).json({ error: err.message || 'Error al guardar mensualidad' });
  }
});

/** Reportes: por período (año, semana, día) */
router.get('/reportes/asistencia', async (req, res) => {
  const { anio, semana, dia } = req.query;
  const where = {};
  if (anio) {
    const start = new Date(`${anio}-01-01`);
    const end = new Date(`${anio}-12-31T23:59:59`);
    where.sesion = { fecha: { gte: start, lte: end } };
  }
  if (semana && anio) {
    const d = new Date(`${anio}-01-01`);
    const start = new Date(d);
    start.setDate(start.getDate() + (parseInt(semana, 10) - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59);
    where.sesion = { fecha: { gte: start, lte: end } };
  }
  if (dia) {
    where.sesion = { ...where.sesion, fecha: new Date(dia + 'T12:00:00.000Z') };
  }
  const asistencias = await prisma.asistenciaSesion.findMany({
    where,
    include: {
      usuario: { include: { plan: true } },
      sesion: { include: { horario: { include: { asesora: true } } } },
    },
    orderBy: { sesion: { fecha: 'desc' } },
  });
  res.json({
    reporte: asistencias.map((a) => ({
      fecha: a.sesion.fecha,
      fechaMarcado: a.sesion.timestampAsistencia || null,
      alumno: `${a.usuario.nombre} ${a.usuario.apellidos}`,
      plan: a.usuario.plan?.nombre,
      asesora: a.sesion.horario?.asesora ? `${a.sesion.horario.asesora.nombre} ${a.sesion.horario.asesora.apellidos}` : null,
      presente: a.presente,
      pasoClase: a.sesion.pasoClaseAsesora,
    })),
  });
});

/** Reporte horas asesoras: solo sesiones desde fechaConteoHorasDesde (si existe) y con al menos un alumno inscrito activo en el horario. */
router.get('/reportes/horas-asesoras', async (req, res) => {
  const { anio, mes } = req.query;
  const where = {};
  if (anio) where.fecha = { gte: new Date(`${anio}-01-01`), lte: new Date(`${anio}-12-31`) };
  if (mes && anio) where.fecha = { gte: new Date(`${anio}-${String(mes).padStart(2, '0')}-01`), lte: new Date(`${anio}-${String(mes).padStart(2, '0')}-31`) };
  const sesiones = await prisma.sesion.findMany({
    where,
    include: {
      horario: {
        include: {
          asesora: true,
          _count: { select: { inscripciones: { where: { estado: 'activa' } } } },
        },
      },
      asesoraEfectiva: true,
      asistencias: {
        select: { presente: true },
      },
    },
    orderBy: [{ fecha: 'desc' }, { horario: { horaInicio: 'asc' } }],
  });

  const porAsesora = {};
  for (const s of sesiones) {
    const titular = s.horario.asesora;
    const efectiva = s.asesoraEfectiva ?? titular;
    const inscripcionesActivas = s.horario._count?.inscripciones ?? 0;
    if (inscripcionesActivas < 1) continue;

    const desde = efectiva.fechaConteoHorasDesde;
    if (desde) {
      const diaSesion = inicioDiaBolivia(s.fecha);
      const diaDesde = inicioDiaBolivia(desde);
      if (diaSesion < diaDesde) continue;
    }

    const id = s.asesoraEfectivaId ?? s.horario.asesoraId;
    if (!porAsesora[id]) {
      porAsesora[id] = {
        asesora: efectiva,
        horas: 0,
        horasNoHechas: 0,
        sesiones: [],
        fechaConteoHorasDesde: efectiva.fechaConteoHorasDesde,
        semanas: {}, // semanaInicioIso -> resumen semanal
      };
    }
    const totalAlumnos = s.asistencias.length;
    const presentes = s.asistencias.filter((a) => a.presente === true).length;
    const faltas = s.asistencias.filter((a) => a.presente === false).length;
    const sinMarcar = totalAlumnos - presentes - faltas;
    if (s.pasoClaseAsesora) porAsesora[id].horas += 1;
    else porAsesora[id].horasNoHechas += 1;

    const semanaInicio = lunesSemanaBolivia(s.fecha).toISODate();
    if (!porAsesora[id].semanas[semanaInicio]) {
      porAsesora[id].semanas[semanaInicio] = {
        semanaInicio,
        horas: 0,
        horasNoHechas: 0,
      };
    }
    if (s.pasoClaseAsesora) porAsesora[id].semanas[semanaInicio].horas += 1;
    else porAsesora[id].semanas[semanaInicio].horasNoHechas += 1;

    porAsesora[id].sesiones.push({
      sesionId: s.id,
      fecha: s.fecha,
      horaInicio: s.horario.horaInicio,
      horaFin: s.horario.horaFin,
      modalidad: s.horario.modalidad,
      pasoClase: s.pasoClaseAsesora,
      fechaMarcado: s.timestampAsistencia,
      totalAlumnos,
      presentes,
      faltas,
      sinMarcar,
      alumnosInscritos: inscripcionesActivas,
      sesionPorSustitucion: Boolean(s.asesoraEfectivaId && s.asesoraEfectivaId !== s.horario.asesoraId),
      asesoraTitularNombre: titular ? `${titular.nombre} ${titular.apellidos}`.trim() : null,
    });
  }

  // Auditoría: guardamos el resumen semanal para trazar problemas de conteo por semanas.
  // Si el log falla, no debe romper el reporte.
  const adminId = req.auth.sub;
  try {
    await prisma.auditoria.create({
      data: {
        accion: 'admin_consulta_reporte_horas_asesoras',
        entidad: 'reporte_horas_asesoras',
        entidadId: `${anio || 'all'}_${mes || 'all'}`,
        adminId,
        detalles: await detallesConAdminEmail(prisma, adminId, {
          anio: anio ? Number(anio) : null,
          mes: mes ? Number(mes) : null,
          semanasPorAsesora: Object.values(porAsesora).map((r) => ({
            asesoraId: r.asesora?.id,
            horas: r.horas,
            horasNoHechas: r.horasNoHechas,
            semanas: Object.values(r.semanas)
              .map((s) => ({
                semanaInicio: s.semanaInicio,
                horas: s.horas,
                horasNoHechas: s.horasNoHechas,
                totalSesiones: (s.horas || 0) + (s.horasNoHechas || 0),
              }))
              .sort((a, b) => String(a.semanaInicio).localeCompare(String(b.semanaInicio))),
          })),
        }),
      },
    });
  } catch (e) {
    console.warn('[AUDITORIA] No se pudo registrar admin_consulta_reporte_horas_asesoras', e?.message || e);
  }

  res.json({
    reporte: Object.values(porAsesora).map((r) => ({
      ...r,
      totalSesiones: (r.horas || 0) + (r.horasNoHechas || 0),
      semanas: Object.values(r.semanas)
        .map((s) => ({
          semanaInicio: s.semanaInicio,
          horas: s.horas,
          horasNoHechas: s.horasNoHechas,
          totalSesiones: (s.horas || 0) + (s.horasNoHechas || 0),
        }))
        .sort((a, b) => String(a.semanaInicio).localeCompare(String(b.semanaInicio))),
    })),
  });
});

/** Reporte alumnos inscritos (filtro país, funciones: lectura dinámica, nivelación, etc.); horas consumidas */
router.get('/reportes/alumnos', async (req, res) => {
  const { pais, funciones: funcionesQuery } = req.query;
  const where = {};
  if (pais && String(pais).trim()) where.pais = String(pais).trim();
  const funcionesFiltro = funcionesQuery
    ? String(funcionesQuery).split(',').map((f) => f.trim()).filter(Boolean)
    : [];

  const usuarios = await prisma.usuario.findMany({
    where,
    include: {
      plan: true,
      _count: { select: { asistencias: { where: { presente: true } } } },
    },
    orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
  });

  const normalizarFunciones = (u) =>
    u.funciones && Array.isArray(u.funciones)
      ? u.funciones
      : u.funciones && typeof u.funciones === 'object'
        ? Object.values(u.funciones)
        : [];

  let filtrados = usuarios;
  if (funcionesFiltro.length) {
    filtrados = usuarios.filter((u) => {
      const f = normalizarFunciones(u);
      return funcionesFiltro.some((q) => f.includes(q));
    });
  }

  res.json({
    reporte: filtrados.map((u) => {
      const funciones = normalizarFunciones(u);
      return {
        id: u.id,
        nombre: `${u.nombre} ${u.apellidos}`,
        plan: u.plan?.nombre,
        funciones,
        pais: u.pais,
        horasSaldo: u.horasSaldo,
        horasConsumidas: u._count.asistencias,
      };
    }),
    total: filtrados.length,
  });
});

/** Reporte pagos: por mes, cuotas restantes (excluir pago contado) */
router.get('/reportes/pagos', async (req, res) => {
  const { mes, anio } = req.query;
  const usuarios = await prisma.usuario.findMany({
    where: { pagoContado: false },
    include: { mensualidades: true },
  });
  const reporte = usuarios.map((u) => {
    const pagadas = u.mensualidades.filter((m) => m.pagado).length;
    const cuotasRestantes = (u.cuotasTotales ?? 0) - pagadas;
    const pendienteMes = mes && anio ? !u.mensualidades.some((m) => m.mes === parseInt(mes, 10) && m.anio === parseInt(anio, 10) && m.pagado) : null;
    return {
      usuarioId: u.id,
      nombre: `${u.nombre} ${u.apellidos}`,
      cuotasTotales: u.cuotasTotales,
      cuotasPagadas: pagadas,
      cuotasRestantes: Math.max(0, cuotasRestantes),
      pagadoEsteMes: pendienteMes === false,
    };
  });
  res.json({ reporte });
});

function normalizarFuncionesJson(f) {
  if (f == null) return [];
  if (Array.isArray(f)) return f.filter((x) => typeof x === 'string');
  if (typeof f === 'object') return Object.values(f).filter((x) => typeof x === 'string');
  return [];
}

/** Auditoría: eventos importantes. Filtros: alcance (alumnos|asesoras|sistema), mes, funciones (IDs materia alumno), accion, entidad, adminId (cuenta admin que actuó), q (texto). */
router.get('/reportes/auditoria', async (req, res) => {
  const take = Math.min(1000, Math.max(1, parseInt(req.query.take || '300', 10) || 300));
  const { anio, mes, alcance, funciones: funcionesQ, accion, entidad, q, adminId: adminIdQuery } = req.query;

  const where = {};
  const y = anio ? parseInt(String(anio), 10) : null;
  if (y && Number.isFinite(y)) {
    const m = mes != null && mes !== '' ? parseInt(String(mes), 10) : null;
    if (m >= 1 && m <= 12) {
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    } else {
      where.createdAt = { gte: new Date(y, 0, 1, 0, 0, 0, 0), lte: new Date(y, 11, 31, 23, 59, 59, 999) };
    }
  }

  if (alcance === 'alumnos') where.usuarioId = { not: null };
  else if (alcance === 'asesoras') where.asesoraId = { not: null };
  else if (alcance === 'sistema') {
    where.usuarioId = null;
    where.asesoraId = null;
  }

  const accionTrim = accion && String(accion).trim();
  if (accionTrim) where.accion = accionTrim;
  const entidadTrim = entidad && String(entidad).trim();
  if (entidadTrim) where.entidad = entidadTrim;

  const adminIdFiltro = adminIdQuery && String(adminIdQuery).trim();
  if (adminIdFiltro) where.adminId = adminIdFiltro;

  const funcionesFilter = String(funcionesQ || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const fetchTake = funcionesFilter.length && alcance === 'alumnos' ? Math.min(2500, take * 8) : take;

  let auditorias = await prisma.auditoria.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: fetchTake,
    include: {
      usuarioModificado: { select: { id: true, nombre: true, apellidos: true, funciones: true } },
      asesoraActor: { select: { id: true, nombre: true, apellidos: true } },
    },
  });

  const adminIdsBatch = Array.from(new Set(auditorias.map((a) => a.adminId).filter(Boolean)));
  const cuentasAdminLookup = adminIdsBatch.length
    ? await prisma.cuenta.findMany({
        where: { id: { in: adminIdsBatch } },
        select: { id: true, email: true, nombre: true, apellidos: true },
      })
    : [];
  const cuentaAdminById = new Map(cuentasAdminLookup.map((c) => [c.id, c]));

  if (funcionesFilter.length && alcance === 'alumnos') {
    auditorias = auditorias.filter((a) => {
      const arr = normalizarFuncionesJson(a.usuarioModificado?.funciones);
      return funcionesFilter.some((id) => arr.includes(id));
    });
  }

  const qTrim = q && String(q).trim();
  if (qTrim) {
    const needle = qTrim.toLowerCase();
    auditorias = auditorias.filter((a) => {
      const u = a.usuarioModificado;
      const as = a.asesoraActor;
      const cAdm = a.adminId ? cuentaAdminById.get(a.adminId) : null;
      const adminEmail = cAdm?.email
        ? String(cAdm.email)
        : typeof a.detalles === 'object' && a.detalles?.adminEmail
          ? String(a.detalles.adminEmail)
          : '';
      const adminEtiquetaTxt = formatAdminEtiqueta(cAdm)
        || (typeof a.detalles === 'object' && a.detalles?.adminEtiqueta
          ? String(a.detalles.adminEtiqueta)
          : '');
      const blob = [
        a.accion,
        a.entidad,
        a.entidadId,
        JSON.stringify(a.detalles ?? {}),
        u?.nombre,
        u?.apellidos,
        as?.nombre,
        as?.apellidos,
        adminEmail,
        adminEtiquetaTxt,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(needle);
    });
  }

  auditorias = auditorias.slice(0, take);

  res.json({
    auditorias: auditorias.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      accion: a.accion,
      accionEtiqueta: etiquetaAccionAuditoria(a.accion),
      entidad: a.entidad,
      entidadId: a.entidadId,
      detalles: a.detalles,
      usuarioId: a.usuarioId,
      asesoraId: a.asesoraId,
      adminId: a.adminId,
      adminEmail: (() => {
        const c = a.adminId ? cuentaAdminById.get(a.adminId) : null;
        if (c?.email) return c.email;
        if (typeof a.detalles === 'object' && a.detalles?.adminEmail) return String(a.detalles.adminEmail);
        return null;
      })(),
      adminDisplay: (() => {
        const c = a.adminId ? cuentaAdminById.get(a.adminId) : null;
        const fromCuenta = formatAdminEtiqueta(c);
        if (fromCuenta) return fromCuenta;
        if (typeof a.detalles === 'object' && a.detalles?.adminEtiqueta) return String(a.detalles.adminEtiqueta);
        if (typeof a.detalles === 'object' && a.detalles?.adminEmail) return String(a.detalles.adminEmail);
        return null;
      })(),
      usuario: a.usuarioModificado
        ? {
            id: a.usuarioModificado.id,
            nombre: a.usuarioModificado.nombre,
            apellidos: a.usuarioModificado.apellidos,
            funciones: normalizarFuncionesJson(a.usuarioModificado.funciones),
          }
        : null,
      asesora: a.asesoraActor ? { id: a.asesoraActor.id, nombre: a.asesoraActor.nombre, apellidos: a.asesoraActor.apellidos } : null,
    })),
  });
});

/** Reporte actividad: inscripciones por plan y por país en el año */
router.get('/reportes/actividad', async (req, res) => {
  const { anio } = req.query;
  const where = {};
  if (anio) where.fechaRegistro = { gte: new Date(`${anio}-01-01`), lte: new Date(`${anio}-12-31T23:59:59`) };
  const usuarios = await prisma.usuario.findMany({
    where,
    include: { plan: true },
  });
  const porPlan = {};
  const porPais = {};
  for (const u of usuarios) {
    const planKey = u.plan?.nombre ?? 'Sin plan';
    porPlan[planKey] = (porPlan[planKey] || 0) + 1;
    const paisKey = u.pais || 'Sin país';
    porPais[paisKey] = (porPais[paisKey] || 0) + 1;
  }
  res.json({ inscripciones: usuarios.length, porPlan, porPais });
});

/** Alta usuario (alumno) */
router.post('/usuarios', async (req, res) => {
  const adminId = req.auth.sub;
  const { email, password, nombre, apellidos, celular, planId, funciones, pais, departamento, modalidad, tutorLegal, horasSaldo, clasesPorSemana, observaciones, cuotasTotales, montoTotal, montoEnganche, pagoContado, fechaPrimerVencimiento } = req.body || {};
  if (!password || !nombre || !apellidos) return res.status(400).json({ error: 'Faltan campos requeridos' });
  if (!email && !celular) return res.status(400).json({ error: 'Debes registrar al menos email o celular' });
  const cuentaEmail = await resolveCuentaEmail(email, celular);
  const existe = await prisma.cuenta.findUnique({ where: { email: cuentaEmail } });
  if (existe) return res.status(400).json({ error: 'Email ya registrado' });
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const cuenta = await prisma.cuenta.create({
    data: { email: cuentaEmail, passwordHash, rol: 'usuario' },
  });
  await prisma.auditoria.create({
    data: {
      accion: 'auth_force_password_change_required',
      entidad: 'cuenta',
      entidadId: cuenta.id,
      detalles: await detallesConAdminEmail(prisma, adminId, {
        descripcion: 'Cuenta de alumno creada; deberá cambiar la contraseña en el primer acceso.',
        motivo: 'primer_ingreso_alumno',
      }),
      adminId,
    },
  });
  const cuotas = cuotasTotales != null ? Math.max(0, Number(cuotasTotales) || 0) : null;
  const monto = montoTotal != null && montoTotal !== '' ? Number(montoTotal) : null;
  const enganche = montoEnganche != null && montoEnganche !== '' ? Math.max(0, Number(montoEnganche) || 0) : 0;
  const contado = pagoContado ?? false;
  if (monto != null && enganche > monto) {
    return res.status(400).json({ error: 'El enganche (inscripción) no puede ser mayor al monto total.' });
  }
  if (cuotas && cuotas > 0 && !contado && !fechaPrimerVencimiento) {
    return res.status(400).json({ error: 'Indica la fecha del primer vencimiento (día acordado del primer pago).' });
  }
  const usuarioData = {
    cuentaId: cuenta.id,
    nombre,
    apellidos,
    celular: celular || null,
    planId: planId || null,
    pais: pais || 'Bolivia',
    departamento: departamento || null,
    modalidad: modalidad || 'online',
    tutorLegal: tutorLegal || null,
    horasSaldo: Math.max(0, Number(horasSaldo) || 0),
    clasesPorSemana: clasesPorSemana === undefined || clasesPorSemana === '' ? null : Math.max(1, Number(clasesPorSemana) || 0),
    observaciones: observaciones || null,
    cuotasTotales: cuotas || null,
    montoTotal: monto,
    montoEnganche: enganche > 0 ? enganche : null,
    montoPorCuota: calcMontoPorCuota({ montoTotal: monto, montoEnganche: enganche, cuotasTotales: cuotas }),
    pagoContado: contado,
  };
  if (fechaPrimerVencimiento && String(fechaPrimerVencimiento).trim()) {
    usuarioData.fechaPrimerVencimiento = new Date(String(fechaPrimerVencimiento).trim());
  }
  if (Array.isArray(funciones) && funciones.length) usuarioData.funciones = funciones;
  await prisma.usuario.create({
    data: usuarioData,
  });
  res.status(201).json({ ok: true });
});

/** Alta asesora */
router.post('/asesoras', async (req, res) => {
  const adminId = req.auth.sub;
  const { email, password, nombre, apellidos, celular, planIds, funciones } = req.body || {};
  if (!password || !nombre || !apellidos) return res.status(400).json({ error: 'Faltan campos requeridos' });
  if (!email && !celular) return res.status(400).json({ error: 'Debes registrar al menos email o celular' });
  const cuentaEmail = await resolveCuentaEmail(email, celular);
  const existe = await prisma.cuenta.findUnique({ where: { email: cuentaEmail } });
  if (existe) return res.status(400).json({ error: 'Email ya registrado' });
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const cuenta = await prisma.cuenta.create({
    data: { email: cuentaEmail, passwordHash, rol: 'asesora' },
  });
  await prisma.auditoria.create({
    data: {
      accion: 'auth_force_password_change_required',
      entidad: 'cuenta',
      entidadId: cuenta.id,
      detalles: await detallesConAdminEmail(prisma, adminId, {
        descripcion: 'Cuenta de asesora creada; deberá cambiar la contraseña en el primer acceso.',
        motivo: 'primer_ingreso_asesora',
      }),
      adminId,
    },
  });
  const asesoraData = { cuentaId: cuenta.id, nombre, apellidos, celular: celular || null, email: email ? email.trim().toLowerCase() : null };
  if (Array.isArray(funciones) && funciones.length) asesoraData.funciones = funciones;
  const asesora = await prisma.asesora.create({
    data: asesoraData,
  });
  if (Array.isArray(planIds) && planIds.length) {
    await prisma.planAsesora.createMany({
      data: planIds.map((planId) => ({ asesoraId: asesora.id, planId })),
    });
  }
  res.status(201).json({ ok: true });
});

/** Listar planes (para formularios) */
router.get('/planes', async (_req, res) => {
  const planes = await prisma.plan.findMany();
  res.json({ planes });
});

export { router as adminRouter };
