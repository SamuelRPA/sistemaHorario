# Sistema de Horarios

Sistema de gestión de horarios con tres roles: **Usuario** (alumno), **Asesora** y **Administrador**.

## Requisitos

- Node.js 18+
- PostgreSQL

## Instalación

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Editar .env con DATABASE_URL y JWT_SECRET
npx prisma generate
npx prisma db push
node prisma/seed.js
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- API: http://localhost:4000  
- Web: http://localhost:3000 (proxy a /api)

## Cuentas de prueba (tras seed)

| Rol   | Email                  | Contraseña |
|-------|------------------------|------------|
| Admin | admin@sistema.local    | admin123   |
| Asesora | asesora@sistema.local | admin123   |
| Usuario | usuario@sistema.local | admin123   |

## Estructura

- **backend**: Express, Prisma, PostgreSQL, JWT (cookie), Luxon (zona Bolivia).
- **frontend**: React (Vite), React Router, menús por rol.

Todo el servicio trabaja en **hora Bolivia (America/La_Paz)**; para otros países se convierte al mostrar.
