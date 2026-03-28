/**
 * Sustitución de una semana (lunes = inicio): quién puede dictar y fechas de clase.
 */
import { DateTime } from 'luxon';
import { ZONA_BOLIVIA } from './timezone.js';

export function lunesSemanaBolivia(fecha) {
  const d =
    fecha instanceof Date
      ? DateTime.fromJSDate(fecha, { zone: ZONA_BOLIVIA })
      : DateTime.fromISO(String(fecha).slice(0, 10), { zone: ZONA_BOLIVIA });
  const mondayOffset = d.weekday - 1;
  return d.minus({ days: mondayOffset }).startOf('day');
}

/** El lunes debe ser día 1 (Lun) en el calendario enviado. */
export function esLunesBolivia(fecha) {
  const d =
    fecha instanceof Date
      ? DateTime.fromJSDate(fecha, { zone: ZONA_BOLIVIA })
      : DateTime.fromISO(String(fecha).slice(0, 10), { zone: ZONA_BOLIVIA });
  return d.weekday === 1;
}

/** Fecha concreta de la clase en esa semana (diaSemana 1=L … 6=S). */
export function fechaClaseEnSemana(diaSemana, lunesSemana) {
  const l = lunesSemana instanceof DateTime ? lunesSemana : DateTime.fromJSDate(lunesSemana, { zone: ZONA_BOLIVIA });
  return l.plus({ days: Number(diaSemana) - 1 }).startOf('day');
}

export async function puedeGestionarSesionComoAsesora(prisma, horarioId, asesoraId, fecha) {
  const horario = await prisma.horario.findUnique({ where: { id: horarioId } });
  if (!horario) return { ok: false, horario: null };
  const lunes = lunesSemanaBolivia(fecha).toJSDate();
  const sub = await prisma.sustitucionSemanal.findUnique({
    where: { horarioId_semanaInicio: { horarioId, semanaInicio: lunes } },
  });
  if (sub) {
    if (sub.asesoraSustitutaId === asesoraId) return { ok: true, horario, rol: 'sustituta', sustitucion: sub };
    return { ok: false, horario, motivo: 'sustitucion_activa', sustitucion: sub };
  }
  if (horario.asesoraId === asesoraId) return { ok: true, horario, rol: 'titular' };
  return { ok: false, horario };
}
