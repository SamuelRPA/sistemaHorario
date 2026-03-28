/**
 * Utilidades de zona horaria - Todo en hora Bolivia (America/La_Paz)
 */
import { DateTime } from 'luxon';

const ZONA_BOLIVIA = 'America/La_Paz';

export function nowBolivia() {
  return DateTime.now().setZone(ZONA_BOLIVIA);
}

/** Inicio del día civil en Bolivia (para conteo de horas desde una fecha). */
export function inicioDiaBolivia(fecha) {
  const base =
    fecha instanceof Date
      ? DateTime.fromJSDate(fecha, { zone: ZONA_BOLIVIA })
      : typeof fecha === 'string'
        ? DateTime.fromISO(String(fecha).slice(0, 10), { zone: ZONA_BOLIVIA })
        : nowBolivia();
  return base.startOf('day');
}

export function inicioDiaBoliviaJSDate(fecha) {
  return inicioDiaBolivia(fecha).toJSDate();
}

export function toBolivia(dt) {
  const d = typeof dt === 'string' || dt instanceof Date ? DateTime.fromJSDate(new Date(dt)) : dt;
  return d.setZone(ZONA_BOLIVIA);
}

export function fechaHoraFinSesion(fechaSesion, horaFin) {
  // fechaSesion: Date o string YYYY-MM-DD, horaFin: "17:00"
  const [h, m] = horaFin.split(':').map(Number);
  const d = typeof fechaSesion === 'string'
    ? DateTime.fromISO(fechaSesion, { zone: ZONA_BOLIVIA })
    : toBolivia(DateTime.fromJSDate(fechaSesion));
  return d.set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

/** True si ya pasaron más de 24h desde fechaHoraFin de la sesión */
export function pasaron24Horas(fechaHoraFin) {
  const fin = typeof fechaHoraFin === 'string'
    ? DateTime.fromISO(fechaHoraFin, { zone: ZONA_BOLIVIA })
    : fechaHoraFin instanceof Date
      ? toBolivia(DateTime.fromJSDate(fechaHoraFin))
      : fechaHoraFin;
  const ahora = nowBolivia();
  return ahora > fin.plus({ hours: 24 });
}

/** Convierte hora Bolivia a zona del usuario (ej. America/Lima para Perú) */
export function toZonaUsuario(dt, pais) {
  const zone = pais === 'Peru' ? 'America/Lima' : pais === 'Argentina' ? 'America/Argentina/Buenos_Aires' : ZONA_BOLIVIA;
  const d = typeof dt === 'string' || dt instanceof Date ? DateTime.fromJSDate(new Date(dt)) : dt;
  return d.setZone(zone);
}

export { ZONA_BOLIVIA };
