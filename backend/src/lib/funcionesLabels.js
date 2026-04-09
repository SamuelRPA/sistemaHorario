/** Mismas etiquetas que frontend/src/constants/funciones.js (materias en horarios). */

const LABELS = {
  lectura_dinamica: 'Lectura dinámica',
  aprende_a_leer: 'Aprende a leer',
  nivelacion: 'Nivelación',
  matematicas: 'Matemáticas',
};

export function labelsFuncionesHorario(json) {
  if (json == null) return '—';
  const arr = Array.isArray(json)
    ? json
    : typeof json === 'object'
      ? Object.values(json)
      : [];
  const ids = arr.filter((x) => typeof x === 'string');
  if (ids.length === 0) return '—';
  return ids.map((id) => LABELS[id] || id).join(', ');
}
