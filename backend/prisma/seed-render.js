/**
 * Seed para hosting (Render): vacía toda la base y crea únicamente las 3 cuentas
 * administradoras (Carla, Sten, Samuel). No quedan asesoras, alumnos ni planes.
 *
 * Se ejecuta en preDeploy; cada despliegue vuelve a dejar solo esos 3 admins.
 * Contraseña: BOOTSTRAP_ADMIN_PASSWORD o por defecto 123456.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { upsertSoloAdministradores } from './admins-iniciales.js';
import { vaciarBaseDatos } from './vaciar-base.js';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  await vaciarBaseDatos(prisma);

  const pwd = process.env.BOOTSTRAP_ADMIN_PASSWORD || '123456';
  const passwordHash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
  await upsertSoloAdministradores(prisma, passwordHash);

  console.log('[seed-render] Base vaciada. Solo 3 administradores (Carla, Sten, Samuel).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
