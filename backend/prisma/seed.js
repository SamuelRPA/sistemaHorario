import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { upsertSoloAdministradores } from './admins-iniciales.js';
import { vaciarBaseDatos } from './vaciar-base.js';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

/**
 * Desarrollo: vacía la BD y deja solo las 3 cuentas administradoras.
 * Contraseña común: 123456
 */
async function main() {
  await vaciarBaseDatos(prisma);

  const passwordHash = await bcrypt.hash('123456', BCRYPT_ROUNDS);
  await upsertSoloAdministradores(prisma, passwordHash);

  console.log('');
  console.log('Base limpiada. Solo 3 administradores. Contraseña de todos: 123456');
  console.log('  • Carla   → carla@tkte.bo');
  console.log('  • Sten    → sten@tkte.bo');
  console.log('  • Samuel  → samuel@tkte.bo');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
