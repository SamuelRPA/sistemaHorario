import { labelFuncion } from '../constants/funciones';

/** Texto para listados: materias del alumno (lectura dinámica, etc.), no el plan comercial. */
export function textoMateriasAlumno(funciones) {
  const ids = Array.isArray(funciones) ? funciones : [];
  if (!ids.length) return '—';
  return ids.map(labelFuncion).join(', ');
}
