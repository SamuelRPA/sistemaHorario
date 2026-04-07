/**
 * Texto legible para saber qué administrador actuó (nombre en perfil + correo).
 */
export function formatAdminEtiqueta(c) {
  if (!c) return null;
  const email = c.email != null ? String(c.email).trim() : '';
  const nom = [c.nombre, c.apellidos]
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x).trim())
    .join(' ');
  if (nom && email) return `${nom} · ${email}`;
  if (email) return email;
  if (nom) return nom;
  return null;
}

/**
 * Añade adminEmail y adminEtiqueta a detalles cuando la acción la hace una cuenta administradora.
 */
export async function detallesConAdminEmail(prisma, adminId, detalles) {
  const base = detalles && typeof detalles === 'object' ? { ...detalles } : {};
  if (!adminId) return base;
  const c = await prisma.cuenta.findUnique({
    where: { id: adminId },
    select: { email: true, nombre: true, apellidos: true },
  });
  const adminEtiqueta = formatAdminEtiqueta(c);
  return { ...base, adminEmail: c?.email ?? null, adminEtiqueta };
}
