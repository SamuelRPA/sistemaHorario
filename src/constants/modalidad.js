/** Etiqueta legible para modalidad de alumno u horario (online/presencial/ambos). */
export function labelModalidad(m) {
  if (m === 'ambos') return 'Presencial y virtual';
  if (m === 'online') return 'Virtual';
  if (m === 'presencial') return 'Presencial';
  return m ?? '—';
}
