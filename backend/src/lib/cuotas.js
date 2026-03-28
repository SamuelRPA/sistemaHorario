import { DateTime } from 'luxon';

const TZ = 'America/La_Paz';

/**
 * Monto por cuota = (monto total − enganche/inscripción) ÷ número de cuotas.
 */
export function calcMontoPorCuota({ montoTotal, montoEnganche, cuotasTotales }) {
  const mt = montoTotal != null ? Number(montoTotal) : null;
  const eng = montoEnganche != null && montoEnganche !== '' ? Number(montoEnganche) : 0;
  const cu = cuotasTotales != null ? Number(cuotasTotales) : 0;
  if (!Number.isFinite(mt) || mt <= 0 || !Number.isFinite(cu) || cu <= 0) return null;
  if (!Number.isFinite(eng) || eng < 0 || eng > mt) return null;
  const base = mt - eng;
  if (base < 0) return null;
  return base / cu;
}

/** Fecha de hoy en Bolivia YYYY-MM-DD */
export function hoyLaPazYmd() {
  return DateTime.now().setZone(TZ).toISODate();
}

/**
 * Periodos de cuota desde la fecha del primer vencimiento (cada mes una cuota).
 * @param {Date|string|null} fechaPrimerVencimiento
 * @param {number} cuotasTotales
 */
export function periodosDesdeFecha(fechaPrimerVencimiento, cuotasTotales) {
  if (!fechaPrimerVencimiento || !cuotasTotales || cuotasTotales <= 0) return [];
  const start = DateTime.fromJSDate(new Date(fechaPrimerVencimiento)).setZone(TZ).startOf('day');
  if (!start.isValid) return [];
  const periodos = [];
  for (let i = 0; i < cuotasTotales; i++) {
    const due = start.plus({ months: i });
    periodos.push({
      indice: i + 1,
      mes: due.month,
      anio: due.year,
      vencimiento: due.toISODate(),
    });
  }
  return periodos;
}

function mensualidadPagada(mensualidades, mes, anio) {
  return (mensualidades || []).some((m) => m.mes === mes && m.anio === anio && m.pagado);
}

/**
 * Lógica antigua (sin fecha de primer vencimiento): mes calendario actual + filas vencidas.
 */
function estadoLegacy(u, mensualidades) {
  const lista = mensualidades || [];
  const now = DateTime.now().setZone(TZ);
  const mesActual = now.month;
  const anioActual = now.year;
  const tieneCuotas = !u.pagoContado && ((u.cuotasTotales && u.cuotasTotales > 0) || (u.montoTotal && Number(u.montoTotal) > 0));
  const enMoraPorMensualidades = lista.some((m) => {
    if (m.pagado) return false;
    return m.anio < anioActual || (m.anio === anioActual && m.mes <= mesActual);
  });
  const pagadoEsteMes = lista.some((m) => m.mes === mesActual && m.anio === anioActual && m.pagado);
  const enMora = enMoraPorMensualidades || (tieneCuotas && !pagadoEsteMes);
  return {
    enMora,
    pagadoEsteMes,
    pagadoAlDia: tieneCuotas ? !enMora : true,
    modo: 'legacy',
    proximoVencimiento: null,
    montoProximaCuota: null,
    periodos: [],
  };
}

/**
 * @param {object} u - usuario (Prisma)
 * @param {Array} mensualidades
 */
export function computeEstadoCuotas(u, mensualidades) {
  const tieneCuotas = !u.pagoContado && ((u.cuotasTotales && u.cuotasTotales > 0) || (u.montoTotal && Number(u.montoTotal) > 0));
  if (!tieneCuotas || u.pagoContado) {
    return {
      enMora: false,
      pagadoEsteMes: false,
      pagadoAlDia: true,
      modo: 'sin_cuotas',
      proximoVencimiento: null,
      montoProximaCuota: null,
      periodos: [],
    };
  }

  const fechaPrimer = u.fechaPrimerVencimiento;
  const n = Math.max(0, Number(u.cuotasTotales) || 0);
  if (!fechaPrimer || n === 0) {
    return estadoLegacy(u, mensualidades);
  }

  const lista = mensualidades || [];
  const todayStr = hoyLaPazYmd();
  const periodos = periodosDesdeFecha(fechaPrimer, n);
  const montoCuota = u.montoPorCuota != null ? Number(u.montoPorCuota) : null;

  let enMora = false;
  for (const p of periodos) {
    if (p.vencimiento < todayStr && !mensualidadPagada(lista, p.mes, p.anio)) {
      enMora = true;
      break;
    }
  }

  const pagadoAlDia = !enMora;
  const pagadoEsteMes = pagadoAlDia;

  let proximoVencimiento = null;
  let montoProximaCuota = montoCuota;
  for (const p of periodos) {
    if (!mensualidadPagada(lista, p.mes, p.anio)) {
      proximoVencimiento = p.vencimiento;
      break;
    }
  }

  const periodosConEstado = periodos.map((p) => {
    const pagado = mensualidadPagada(lista, p.mes, p.anio);
    const vencido = p.vencimiento < todayStr && !pagado;
    const pendiente = !pagado && !vencido;
    return {
      ...p,
      pagado,
      vencido,
      pendienteHoy: p.vencimiento === todayStr && !pagado,
      monto: montoCuota,
    };
  });

  return {
    enMora,
    pagadoEsteMes,
    pagadoAlDia,
    modo: 'por_fecha',
    proximoVencimiento,
    montoProximaCuota,
    periodos: periodosConEstado,
  };
}
