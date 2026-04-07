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

## Documentación, Docker y Render

- **Qué hace el proyecto, limitaciones y operación:** [docs/DESCRIPCION-DEL-PROYECTO.md](docs/DESCRIPCION-DEL-PROYECTO.md)
- **Render:** [render.yaml](render.yaml) — cada `preDeploy` **vacía la base** y deja **solo** las 3 cuentas admin (Carla, Sten, Samuel). Configura `JWT_SECRET` y `CORS_ORIGIN` en el panel.
- **Docker** raíz: `Dockerfile`, `docker-compose.yml`, `.env.docker.example`

```bash
cp .env.docker.example .env.docker
# Define JWT_SECRET (≥32 caracteres) en .env.docker
docker compose --env-file .env.docker up --build
```

- App: http://localhost:4000 · `GET /api/health`

## Cuentas de prueba (tras `node backend/prisma/seed.js`)

El seed actual deja **solo tres administradores** (no asesoras ni alumnos). Contraseña común: **`123456`**.

| Nombre  | Email            |
|---------|------------------|
| Carla   | carla@tkte.bo    |
| Sten    | sten@tkte.bo     |
| Samuel  | samuel@tkte.bo   |

**Importante:** el seed **vacía la base**. Úsalo solo en desarrollo.

## Estructura

- **backend**: Express, Prisma, PostgreSQL, JWT (cookie), Luxon (zona Bolivia).
- **frontend**: React (Vite), React Router, menús por rol.

Todo el servicio trabaja en **hora Bolivia (America/La_Paz)**; para otros países se convierte al mostrar.
