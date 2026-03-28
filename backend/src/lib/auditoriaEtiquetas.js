/**
 * Etiquetas en español para códigos de acción de auditoría (clave estable en BD).
 */
export const ETIQUETAS_ACCION_AUDITORIA = {
  alumno_salida_horario: 'El alumno se dio de baja de un horario',
  asesora_agrega_alumno_horario: 'La asesora inscribió a un alumno en un horario',
  asesora_quita_alumno_horario: 'La asesora quitó a un alumno de un horario',
  admin_consulta_reporte_horas_asesoras: 'Consulta al reporte de horas asesoras (cuenta administración)',
  admin_edicion_alumno: 'Edición de datos de un alumno (cuenta administración)',
  admin_pago_cuota: 'Registro de pago o estado de una cuota (cuenta administración)',
  admin_registro_abono: 'Registro de abono a favor del alumno (cuenta administración)',
  admin_edicion_asesora: 'Edición de ficha de asesora o planes (cuenta administración)',
  auth_force_password_change_required: 'Se exigió cambio de contraseña en el primer acceso',
  auth_recuperacion_password: 'Recuperación de contraseña por correo',
  auth_password_changed_first_login: 'Contraseña cambiada en primer ingreso',
  asesora_confirma_horarios_disponibles: 'La asesora confirmó sus horarios disponibles (cuadro semanal)',
  admin_sustitucion_semanal: 'Asignación o eliminación de sustitución semanal en un horario (cuenta administración)',
  asesora_edita_horario: 'La asesora modificó un horario (día, hora, enlace, cupo, etc.)',
  asesora_edita_perfil: 'La asesora actualizó su perfil o planes asignados',
  asesora_marca_todos_presentes: 'La asesora marcó a todos los alumnos presentes en una sesión',
  asesora_registra_asistencia_alumno: 'La asesora registró asistencia o avance de un alumno',
  asesora_sesion_creada_auto: 'El sistema creó automáticamente una sesión',
  alumno_inicio_sesion: 'El alumno inició sesión en el sistema',
  alumno_acceso_link_zoom: 'El alumno abrió el enlace de videollamada (Zoom) de su clase virtual',
  intento_login_fallido: 'Intento de inicio de sesión fallido (credenciales incorrectas)',
};

export function etiquetaAccionAuditoria(accion) {
  if (!accion || typeof accion !== 'string') return '—';
  return ETIQUETAS_ACCION_AUDITORIA[accion] || accion;
}
