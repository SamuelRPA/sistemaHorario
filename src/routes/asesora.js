import express from 'express';
import { requireAuth } from '../lib/auth.js';
import { PrismaClient } from '@prisma/client';
import { pasaron24Horas, fechaHoraFinSesion, inicioDiaBoliviaJSDate } from '../lib/timezone.js';
import { nowBolivia } from '../lib/timezone.js';
import { puedeGestionarSesionComoAsesora, lunesSemanaBolivia, esLunesBolivia } from '../lib/sustitucionSemanal.js';
import {
  parseLunesSemanaQuery,
  alumnosEfectivosPorHorario,
  filasInscripcionParaSemana,
} from '../lib/inscripcionesSemana.js';

const prisma = new PrismaClient();
const router = express.Router();

/** IDs de materias (lectura_dinamica, …) desde Json del usuario */
function funcionesUsuario(u) {
  const f = u?.funciones;
  if (f == null) return [];
  if (Array.isArray(f)) return f.filter(Boolean);
  if (typeof f === 'object') return Object.values(f).filter(Boolean);
  return [];
}

router.use(requireAuth(['asesora']));

/** Horario completo de la asesora (L-S) con slots marcados + sustituciones (titular ve quién cubre; sustituta ve qué cubre) */
router.get('/horarios', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  if (!asesoraId) return res.status(403).json({ error: 'No es asesora' });
  const lunesHoy = lunesSemanaBolivia(new Date()).toJSDate();
  const lunesParam = parseLunesSemanaQuery(req.query.lunesSemana);
  const horariosRaw = await prisma.horario.findMany({
    where: { asesoraId },
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    include: { _count: { select: { inscripciones: { where: { estado: 'activa' } } } } },
  });
  let horarios = horariosRaw;
  if (lunesParam) {
    const ids = horariosRaw.map((h) => h.id);
    const map = await alumnosEfectivosPorHorario(prisma, ids, lunesParam);
    horarios = horariosRaw.map((h) => ({
      ...h,
      alumnosEfectivosSemana: map.get(h.id)?.size ?? 0,
    }));
  }
  const sustitucionesComoSustituta = await prisma.sustitucionSemanal.findMany({
    where: { asesoraSustitutaId: asesoraId, semanaInicio: { gte: lunesHoy } },
    include: {
      horario: {
        include: {
          asesora: { select: { id: true, nombre: true, apellidos: true } },
          _count: { select: { inscripciones: { where: { estado: 'activa' } } } },
        },
      },
    },
    orderBy: { semanaInicio: 'asc' },
  });
  const sustitucionesComoTitular = await prisma.sustitucionSemanal.findMany({
    where: { horario: { asesoraId }, semanaInicio: { gte: lunesHoy } },
    include: {
      asesoraSustituta: { select: { id: true, nombre: true, apellidos: true } },
      horario: { select: { id: true, diaSemana: true, horaInicio: true, horaFin: true, modalidad: true } },
    },
    orderBy: { semanaInicio: 'asc' },
  });
  const toIso = (d) => (d && typeof d.toISOString === 'function' ? d.toISOString().slice(0, 10) : null);
  res.json({
    horarios,
    sustitucionesComoSustituta: sustitucionesComoSustituta.map((s) => ({
      id: s.id,
      horarioId: s.horarioId,
      semanaInicio: toIso(s.semanaInicio),
      horario: s.horario,
    })),
    sustitucionesComoTitular: sustitucionesComoTitular.map((s) => ({
      id: s.id,
      horarioId: s.horarioId,
      semanaInicio: toIso(s.semanaInicio),
      sustituta: s.asesoraSustituta,
      horario: s.horario,
    })),
  });
});

/** Alumnos de una sesión (por horario + fecha). Incluye avance clase anterior */
router.get('/sesion/:horarioId/alumnos', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const { horarioId } = req.params;
  const { fecha } = req.query; // YYYY-MM-DD
  if (!asesoraId || !horarioId || !fecha) return res.status(400).json({ error: 'horarioId y fecha requeridos' });
  const fechaDate = new Date(fecha + 'T12:00:00.000Z');
  const auth = await puedeGestionarSesionComoAsesora(prisma, horarioId, asesoraId, fechaDate);
  if (!auth.ok) {
    if (auth.motivo === 'sustitucion_activa' && auth.sustitucion) {
      return res.status(403).json({
        error: 'Esta semana este horario lo cubre la asesora sustituta. Solo ella puede registrar la sesión.',
        codigo: 'sustitucion_activa',
      });
    }
    return res.status(404).json({ error: 'Horario no encontrado' });
  }
  const horario = await prisma.horario.findUnique({
    where: { id: horarioId },
    include: { asesora: true },
  });
  const lunesSesion = lunesSemanaBolivia(fechaDate).toJSDate();
  const filas = await filasInscripcionParaSemana(prisma, horarioId, lunesSesion);
  const usuarioIdsSesion = filas.map((r) => r.usuario.id);
  let sesion = await prisma.sesion.findFirst({
    where: { horarioId, fecha: fechaDate },
    include: { asistencias: { include: { usuario: true } } },
  });
  if (!sesion && filas.length > 0) {
    const fin = fechaHoraFinSesion(fechaDate, horario.horaFin);
    const createData = { horarioId, fecha: fechaDate, fechaHoraFin: fin.toJSDate() };
    if (auth.rol === 'sustituta') createData.asesoraEfectivaId = asesoraId;
    sesion = await prisma.sesion.create({
      data: createData,
      include: { asistencias: { include: { usuario: true } } },
    });
    await prisma.auditoria.create({
      data: {
        accion: 'asesora_sesion_creada_auto',
        entidad: 'sesion',
        entidadId: sesion.id,
        asesoraId,
        detalles: {
          descripcion: 'Se creó automáticamente una sesión para esa fecha (al abrir alumnos) porque aún no existía.',
          horarioId,
          fecha: fechaDate.toISOString().slice(0, 10),
          rolSesion: auth.rol,
          asesoraEfectivaId: createData.asesoraEfectivaId ?? null,
        },
      },
    });
  }
  const fechaHoraFinCalculada = sesion ? sesion.fechaHoraFin : fechaHoraFinSesion(fecha, horario.horaFin).toJSDate();
  const puedeEditar = !pasaron24Horas(fechaHoraFinCalculada);
  const avanceAnteriorMap = {};
  if (usuarioIdsSesion.length) {
    const sesionAnterior = await prisma.sesion.findFirst({
      where: {
        horarioId,
        fecha: { lt: fechaDate },
      },
      orderBy: { fecha: 'desc' },
      include: { asistencias: { where: { usuarioId: { in: usuarioIdsSesion } }, include: { usuario: true } } },
    });
    if (sesionAnterior) {
      for (const a of sesionAnterior.asistencias) {
        avanceAnteriorMap[a.usuarioId] = a.avance;
      }
    }
  }

  /** Estimación: suponemos que el alumno asistirá cada sesión restante (no falta ni una). */
  const scheduleByUsuario = {};
  const horariosActivosDelAsesor = usuarioIdsSesion.length
    ? await prisma.inscripcionHorario.findMany({
      where: {
        usuarioId: { in: usuarioIdsSesion },
        estado: 'activa',
        OR: [{ horario: { asesoraId } }, { horarioId }],
      },
      include: { horario: true },
    })
    : [];

  for (const ins of horariosActivosDelAsesor) {
    const uid = ins.usuarioId;
    scheduleByUsuario[uid] = scheduleByUsuario[uid] || [];
    scheduleByUsuario[uid].push({
      diaSemana: ins.horario.diaSemana,
      horaInicio: ins.horario.horaInicio,
      horaFin: ins.horario.horaFin,
    });
  }
  for (const row of filas) {
    if (row.origen === 'solo_semana' && !scheduleByUsuario[row.usuario.id]?.length) {
      scheduleByUsuario[row.usuario.id] = [
        {
          diaSemana: horario.diaSemana,
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
        },
      ];
    }
  }

  function parseHora(hora) {
    const [hh, mm] = String(hora || '00:00').split(':').map(Number);
    return { hh: Number.isFinite(hh) ? hh : 0, mm: Number.isFinite(mm) ? mm : 0 };
  }

  function siguienteOcurrencia(now, diaSemana, horaInicio) {
    const { hh, mm } = parseHora(horaInicio);
    const targetWeekday = Number(diaSemana) || 1; // 1-6 (L-S)
    const base = now.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
    let daysAhead = (targetWeekday - now.weekday + 7) % 7;
    if (daysAhead === 0 && base <= now) daysAhead = 7;
    return now.plus({ days: daysAhead }).set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
  }

  function calcularFechaEstimFin({ items, horasSaldo, clasesPorSemana }) {
    const saldo = Number(horasSaldo) || 0;
    if (!saldo || !Array.isArray(items) || items.length === 0) return null;

    const sesionesPorSemanaBase = Number(clasesPorSemana);
    const sesionesPorSemana = Number.isFinite(sesionesPorSemanaBase) && sesionesPorSemanaBase > 0
      ? Math.min(items.length, Math.floor(sesionesPorSemanaBase))
      : items.length;

    const now = nowBolivia();
    const estados = items.map((it) => {
      const { hh: endH, mm: endM } = parseHora(it.horaFin);
      return {
        nextStart: siguienteOcurrencia(now, it.diaSemana, it.horaInicio),
        endH,
        endM,
      };
    });

    const countByWeek = {};
    let aceptadas = 0;
    let ultimoEnd = null;
    const maxIters = saldo * 20 + 50;
    let iters = 0;

    while (aceptadas < saldo && iters < maxIters) {
      iters += 1;
      let idxMin = 0;
      for (let j = 1; j < estados.length; j += 1) {
        if (estados[j].nextStart < estados[idxMin].nextStart) idxMin = j;
      }
      const candidato = estados[idxMin];
      const start = candidato.nextStart;
      const weekKey = start.startOf('week').toISODate();

      countByWeek[weekKey] = countByWeek[weekKey] || 0;
      if (countByWeek[weekKey] < sesionesPorSemana) {
        countByWeek[weekKey] += 1;
        const end = start.set({ hour: candidato.endH, minute: candidato.endM, second: 0, millisecond: 0 });
        ultimoEnd = end;
        aceptadas += 1;
      }

      estados[idxMin] = { ...candidato, nextStart: candidato.nextStart.plus({ days: 7 }) };
    }

    return ultimoEnd ? ultimoEnd.toFormat('dd/LL/yyyy') : null;
  }

  const alumnos = filas.map((row) => {
    const u = row.usuario;
    const asist = sesion?.asistencias?.find((a) => a.usuarioId === u.id);
    const horasRestantes = u.horasSaldo ?? 0;
    const fechaEstimadaFin = calcularFechaEstimFin({
      items: scheduleByUsuario[u.id] || [],
      horasSaldo: horasRestantes,
      clasesPorSemana: u.clasesPorSemana,
    });
    return {
      usuarioId: u.id,
      nombre: u.nombre,
      apellidos: u.apellidos,
      funciones: funcionesUsuario(u),
      alcance: row.origen,
      horasRestantes,
      fechaEstimadaFin,
      avanceClaseAnterior: avanceAnteriorMap[u.id] ?? null,
      presente: asist?.presente ?? null,
      avance: asist?.avance ?? null,
      observaciones: asist?.observaciones ?? null,
      enviadoRevision: asist?.enviadoRevision ?? false,
    };
  });
  res.json({
    sesionId: sesion?.id ?? null,
    rolSesion: auth.rol,
    fechaHoraFin: new Date(sesion?.fechaHoraFin || fechaHoraFinSesion(fecha, horario.horaFin).toJSDate()).toISOString(),
    puedeEditarAsistencia: puedeEditar,
    alumnos,
  });
});

/** Marcar todos presentes (solo si no pasaron 24h) */
router.post('/sesion/:sesionId/marcar-todos-presentes', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const { sesionId } = req.params;
  const sesion = await prisma.sesion.findFirst({
    where: { id: sesionId },
    include: { horario: true },
  });
  if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
  const auth = await puedeGestionarSesionComoAsesora(prisma, sesion.horarioId, asesoraId, sesion.fecha);
  if (!auth.ok) return res.status(404).json({ error: 'Sesión no encontrada' });
  if (pasaron24Horas(sesion.fechaHoraFin)) return res.status(400).json({ error: 'Pasaron más de 24 horas, no se puede modificar asistencia' });
  const lunesMarcar = lunesSemanaBolivia(sesion.fecha).toJSDate();
  const filasMarcar = await filasInscripcionParaSemana(prisma, sesion.horarioId, lunesMarcar);
  const inscripciones = filasMarcar.map((r) => ({ usuarioId: r.usuario.id }));
  for (const { usuarioId } of inscripciones) {
    await prisma.asistenciaSesion.upsert({
      where: { sesionId_usuarioId: { sesionId, usuarioId } },
      create: { sesionId, usuarioId, presente: true },
      update: { presente: true },
    });
  }
  const usuarioIds = inscripciones.map((i) => i.usuarioId);
  await prisma.usuario.updateMany({
    where: { id: { in: usuarioIds } },
    data: { horasSaldo: { decrement: 1 } },
  });
  await prisma.sesion.update({
    where: { id: sesionId },
    data: {
      pasoClaseAsesora: true,
      timestampAsistencia: nowBolivia().toJSDate(),
      ...(auth.rol === 'sustituta' ? { asesoraEfectivaId: asesoraId } : {}),
    },
  });
  await prisma.auditoria.create({
    data: {
      accion: 'asesora_marca_todos_presentes',
      entidad: 'sesion',
      entidadId: sesionId,
      detalles: {
        descripcion: 'La asesora marcó a todos los alumnos presentes en la sesión y descontó horas de saldo.',
        horarioId: sesion.horarioId,
        fecha: sesion.fecha.toISOString().slice(0, 10),
        alumnosMarcados: inscripciones.length,
        rolSesion: auth.rol,
        asesoraEfectivaId: sesion.asesoraEfectivaId ?? (auth.rol === 'sustituta' ? asesoraId : sesion.horario?.asesoraId ?? null),
      },
      asesoraId,
    },
  });
  res.json({ ok: true });
});

/** Actualizar asistencia/avance/observaciones de un alumno en una sesión (solo dentro de 24h) */
router.put('/sesion/:sesionId/alumno/:usuarioId', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const { sesionId, usuarioId } = req.params;
  const { presente, avance, observaciones, enviadoRevision } = req.body || {};
  const sesion = await prisma.sesion.findFirst({
    where: { id: sesionId },
    include: { horario: true },
  });
  if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
  const auth = await puedeGestionarSesionComoAsesora(prisma, sesion.horarioId, asesoraId, sesion.fecha);
  if (!auth.ok) return res.status(404).json({ error: 'Sesión no encontrada' });
  if (pasaron24Horas(sesion.fechaHoraFin)) {
    return res.status(400).json({ error: 'Pasaron más de 24 horas, no se puede modificar asistencia ni avance' });
  }
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const prev = await prisma.asistenciaSesion.findUnique({
    where: { sesionId_usuarioId: { sesionId, usuarioId } },
  });
  const data = {};
  if (typeof presente === 'boolean') data.presente = presente;
  if (avance !== undefined) data.avance = avance;
  if (observaciones !== undefined) data.observaciones = observaciones;
  if (enviadoRevision !== undefined) data.enviadoRevision = enviadoRevision;
  await prisma.asistenciaSesion.upsert({
    where: { sesionId_usuarioId: { sesionId, usuarioId } },
    create: { sesionId, usuarioId, ...data },
    update: data,
  });
  if (presente === true && (!prev || prev.presente !== true)) {
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { horasSaldo: { decrement: 1 } },
    });
  }
  await prisma.sesion.update({
    where: { id: sesionId },
    data: {
      pasoClaseAsesora: true,
      timestampAsistencia: nowBolivia().toJSDate(),
      ...(auth.rol === 'sustituta' ? { asesoraEfectivaId: asesoraId } : {}),
    },
  });
  await prisma.auditoria.create({
    data: {
      accion: 'asesora_registra_asistencia_alumno',
      entidad: 'asistencia_sesion',
      entidadId: `${sesionId}_${usuarioId}`,
      detalles: {
        descripcion: 'La asesora registró asistencia, avance u observaciones de un alumno en una sesión.',
        sesionId,
        usuarioId,
        presente: data.presente ?? prev?.presente,
        cambioPresente:
          typeof presente === 'boolean' ? (prev ? presente !== prev.presente : true) : undefined,
        fecha: sesion.fecha.toISOString().slice(0, 10),
        rolSesion: auth.rol,
        asesoraEfectivaId: sesion.asesoraEfectivaId ?? (auth.rol === 'sustituta' ? asesoraId : sesion.horario?.asesoraId ?? null),
      },
      asesoraId,
      usuarioId,
    },
  });
  res.json({ ok: true });
});

/** Crear sesión si no existe (para un día) */
router.post('/sesion', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const { horarioId, fecha } = req.body || {};
  if (!horarioId || !fecha) return res.status(400).json({ error: 'horarioId y fecha requeridos' });
  const fechaDate = new Date(fecha + 'T12:00:00.000Z');
  const auth = await puedeGestionarSesionComoAsesora(prisma, horarioId, asesoraId, fechaDate);
  if (!auth.ok) {
    if (auth.motivo === 'sustitucion_activa') {
      return res.status(403).json({ error: 'Esta semana cubre la sustituta.', codigo: 'sustitucion_activa' });
    }
    return res.status(404).json({ error: 'Horario no encontrado' });
  }
  const horario = auth.horario;
  const fechaHoraFin = fechaHoraFinSesion(fechaDate, horario.horaFin);
  let sesion = await prisma.sesion.findFirst({
    where: { horarioId, fecha: fechaDate },
  });
  if (!sesion) {
    const data = { horarioId, fecha: fechaDate, fechaHoraFin: fechaHoraFin.toJSDate() };
    if (auth.rol === 'sustituta') data.asesoraEfectivaId = asesoraId;
    sesion = await prisma.sesion.create({ data });
  }
  res.json(sesion);
});

const FUNCIONES_VALIDAS = ['lectura_dinamica', 'aprende_a_leer', 'nivelacion', 'matematicas'];

/** Guardar slots disponibles: la asesora marca celdas y elige modalidad y funciones (materias). Solo esos slots quedarán disponibles; el alumno solo ve horarios de su función y su modalidad. */
router.put('/horarios/slots', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  if (!asesoraId) return res.status(403).json({ error: 'No es asesora' });
  const { slots, modalidad, funciones } = req.body || {};
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'Se requiere slots (array de { diaSemana, horaInicio })' });

  const slotSet = new Set(slots.map((s) => `${s.diaSemana}-${s.horaInicio}`));

  function nextHour(h) {
    const [hh, mm] = (h || '09:00').split(':').map(Number);
    const next = (hh + 1) % 24;
    return `${String(next).padStart(2, '0')}:00`;
  }

  const asesora = await prisma.asesora.findUnique({ where: { id: asesoraId }, select: { funciones: true } });
  const asesoraFunciones = Array.isArray(asesora?.funciones) ? asesora.funciones : [];
  if (asesoraFunciones.length === 0) return res.status(400).json({ error: 'Asigna funciones (materias) en tu perfil primero' });

  /** Fallback si el cliente no envía modalidad por slot (compatibilidad API antigua). */
  const modalidadGlobal = modalidad === 'presencial' || modalidad === 'online' ? modalidad : 'online';
  const funcionesFinal = Array.isArray(funciones) && funciones.length > 0
    ? funciones.filter((f) => FUNCIONES_VALIDAS.includes(f) && asesoraFunciones.includes(f))
    : asesoraFunciones;
  if (funcionesFinal.length === 0) return res.status(400).json({ error: 'Elige al menos una función (materia) asignada a ti' });

  const horarios = await prisma.horario.findMany({ where: { asesoraId } });

  for (const s of slots) {
    const { diaSemana, horaInicio } = s;
    if (diaSemana == null || !horaInicio) continue;
    const modalidadSlot =
      s.modalidad === 'presencial' || s.modalidad === 'online' ? s.modalidad : modalidadGlobal;
    const existente = horarios.find((h) => h.diaSemana === diaSemana && h.horaInicio === horaInicio);
    if (existente) {
      await prisma.horario.update({
        where: { id: existente.id },
        data: { cerrado: false, modalidad: modalidadSlot, funciones: funcionesFinal },
      });
    } else {
      const horaFin = nextHour(horaInicio);
      await prisma.horario.create({
        data: {
          asesoraId,
          diaSemana: Number(diaSemana),
          horaInicio: String(horaInicio),
          horaFin,
          modalidad: modalidadSlot,
          funciones: funcionesFinal,
          cerrado: false,
          capacidadMax: 8,
        },
      });
    }
  }

  for (const h of horarios) {
    const key = `${h.diaSemana}-${h.horaInicio}`;
    if (!slotSet.has(key)) await prisma.horario.update({ where: { id: h.id }, data: { cerrado: true } });
  }

  const inicioConteo = inicioDiaBoliviaJSDate();
  await prisma.asesora.update({
    where: { id: asesoraId },
    data: { fechaConteoHorasDesde: inicioConteo },
  });

  const asesoraNombre = await prisma.asesora.findUnique({
    where: { id: asesoraId },
    select: { nombre: true, apellidos: true },
  });
  await prisma.auditoria.create({
    data: {
      accion: 'asesora_confirma_horarios_disponibles',
      entidad: 'asesora',
      entidadId: asesoraId,
      detalles: {
        descripcion: 'La asesora confirmó o actualizó sus horarios disponibles (cuadro semanal). Desde esta fecha cuentan las horas en reportes para el administrador.',
        slotsActivos: slots.length,
        fechaInicioConteoHoras: inicioConteo.toISOString().slice(0, 10),
        materias: funcionesFinal,
        asesoraNombre: asesoraNombre ? `${asesoraNombre.nombre} ${asesoraNombre.apellidos}`.trim() : null,
      },
      asesoraId,
    },
  });

  res.json({ ok: true, fechaConteoHorasDesde: inicioConteo });
});

/** Editar horario: cerrar, cambiar dia/hora, link Zoom, exceder alumnos */
router.get('/horario/:horarioId', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const horario = await prisma.horario.findFirst({
    where: { id: req.params.horarioId, asesoraId },
    include: { inscripciones: { where: { estado: 'activa' }, include: { usuario: { include: { plan: true } } } } },
  });
  if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });
  res.json(horario);
});

router.patch('/horario/:horarioId', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const { horarioId } = req.params;
  const { cerrado, diaSemana, horaInicio, horaFin, linkZoom, capacidadMax } = req.body || {};
  const horario = await prisma.horario.findFirst({ where: { id: horarioId, asesoraId } });
  if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });
  const data = {};
  if (typeof cerrado === 'boolean') data.cerrado = cerrado;
  if (diaSemana != null) data.diaSemana = diaSemana;
  if (horaInicio != null) data.horaInicio = horaInicio;
  if (horaFin != null) data.horaFin = horaFin;
  if (linkZoom !== undefined) data.linkZoom = linkZoom;
  if (capacidadMax != null) data.capacidadMax = capacidadMax;
  await prisma.horario.update({ where: { id: horarioId }, data });
  const campos = Object.keys(data);
  if (campos.length) {
    await prisma.auditoria.create({
      data: {
        accion: 'asesora_edita_horario',
        entidad: 'horario',
        entidadId: horarioId,
        detalles: {
          descripcion: `La asesora modificó el horario: ${campos.join(', ')}.`,
          campos,
          valores: data,
          diaSemana: horario.diaSemana,
          horaInicio: horario.horaInicio,
        },
        asesoraId,
      },
    });
  }
  res.json({ ok: true });
});

/** Añadir alumno a horario. Body: usuarioId, alcance: 'permanente' | 'solo_semana', lunesSemana (YYYY-MM-DD lunes) si solo_semana */
router.post('/horario/:horarioId/alumnos', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const { horarioId } = req.params;
  const { usuarioId, alcance, lunesSemana: lunesBody } = req.body || {};
  const horario = await prisma.horario.findFirst({ where: { id: horarioId, asesoraId } });
  if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

  const usuario = await prisma.usuario.findFirst({ where: { id: usuarioId, activo: true } });
  if (!usuario) return res.status(400).json({ error: 'Alumno no encontrado o está inactivo' });

  const esSoloSemana = alcance === 'solo_semana';
  let lunesJS = null;
  if (esSoloSemana) {
    const raw = lunesBody ? new Date(String(lunesBody).slice(0, 10) + 'T12:00:00.000Z') : null;
    if (!raw || !esLunesBolivia(raw)) {
      return res.status(400).json({ error: 'Para inscripción solo esta semana indica lunesSemana (YYYY-MM-DD, día lunes).' });
    }
    lunesJS = lunesSemanaBolivia(raw).startOf('day').toJSDate();
    const permanente = await prisma.inscripcionHorario.findFirst({
      where: { usuarioId, horarioId, estado: 'activa' },
    });
    if (permanente) {
      return res.status(400).json({ error: 'Este alumno ya está inscrito de forma permanente en este horario.' });
    }
  } else {
    await prisma.inscripcionHorarioSemana.deleteMany({ where: { usuarioId, horarioId } });
  }

  const lunesRef = esSoloSemana ? lunesJS : lunesSemanaBolivia(new Date()).toJSDate();
  const map = await alumnosEfectivosPorHorario(prisma, [horarioId], lunesRef);
  const nEfectivos = map.get(horarioId)?.size ?? 0;

  if (esSoloSemana) {
    const yaSem = await prisma.inscripcionHorarioSemana.findUnique({
      where: { usuarioId_horarioId_lunesSemana: { usuarioId, horarioId, lunesSemana: lunesJS } },
    });
    if (!yaSem && nEfectivos >= horario.capacidadMax) {
      return res.status(400).json({ error: `Sin cupo en este horario para esa semana (máx. ${horario.capacidadMax}).` });
    }
  } else {
    const yaPerm = await prisma.inscripcionHorario.findFirst({ where: { usuarioId, horarioId, estado: 'activa' } });
    if (!yaPerm && nEfectivos >= horario.capacidadMax) {
      return res.status(400).json({ error: `Cupo lleno (máximo ${horario.capacidadMax}). Ajusta el cupo si necesitas.` });
    }
  }

  if (esSoloSemana) {
    const ins = await prisma.inscripcionHorarioSemana.upsert({
      where: { usuarioId_horarioId_lunesSemana: { usuarioId, horarioId, lunesSemana: lunesJS } },
      create: { usuarioId, horarioId, lunesSemana: lunesJS, estado: 'activa' },
      update: { estado: 'activa' },
      select: { id: true },
    });
    await prisma.auditoria.create({
      data: {
        accion: 'asesora_agrega_alumno_horario',
        entidad: 'inscripcion_horario_semana',
        entidadId: ins.id,
        detalles: {
          descripcion: 'La asesora inscribió a un alumno solo para una semana en un horario.',
          horarioId,
          lunesSemana: lunesJS.toISOString().slice(0, 10),
          alcance: 'solo_semana',
        },
        asesoraId,
        usuarioId,
      },
    });
    return res.json({ ok: true, alcance: 'solo_semana' });
  }

  const ins = await prisma.inscripcionHorario.upsert({
    where: { usuarioId_horarioId: { usuarioId, horarioId } },
    create: { usuarioId, horarioId, estado: 'activa' },
    update: { estado: 'activa' },
    select: { id: true },
  });
  await prisma.auditoria.create({
    data: {
      accion: 'asesora_agrega_alumno_horario',
      entidad: 'inscripcion_horario',
      entidadId: ins.id,
      detalles: {
        descripcion: 'La asesora inscribió a un alumno de forma permanente en un horario.',
        horarioId,
        diaSemana: horario?.diaSemana,
        horaInicio: horario?.horaInicio,
        horaFin: horario?.horaFin,
        alcance: 'permanente',
      },
      asesoraId,
      usuarioId,
    },
  });
  res.json({ ok: true, alcance: 'permanente' });
});

/** Listar alumnos inscritos en un horario (solo alumnos activos). Query lunesSemana=YYYY-MM-DD (lunes) para esa semana; si no, semana actual. */
router.get('/horario/:horarioId/alumnos', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const { horarioId } = req.params;

  const horario = await prisma.horario.findFirst({ where: { id: horarioId, asesoraId } });
  if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

  const lunesJS = parseLunesSemanaQuery(req.query.lunesSemana) || lunesSemanaBolivia(new Date()).toJSDate();
  const filas = await filasInscripcionParaSemana(prisma, horarioId, lunesJS);

  const alumnos = filas.map((row) => ({
    usuarioId: row.usuario.id,
    nombre: row.usuario.nombre,
    apellidos: row.usuario.apellidos,
    funciones: funcionesUsuario(row.usuario),
    alcance: row.origen,
    inscripcionSemanaId: row.inscripcionSemanaId,
  }));

  res.json({ alumnos, lunesSemana: lunesJS.toISOString().slice(0, 10) });
});

/** Historial del alumno (para que la asesora vea fechas, avance y observaciones) */
router.get('/alumno/:usuarioId/historial', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const { usuarioId } = req.params;
  if (!asesoraId) return res.status(403).json({ error: 'No es asesora' });

  const historial = await prisma.asistenciaSesion.findMany({
    where: {
      usuarioId,
      sesion: {
        OR: [{ horario: { asesoraId } }, { asesoraEfectivaId: asesoraId }],
      },
    },
    include: {
      sesion: {
        include: {
          horario: {
            include: { asesora: true },
          },
          asesoraEfectiva: true,
        },
      },
    },
    orderBy: {
      sesion: { fecha: 'desc' },
    },
    take: 200,
  });

  res.json({
    historial: historial.map((a) => ({
      fecha: a.sesion.fecha,
      modalidad: a.sesion.horario.modalidad,
      horaInicio: a.sesion.horario.horaInicio,
      horaFin: a.sesion.horario.horaFin,
      asesora: (() => {
        const ef = a.sesion.asesoraEfectiva;
        const tit = a.sesion.horario.asesora;
        const p = ef || tit;
        return p ? `${p.nombre} ${p.apellidos}` : null;
      })(),
      presente: a.presente,
      avance: a.avance,
      observaciones: a.observaciones,
    })),
  });
});

/** Quitar alumno. Query lunesSemana=YYYY-MM-DD: solo quita inscripción de esa semana; sin query, baja permanente. */
router.delete('/horario/:horarioId/alumnos/:usuarioId', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const { horarioId, usuarioId } = req.params;
  const lunesQ = parseLunesSemanaQuery(req.query.lunesSemana);

  const horario = await prisma.horario.findFirst({ where: { id: horarioId, asesoraId } });
  if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

  if (lunesQ) {
    const row = await prisma.inscripcionHorarioSemana.findUnique({
      where: { usuarioId_horarioId_lunesSemana: { usuarioId, horarioId, lunesSemana: lunesQ } },
    });
    if (row) {
      await prisma.inscripcionHorarioSemana.delete({ where: { id: row.id } });
      await prisma.auditoria.create({
        data: {
          accion: 'asesora_quita_alumno_horario',
          entidad: 'inscripcion_horario_semana',
          entidadId: row.id,
          detalles: {
            descripcion: 'La asesora quitó a un alumno de un horario solo para esa semana.',
            horarioId,
            lunesSemana: lunesQ.toISOString().slice(0, 10),
          },
          asesoraId,
          usuarioId,
        },
      });
    }
    return res.json({ ok: true });
  }

  const ins = await prisma.inscripcionHorario.findFirst({
    where: { horarioId, usuarioId },
    select: { id: true },
  });
  await prisma.inscripcionHorario.updateMany({
    where: { horarioId, usuarioId },
    data: { estado: 'baja' },
  });
  await prisma.inscripcionHorarioSemana.deleteMany({ where: { horarioId, usuarioId } });
  if (ins?.id) {
    await prisma.auditoria.create({
      data: {
        accion: 'asesora_quita_alumno_horario',
        entidad: 'inscripcion_horario',
        entidadId: ins.id,
        detalles: {
          descripcion: 'La asesora dio de baja permanente a un alumno de uno de sus horarios.',
          horarioId,
          diaSemana: horario?.diaSemana,
          horaInicio: horario?.horaInicio,
          horaFin: horario?.horaFin,
        },
        asesoraId,
        usuarioId,
      },
    });
  }

  res.json({ ok: true });
});

/** Buscar alumnos activos por nombre/apellidos (para agregar a horarios) */
router.get('/alumnos', async (req, res) => {
  const _asesoraId = req.auth.asesoraId;
  const { busqueda } = req.query;

  const term = String(busqueda || '').trim();
  const donde = term
    ? {
        activo: true,
        OR: [
          { nombre: { contains: term, mode: 'insensitive' } },
          { apellidos: { contains: term, mode: 'insensitive' } },
        ],
      }
    : { activo: true };

  const usuarios = await prisma.usuario.findMany({
    where: donde,
    orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
    take: 50,
  });

  res.json({
    alumnos: usuarios.map((u) => ({
      usuarioId: u.id,
      nombre: u.nombre,
      apellidos: u.apellidos,
      funciones: funcionesUsuario(u),
    })),
  });
});

/** Listar planes (para formulario de perfil) */
router.get('/planes', async (_req, res) => {
  const planes = await prisma.plan.findMany();
  res.json({ planes });
});

/** Perfil asesora: planes y datos personales */
router.get('/perfil', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const asesora = await prisma.asesora.findUnique({
    where: { id: asesoraId },
    include: { planesAsesora: { include: { plan: true } } },
  });
  if (!asesora) return res.status(404).json({ error: 'Asesora no encontrada' });
  res.json(asesora);
});

router.patch('/perfil', async (req, res) => {
  const asesoraId = req.auth.asesoraId;
  const { nombre, apellidos, celular, email, linkZoomGlobal, planIds, funciones } = req.body || {};
  const data = {};
  if (nombre != null) data.nombre = nombre;
  if (apellidos != null) data.apellidos = apellidos;
  if (celular !== undefined) data.celular = celular;
  if (email !== undefined) data.email = email;
  if (linkZoomGlobal !== undefined) data.linkZoomGlobal = linkZoomGlobal;
  if (Array.isArray(funciones)) data.funciones = funciones;
  await prisma.asesora.update({ where: { id: asesoraId }, data });
  if (Array.isArray(planIds)) {
    await prisma.planAsesora.deleteMany({ where: { asesoraId } });
    if (planIds.length) {
      await prisma.planAsesora.createMany({
        data: planIds.map((planId) => ({ asesoraId, planId })),
      });
    }
  }
  const cambios = Object.keys(data).concat(Array.isArray(planIds) ? ['planIds'] : []);
  if (cambios.length) {
    await prisma.auditoria.create({
      data: {
        accion: 'asesora_edita_perfil',
        entidad: 'asesora',
        entidadId: asesoraId,
        detalles: {
          descripcion: 'La asesora actualizó su perfil, planes o materias.',
          campos: cambios,
        },
        asesoraId,
      },
    });
  }
  res.json({ ok: true });
});

export { router as asesoraRouter };
