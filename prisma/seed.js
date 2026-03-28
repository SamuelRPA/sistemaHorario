import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  const hash = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
  let plan = await prisma.plan.findFirst({ where: { nombre: 'Plan estándar' } });
  if (!plan) {
    plan = await prisma.plan.create({
      data: { nombre: 'Plan estándar', horasIncluidas: 8, reglas: {} },
    });
  }

  const emailsAdmin = ['admin@sistema.local', 'admin2@sistema.local', 'admin3@sistema.local'];
  for (const email of emailsAdmin) {
    await prisma.cuenta.upsert({
      where: { email },
      create: {
        email,
        passwordHash: hash,
        rol: 'administrador',
      },
      update: {},
    });
  }

  const cuentaAsesora = await prisma.cuenta.upsert({
    where: { email: 'asesora@sistema.local' },
    create: {
      email: 'asesora@sistema.local',
      passwordHash: hash,
      rol: 'asesora',
    },
    update: {},
  });

  let asesora = await prisma.asesora.findFirst({ where: { cuentaId: cuentaAsesora.id } });
  if (!asesora) {
    asesora = await prisma.asesora.create({
      data: {
        cuentaId: cuentaAsesora.id,
        nombre: 'María',
        apellidos: 'Asesora',
        email: 'asesora@sistema.local',
      },
    });
    await prisma.planAsesora.create({ data: { asesoraId: asesora.id, planId: plan.id } });
  }

  const cuentaUsuario = await prisma.cuenta.upsert({
    where: { email: 'usuario@sistema.local' },
    create: {
      email: 'usuario@sistema.local',
      passwordHash: hash,
      rol: 'usuario',
    },
    update: {},
  });

  let usuario = await prisma.usuario.findFirst({ where: { cuentaId: cuentaUsuario.id } });
  if (!usuario) {
    usuario = await prisma.usuario.create({
      data: {
        cuentaId: cuentaUsuario.id,
        nombre: 'Juan',
        apellidos: 'Alumno',
        funciones: ['aprende_a_leer', 'nivelacion'],
        pais: 'Bolivia',
        modalidad: 'online',
        horasSaldo: 10,
        cuotasTotales: 12,
      },
    });
  }

  const horario = await prisma.horario.findFirst({ where: { asesoraId: asesora.id } });
  if (!horario) {
    const h = await prisma.horario.create({
      data: {
        asesoraId: asesora.id,
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '10:00',
        modalidad: 'online',
        linkZoom: 'https://zoom.us/j/ejemplo',
        capacidadMax: 5,
      },
    });
    await prisma.horarioPlan.create({ data: { horarioId: h.id, planId: plan.id } });
    await prisma.inscripcionHorario.create({ data: { usuarioId: usuario.id, horarioId: h.id } });
  }

  console.log('Seed OK. Admins: admin@sistema.local, admin2@sistema.local, admin3@sistema.local | asesora@sistema.local | usuario@sistema.local | pass: admin123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
