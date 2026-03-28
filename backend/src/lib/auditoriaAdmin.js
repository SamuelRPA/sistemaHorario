/**
 * Añade adminEmail a detalles de auditoría cuando la acción la hace una cuenta administradora.
 */
export async function detallesConAdminEmail(prisma, adminId, detalles) {
  const base = detalles && typeof detalles === 'object' ? { ...detalles } : {};
  if (!adminId) return base;
  const c = await prisma.cuenta.findUnique({ where: { id: adminId }, select: { email: true } });
  return { ...base, adminEmail: c?.email ?? null };
}
