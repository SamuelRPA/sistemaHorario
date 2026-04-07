/**
 * Tres administradores iniciales (hosting Render y mismo criterio que seed local).
 * Contraseña por defecto en scripts: 123456 (cámbiala en producción vía perfil o flujo propio).
 */
export const ADMINS_INICIALES = [
  { email: 'carla@tkte.bo', nombre: 'Carla', apellidos: '-' },
  { email: 'sten@tkte.bo', nombre: 'Sten', apellidos: '-' },
  { email: 'samuel@tkte.bo', nombre: 'Samuel', apellidos: '-' },
];

/**
 * Crea o actualiza solo estas cuentas (no borra alumnos, asesoras ni el resto).
 * La contraseña solo se aplica al crear la cuenta; si ya existe, no se sobrescribe el hash.
 */
export async function upsertSoloAdministradores(prisma, passwordHash) {
  for (const a of ADMINS_INICIALES) {
    await prisma.cuenta.upsert({
      where: { email: a.email },
      create: {
        email: a.email,
        passwordHash,
        rol: 'administrador',
        nombre: a.nombre,
        apellidos: a.apellidos,
        activo: true,
      },
      update: {
        nombre: a.nombre,
        apellidos: a.apellidos,
        rol: 'administrador',
        activo: true,
      },
    });
  }
}
