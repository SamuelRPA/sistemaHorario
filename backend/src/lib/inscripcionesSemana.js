import { lunesSemanaBolivia } from './sustitucionSemanal.js';

export function parseLunesSemanaQuery(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const d = new Date(String(raw).slice(0, 10) + 'T12:00:00.000Z');
  return Number.isNaN(d.getTime()) ? null : lunesSemanaBolivia(d).startOf('day').toJSDate();
}

/** Usuarios distintos inscritos en el horario para esa semana (permanentes ∪ solo esa semana). */
export async function alumnosEfectivosPorHorario(prisma, horarioIds, lunesJS) {
  if (!horarioIds.length) return new Map();
  const [perms, weeks] = await Promise.all([
    prisma.inscripcionHorario.findMany({
      where: { horarioId: { in: horarioIds }, estado: 'activa' },
      select: { horarioId: true, usuarioId: true },
    }),
    prisma.inscripcionHorarioSemana.findMany({
      where: { horarioId: { in: horarioIds }, lunesSemana: lunesJS, estado: 'activa' },
      select: { horarioId: true, usuarioId: true },
    }),
  ]);
  const map = new Map();
  for (const id of horarioIds) map.set(id, new Set());
  for (const p of perms) map.get(p.horarioId)?.add(p.usuarioId);
  for (const w of weeks) map.get(w.horarioId)?.add(w.usuarioId);
  return map;
}

/**
 * Filas para sesión o listado: permanentes + semanales (sin duplicar usuario).
 * Cada fila: { usuario, origen: 'permanente'|'solo_semana', inscripcionSemanaId? }
 */
export async function filasInscripcionParaSemana(prisma, horarioId, lunesJS) {
  const permanent = await prisma.inscripcionHorario.findMany({
    where: { horarioId, estado: 'activa', usuario: { activo: true } },
    include: { usuario: true },
  });
  const semana = await prisma.inscripcionHorarioSemana.findMany({
    where: { horarioId, lunesSemana: lunesJS, estado: 'activa', usuario: { activo: true } },
    include: { usuario: true },
  });
  const permIds = new Set(permanent.map((p) => p.usuarioId));
  const rows = [];
  for (const p of permanent) {
    rows.push({ usuario: p.usuario, origen: 'permanente', inscripcionSemanaId: null });
  }
  for (const s of semana) {
    if (!permIds.has(s.usuarioId)) {
      rows.push({ usuario: s.usuario, origen: 'solo_semana', inscripcionSemanaId: s.id });
    }
  }
  return rows;
}
