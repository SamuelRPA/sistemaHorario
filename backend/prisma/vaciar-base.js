/**
 * Elimina todas las filas en orden seguro de FKs.
 * Deja la base sin cuentas; después debe crearse solo lo necesario (p. ej. 3 admins).
 *
 * No usa prisma.$transaction(callback): con el pooler de Supabase (PgBouncer/Supavisor)
 * las transacciones interactivas largas suelen fallar con P2028 ("Transaction not found").
 * Cada deleteMany es una transacción corta y compatible con el pooler.
 */
export async function vaciarBaseDatos(prisma) {
  await prisma.asistenciaSesion.deleteMany();
  await prisma.sesion.deleteMany();
  await prisma.inscripcionHorarioSemana.deleteMany();
  await prisma.inscripcionHorario.deleteMany();
  await prisma.sustitucionSemanal.deleteMany();
  await prisma.horarioPlan.deleteMany();
  await prisma.horario.deleteMany();
  await prisma.mensualidad.deleteMany();
  await prisma.abono.deleteMany();
  await prisma.planAsesora.deleteMany();
  await prisma.auditoria.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.asesora.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.cuenta.deleteMany();
}
