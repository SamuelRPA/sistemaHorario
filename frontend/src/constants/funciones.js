/** Planes: opciones para asesoras y alumnos (Lectura dinámica, Aprende a leer, Nivelación, Matemáticas) */
export const FUNCIONES_OPCIONES = [
  { id: 'lectura_dinamica', label: 'Lectura dinámica' },
  { id: 'aprende_a_leer', label: 'Aprende a leer' },
  { id: 'nivelacion', label: 'Nivelación' },
  { id: 'matematicas', label: 'Matemáticas' },
];

export function labelFuncion(id) {
  return FUNCIONES_OPCIONES.find((f) => f.id === id)?.label ?? id;
}
