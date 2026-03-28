import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { PrismaClient } from '@prisma/client';
import { toZonaUsuario } from '../lib/timezone.js';
import { computeEstadoCuotas } from '../lib/cuotas.js';
import { lunesSemanaBolivia } from '../lib/sustitucionSemanal.js';
import { alumnosEfectivosPorHorario } from '../lib/inscripcionesSemana.js';

const prisma = new PrismaClient();
const router = express.Router();

router.use(requireAuth(['usuario']));

/** Horario del usuario (L-S) con slots marcados donde tiene clase */
router.get('/horario', async (req, res) => {
  const usuarioId = req.auth.usuarioId;
  if (!usuarioId) return res.status(403).json({ error: 'No es usuario alumno' });
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: { plan: true },
  });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const lunes = lunesSemanaBolivia(new Date()).toJSDate();
  const inscripciones = await prisma.inscripcionHorario.findMany({
    where: { usuarioId, estado: 'activa' },
    include: {
      horario: {
        include: {
          asesora: true,
        },
      },
    },
  });
  const inscripcionesSem = await prisma.inscripcionHorarioSemana.findMany({
    where: { usuarioId, estado: 'activa', lunesSemana: lunes },
    include: {
      horario: {
        include: {
          asesora: true,
        },
      },
    },
  });
  const vistos = new Set(inscripciones.map((i) => i.horarioId));
  const slots = [];
  for (const i of inscripciones) {
    const h = i.horario;
    const esPresencial = h.modalidad === 'presencial';
    const linkZoom =
      esPresencial ? null : h.linkZoom || h.asesora?.linkZoomGlobal || null;
    slots.push({
      horarioId: h.id,
      diaSemana: h.diaSemana,
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
      modalidad: h.modalidad,
      asesora: h.asesora ? { nombre: h.asesora.nombre, apellidos: h.asesora.apellidos } : null,
      linkZoom,
      soloEstaSemana: false,
    });
  }
  for (const s of inscripcionesSem) {
    if (vistos.has(s.horarioId)) continue;
    const h = s.horario;
    const esPresencial = h.modalidad === 'presencial';
    const linkZoom =
      esPresencial ? null : h.linkZoom || h.asesora?.linkZoomGlobal || null;
    slots.push({
      horarioId: h.id,
      diaSemana: h.diaSemana,
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
      modalidad: h.modalidad,
      asesora: h.asesora ? { nombre: h.asesora.nombre, apellidos: h.asesora.apellidos } : null,
      linkZoom,
      soloEstaSemana: true,
    });
  }
  res.json({ usuario: { pais: usuario.pais }, slots });
});

/** Registro de auditoría: el alumno abre el enlace Zoom (solo clases virtuales). */
router.post('/zoom-intento', async (req, res) => {
  const usuarioId = req.auth.usuarioId;
  const { horarioId } = req.body || {};
  if (!usuarioId) return res.status(403).json({ error: 'No es usuario alumno' });
  if (!horarioId) return res.status(400).json({ error: 'horarioId requerido' });
  const lunesZoom = lunesSemanaBolivia(new Date()).toJSDate();
  let ins = await prisma.inscripcionHorario.findFirst({
    where: { usuarioId, horarioId, estado: 'activa' },
    include: { horario: { include: { asesora: true } } },
  });
  if (!ins) {
    const sem = await prisma.inscripcionHorarioSemana.findFirst({
      where: { usuarioId, horarioId, estado: 'activa', lunesSemana: lunesZoom },
      include: { horario: { include: { asesora: true } } },
    });
    if (sem) ins = sem;
  }
  if (!ins) return res.status(404).json({ error: 'No estás inscrito en este horario' });
  const h = ins.horario;
  if (h.modalidad === 'presencial') {
    return res.status(400).json({ error: 'Esta clase es presencial; no hay enlace Zoom' });
  }
  await prisma.auditoria.create({
    data: {
      accion: 'alumno_acceso_link_zoom',
      entidad: 'horario',
      entidadId: horarioId,
      detalles: {
        descripcion: 'El alumno abrió el enlace de videollamada (Zoom) de su clase virtual.',
        modalidad: h.modalidad,
      },
      usuarioId,
    },
  });
  res.json({ ok: true });
});

function funcionesOverlap(horarioFunciones, usuarioFunciones) {
  if (!Array.isArray(horarioFunciones) || horarioFunciones.length === 0) return false;
  if (!Array.isArray(usuarioFunciones) || usuarioFunciones.length === 0) return false;
  return horarioFunciones.some((f) => usuarioFunciones.includes(f));
}

/** Filtro Prisma: alumno con modalidad "ambos" puede usar horarios online o presencial. */
function whereModalidadAlumno(modalidadUsuario) {
  if (modalidadUsuario === 'ambos') {
    return { modalidad: { in: ['online', 'presencial'] } };
  }
  return { modalidad: modalidadUsuario };
}

/** Horarios disponibles para la modalidad y funciones del usuario (Lectura dinámica, Aprende a leer, etc.) */
router.get('/horarios-disponibles', async (req, res) => {
  const usuarioId = req.auth.usuarioId;
  if (!usuarioId) return res.status(403).json({ error: 'No es usuario alumno' });
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: { plan: true },
  });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const usuarioFunciones = Array.isArray(usuario.funciones) ? usuario.funciones : [];
  const horarios = await prisma.horario.findMany({
    where: { cerrado: false, ...whereModalidadAlumno(usuario.modalidad) },
    include: {
      asesora: true,
      _count: { select: { inscripciones: { where: { estado: 'activa' } } } },
    },
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
  });
  const lunesDisp = lunesSemanaBolivia(new Date()).toJSDate();
  const idsH = horarios.map((h) => h.id);
  const cupoMap = await alumnosEfectivosPorHorario(prisma, idsH, lunesDisp);
  const list = horarios
    .filter((h) => funcionesOverlap(h.funciones, usuarioFunciones))
    .map((h) => ({
      id: h.id,
      diaSemana: h.diaSemana,
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
      modalidad: h.modalidad,
      asesora: h.asesora ? { nombre: h.asesora.nombre, apellidos: h.asesora.apellidos } : null,
      cupo: h.capacidadMax - (cupoMap.get(h.id)?.size ?? 0),
    }));
  res.json({ horarios: list });
});

/** Inscribir o cambiar a otro horario */
router.post('/inscripcion', async (req, res) => {
  const usuarioId = req.auth.usuarioId;
  const { horarioId, clasesPorSemana } = req.body || {};
  if (!usuarioId || !horarioId) return res.status(400).json({ error: 'horarioId requerido' });
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: { plan: true } });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const horario = await prisma.horario.findFirst({
    where: { id: horarioId, cerrado: false, ...whereModalidadAlumno(usuario.modalidad) },
    include: { _count: { select: { inscripciones: { where: { estado: 'activa' } } } } },
  });
  if (!horario) return res.status(400).json({ error: 'Horario no encontrado o no coincide con tu modalidad' });
  const usuarioFunciones = Array.isArray(usuario.funciones) ? usuario.funciones : [];
  if (!funcionesOverlap(horario.funciones, usuarioFunciones)) {
    return res.status(400).json({ error: 'Horario no disponible para tu materia (función)' });
  }
  const cupoIns = await alumnosEfectivosPorHorario(prisma, [horarioId], lunesSemanaBolivia(new Date()).toJSDate());
  if ((cupoIns.get(horarioId)?.size ?? 0) >= horario.capacidadMax) {
    return res.status(400).json({ error: 'No hay cupo' });
  }

  if (clasesPorSemana !== undefined) {
    const num = Number(clasesPorSemana);
    if (!Number.isFinite(num) || num <= 0) return res.status(400).json({ error: 'clasesPorSemana inválido' });
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { clasesPorSemana: Math.floor(num) },
    });
  }
  await prisma.inscripcionHorario.upsert({
    where: { usuarioId_horarioId: { usuarioId, horarioId } },
    create: { usuarioId, horarioId, estado: 'activa' },
    update: { estado: 'activa', fechaDesde: new Date() },
  });
  res.json({ ok: true });
});

/** Dar de baja inscripción (salir del horario) — queda registro en auditoría */
router.delete('/inscripcion/:horarioId', async (req, res) => {
  const usuarioId = req.auth.usuarioId;
  const { horarioId } = req.params;
  if (!usuarioId) return res.status(403).end();
  const horario = await prisma.horario.findUnique({ where: { id: horarioId }, include: { asesora: true } });
  const ins = await prisma.inscripcionHorario.findFirst({ where: { usuarioId, horarioId, estado: 'activa' } });
  if (!ins) return res.status(404).json({ error: 'No estás inscrito en este horario' });
  await prisma.inscripcionHorario.updateMany({
    where: { usuarioId, horarioId },
    data: { estado: 'baja' },
  });
  await prisma.inscripcionHorarioSemana.deleteMany({ where: { usuarioId, horarioId } });
  await prisma.auditoria.create({
    data: {
      accion: 'alumno_salida_horario',
      entidad: 'inscripcion_horario',
      entidadId: ins.id,
      detalles: {
        descripcion: 'El alumno se dio de baja de un horario',
        horarioId,
        diaSemana: horario?.diaSemana,
        horaInicio: horario?.horaInicio,
        horaFin: horario?.horaFin,
        asesora: horario?.asesora ? `${horario.asesora.nombre} ${horario.asesora.apellidos}` : null,
      },
      usuarioId,
    },
  });
  res.json({ ok: true });
});

/** Perfil del usuario (datos editables para el formulario) */
router.get('/perfil', async (req, res) => {
  const usuarioId = req.auth.usuarioId;
  if (!usuarioId) return res.status(403).json({ error: 'No es usuario alumno' });
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: { plan: true },
  });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({
    id: usuario.id,
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    celular: usuario.celular ?? '',
    tutorLegal: usuario.tutorLegal ?? '',
    pais: usuario.pais,
    departamento: usuario.departamento ?? '',
    modalidad: usuario.modalidad,
    clasesPorSemana: usuario.clasesPorSemana ?? null,
    plan: usuario.plan,
  });
});

/** Actualizar perfil del usuario (solo campos permitidos) */
router.patch('/perfil', async (req, res) => {
  const usuarioId = req.auth.usuarioId;
  if (!usuarioId) return res.status(403).json({ error: 'No es usuario alumno' });
  const { nombre, apellidos, celular, tutorLegal, departamento, modalidad, clasesPorSemana } = req.body || {};
  const data = {};
  if (typeof nombre === 'string') data.nombre = nombre.trim();
  if (typeof apellidos === 'string') data.apellidos = apellidos.trim();
  if (celular !== undefined) data.celular = celular ? String(celular).trim() : null;
  if (tutorLegal !== undefined) data.tutorLegal = tutorLegal ? String(tutorLegal).trim() : null;
  if (departamento !== undefined) data.departamento = departamento ? String(departamento).trim() : null;
  if (modalidad === 'online' || modalidad === 'presencial' || modalidad === 'ambos') data.modalidad = modalidad;
  if (clasesPorSemana !== undefined) {
    const num = Number(clasesPorSemana);
    if (!Number.isFinite(num) || num <= 0) return res.status(400).json({ error: 'clasesPorSemana inválido' });
    data.clasesPorSemana = Math.floor(num);
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
  await prisma.usuario.update({ where: { id: usuarioId }, data });
  res.json({ ok: true });
});

/** Mi información + horas planeadas + mensualidades + historial de clases */
router.get('/mi-informacion', async (req, res) => {
  const usuarioId = req.auth.usuarioId;
  if (!usuarioId) return res.status(403).json({ error: 'No es usuario alumno' });
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      plan: true,
      mensualidades: { orderBy: [{ anio: 'desc' }, { mes: 'desc' }], take: 24 },
    },
  });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const proximasSesiones = await prisma.sesion.findMany({
    where: {
      fecha: { gte: new Date(new Date().toISOString().slice(0, 10)) },
      horario: { inscripciones: { some: { usuarioId, estado: 'activa' } } },
    },
    include: { horario: { include: { asesora: true } } },
    orderBy: { fecha: 'asc' },
    take: 20,
  });
  const historial = await prisma.asistenciaSesion.findMany({
    where: { usuarioId },
    include: {
      sesion: { include: { horario: { include: { asesora: true } } } },
    },
    orderBy: { sesion: { fecha: 'desc' } },
    take: 50,
  });
  const horasPlaneadas = proximasSesiones.map((s) => ({
    fecha: s.fecha,
    horaInicio: s.horario.horaInicio,
    horaFin: s.horario.horaFin,
    asesora: s.horario.asesora ? `${s.horario.asesora.nombre} ${s.horario.asesora.apellidos}` : null,
  }));
  const cuotasRestantes = usuario.pagoContado
    ? null
    : usuario.cuotasTotales != null
      ? Math.max(0, usuario.cuotasTotales - usuario.mensualidades.filter((m) => m.pagado).length)
      : null;
  const resumenCuotas = computeEstadoCuotas(usuario, usuario.mensualidades);
  res.json({
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      plan: usuario.plan,
      horasSaldo: usuario.horasSaldo,
      observaciones: usuario.observaciones,
      tutorLegal: usuario.tutorLegal,
      pais: usuario.pais,
      departamento: usuario.departamento,
      modalidad: usuario.modalidad,
      celular: usuario.celular,
      email: (await prisma.cuenta.findUnique({ where: { id: usuario.cuentaId } }))?.email,
      fechaRegistro: usuario.fechaRegistro,
      fechaPrimerVencimiento: usuario.fechaPrimerVencimiento
        ? usuario.fechaPrimerVencimiento.toISOString().slice(0, 10)
        : null,
      cuotasTotales: usuario.cuotasTotales,
      montoPorCuota: usuario.montoPorCuota != null ? Number(usuario.montoPorCuota) : null,
      montoTotal: usuario.montoTotal != null ? Number(usuario.montoTotal) : null,
      montoEnganche: usuario.montoEnganche != null ? Number(usuario.montoEnganche) : null,
      pagoContado: usuario.pagoContado,
      funciones: usuario.funciones && Array.isArray(usuario.funciones)
        ? usuario.funciones
        : usuario.funciones && typeof usuario.funciones === 'object'
          ? Object.values(usuario.funciones)
          : [],
    },
    horasPlaneadas,
    mensualidades: usuario.mensualidades,
    cuotasRestantes,
    resumenCuotas,
    historialClases: historial.map((a) => ({
      fecha: a.sesion.fecha,
      asesora: a.sesion.horario?.asesora ? `${a.sesion.horario.asesora.nombre} ${a.sesion.horario.asesora.apellidos}` : null,
      presente: a.presente,
      avance: a.avance,
      observaciones: a.observaciones,
    })),
  });
});

export { router as usuarioRouter };
