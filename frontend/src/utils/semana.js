/** Lunes ISO (YYYY-MM-DD) de la semana civil que contiene fechaISO. */
export function lunesISODeFecha(fechaISO) {
  const d = new Date(`${fechaISO}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function ordenarHorariosPorDiaHora(list) {
  return [...list].sort(
    (a, b) =>
      (a.diaSemana ?? 0) - (b.diaSemana ?? 0) ||
      String(a.horaInicio || '').localeCompare(String(b.horaInicio || '')) ||
      String(a.id || '').localeCompare(String(b.id || ''))
  );
}
