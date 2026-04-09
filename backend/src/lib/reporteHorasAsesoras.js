import { inicioDiaBolivia } from './timezone.js';
import { lunesSemanaBolivia } from './sustitucionSemanal.js';
import { labelsFuncionesHorario } from './funcionesLabels.js';

/**
 * Mapa asesoraId -> agregados del reporte de horas (misma lógica que el endpoint JSON).
 * Cada sesión incluye materias (funciones del horario) y día de la semana en español.
 */
export async function obtenerMapaReporteHorasAsesoras(prisma, { anio, mes }) {
  const where = {};
  if (anio) where.fecha = { gte: new Date(`${anio}-01-01`), lte: new Date(`${anio}-12-31`) };
  if (mes && anio) {
    where.fecha = {
      gte: new Date(`${anio}-${String(mes).padStart(2, '0')}-01`),
      lte: new Date(`${anio}-${String(mes).padStart(2, '0')}-31`),
    };
  }

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
        semanas: {},
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

    const fechaD = s.fecha instanceof Date ? s.fecha : new Date(s.fecha);
    const diaSemana = fechaD.toLocaleDateString('es-BO', { weekday: 'long' });

    porAsesora[id].sesiones.push({
      sesionId: s.id,
      fecha: s.fecha,
      diaSemana,
      horaInicio: s.horario.horaInicio,
      horaFin: s.horario.horaFin,
      modalidad: s.horario.modalidad,
      materias: labelsFuncionesHorario(s.horario.funciones),
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

  return porAsesora;
}
