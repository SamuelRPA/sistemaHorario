/**
 * Elimina todas las filas en orden seguro de FKs.
 * Deja la base sin cuentas; después debe crearse solo lo necesario (p. ej. 3 admins).
 */
export async function vaciarBaseDatos(prisma) {
  await prisma.$transaction(async (tx) => {
    await tx.asistenciaSesion.deleteMany();
    await tx.sesion.deleteMany();
    await tx.inscripcionHorarioSemana.deleteMany();
    await tx.inscripcionHorario.deleteMany();
    await tx.sustitucionSemanal.deleteMany();
    await tx.horarioPlan.deleteMany();
    await tx.horario.deleteMany();
    await tx.mensualidad.deleteMany();
    await tx.abono.deleteMany();
    await tx.planAsesora.deleteMany();
    await tx.auditoria.deleteMany();
    await tx.usuario.deleteMany();
    await tx.asesora.deleteMany();
    await tx.plan.deleteMany();
    await tx.cuenta.deleteMany();
  });
}
