# Sistema de horarios (Tk&Te) — descripción del proyecto

Documento orientado a **desarrolladores u operadores** que necesitan entender **qué es** esta aplicación, **cómo está armada**, **qué puede hacer** y **dónde están los límites** sin recorrer todo el código.

---

## Qué es

Aplicación web para **gestionar horarios de clases**, **inscripciones**, **asistencia**, **cuotas / mensualidades** y **auditoría de acciones**, con **tres roles**:

| Rol | Quién | Idea general |
|-----|--------|---------------|
| **Administrador** | Dirección / secretaría | Horarios globales, alumnos, asesoras, cuotas, estadísticas, altas de cuenta, sustituciones semanales, informes y auditoría. |
| **Asesora** | Docente | Sus horarios, alumnos en sus franjas, asistencia y avances, perfil y confirmación de disponibilidad semanal. |
| **Usuario** | Alumno / familia | Ver horario, inscribirse en franjas permitidas, perfil y (según reglas del plan) información de cuotas y clases. |

La lógica de negocio asume **zona horaria Bolivia** (`America/La_Paz`), reflejada en librerías de fechas y en el modelo de datos (por ejemplo sesiones y semanas).

---

## Arquitectura técnica

- **Monorepo** con dos paquetes:
  - **`backend/`** — API **Node.js** + **Express**, acceso a datos con **Prisma** sobre **PostgreSQL**.
 O - **`frontend/`** — **React 18** + **Vite**; en desarrollo el proxy de Vite envía `/api` al backend; en **producción** el mismo servidor Express sirve el build estático (`frontend/dist`) y la API bajo `/api` (mismo origen).

- **Autenticación**: cookie **HTTP-only** con **JWT** (también se admite `Authorization: Bearer` si hace falta). El payload incluye `sub` (id de cuenta), `rol`, y según el caso `usuarioId` / `asesoraId`.

- **Base de datos**: un único esquema relacional (ver `backend/prisma/schema.prisma`). No hay tabla “administrador” separada: los admins son filas en **`Cuenta`** con `rol = administrador` y pueden tener nombre/apellidos/celular en la propia cuenta para perfil y auditoría.

---

## Funcionalidades principales (resumen)

- **Horarios**: franjas por asesora, modalidad (online / presencial / ambos), cupos, enlaces Zoom, planes asociados al horario.
- **Inscripciones**: permanentes y **solo una semana** (`InscripcionHorarioSemana`) cuando aplica.
- **Sustitución semanal**: otra asesora cubre un horario una semana concreta; queda auditado con **qué administrador** la registró cuando el cambio viene del panel admin.
- **Sesiones y asistencia**: creación de sesiones, presente / avance / observaciones; integración con sustituciones para “asesora efectiva”.
- **Cuotas**: mensualidades, mora, abonos, montos y fechas acordadas según el esquema actual.
- **Auditoría**: registro de acciones relevantes; las operaciones hechas **desde cuenta administrador** guardan `adminId` y en la UI se muestra **nombre de perfil · correo** cuando está disponible.
- **Recuperación de contraseña**: flujo por **código por correo** (requiere **SMTP** configurado).
- **Seguridad HTTP**: **Helmet**, **rate limiting** en API y rutas de auth más restrictivas, **CORS** configurable en producción (`CORS_ORIGIN`), comprobación de `JWT_SECRET` en producción.

---

## Limitaciones y matices (importante)

1. **PostgreSQL obligatorio**  
   El proyecto no está pensado para SQLite u otros motores sin adaptar `schema.prisma` y el datasource.

2. **Evolve de esquema con Prisma**  
   En el repositorio suele usarse **`prisma db push`** para alinear el esquema (no siempre hay carpeta `migrations` versionada). En equipos grandes conviene migrar a **`prisma migrate`** con revisiones explícitas. El contenedor Docker ejecuta `db push` al **arrancar** para simplificar despliegues de prueba; en producción crítica valora ejecutar migraciones como paso explícito en CI/CD.

3. **`db push` al iniciar el contenedor**  
   Puede fallar si hay cambios **destructivos** sin flags adicionales, o generar diferencias no deseadas si alguien tocó la BD a mano. Revisa logs del contenedor `app` tras cada despliegue.

4. **Correo**  
   Sin variables SMTP válidas, **recuperación de contraseña** no envía mensajes (el backend responde con error controlado). Los flujos de login normales siguen funcionando.

5. **Un solo proceso Node sirve front + API en producción**  
   Es adecuado para PaaS o VM pequeñas. Para tráfico muy alto habría que plantear CDN para estáticos, varias réplicas detrás de un balanceador y revisar **rate limit** y **cookies** (`secure`, dominio, `sameSite`).

6. **JWT y secreto**  
   En **`NODE_ENV=production`** el arranque **exige** `JWT_SECRET` de **al menos 32 caracteres** y rechaza valores obviamente débiles (fragmentos como `password`, `123456`, etc.). Debes generar un secreto aleatorio y guardarlo fuera del código (variables de entorno, secret manager).

7. **`TRUST_PROXY` y `RENDER`**  
   Tras un proxy (nginx, Render, etc.) puede hacer falta `TRUST_PROXY=1` para que la IP del cliente y el rate limit sean correctos.

8. **Datos de prueba / seed**  
   El script `backend/prisma/seed.js` **vacía la base** y deja solo cuentas de demostración. **No ejecutes seed en producción** salvo que sea a propósito y con backup.

9. **Alcance funcional**  
   No es un ERP completo: reportes, exportaciones, multi-tenant, idiomas múltiples o app móvil nativa **no** forman parte del núcleo descrito aquí salvo que el código haya evolucionado después de este documento.

10. **Tests**  
    Comprueba en el repo si existen pruebas automatizadas; este documento no asume una suite de CI completa.

---

## Variables de entorno relevantes

Definidas y comentadas en **`backend/.env.example`**. Las más críticas:

- **`DATABASE_URL`** — Conexión PostgreSQL.
- **`JWT_SECRET`** — Firma de tokens; obligatoria y fuerte en producción.
- **`NODE_ENV`** — `production` activa sirviente de estáticos y reglas estrictas de seguridad.
- **`FRONTEND_DIST`** — Ruta al `dist` del front (opcional si la estructura de carpetas es la por defecto).
- **`CORS_ORIGIN`** — En producción, orígenes permitidos separados por coma.
- **`SMTP_*`** — Para envío del código de recuperación de contraseña.
- **`TRUST_PROXY`**, **`RATE_LIMIT_*`** — Comportamiento tras proxy y límites de peticiones.

Archivo auxiliar para Docker: **`.env.docker.example`** (copiar a **`.env.docker`**, no subir a git).

---

## Despliegue con Docker

| Archivo | Uso |
|---------|-----|
| `backend/Dockerfile.fullstack` | Imagen multi-stage (build desde la **raíz** del monorepo): front + API + `docker-entrypoint.sh`. Usada por `docker-compose`. |
| `backend/Dockerfile` | Solo API + Prisma; contexto de build = carpeta `backend/` (p. ej. rama `render-backend` vía `git subtree split`). |
| `frontend/Dockerfile` | SPA en nginx; contexto = carpeta `frontend/` (p. ej. rama `render-frontend`). |
| `backend/docker-entrypoint.sh` | `prisma db push` y arranque del servidor. |
| `docker-compose.yml` | **PostgreSQL 16** + app full-stack. |
| `frontend/.dockerignore`, `backend/.dockerignore` | Reducen contexto de build. |

**Ramas para Render (una carpeta en la raíz):** en `main` deja el monorepo completo; luego `./scripts/render-branches.sh` genera `render-frontend` y `render-backend` para servicios con Root Directory vacío y Dockerfile en cada proyecto.

**Pasos típicos (local):**

```bash
cp .env.docker.example .env.docker
# Editar JWT_SECRET (≥32 caracteres, sin patrones débiles)
docker compose --env-file .env.docker up --build
```

- Aplicación: `http://localhost:4000` (o el puerto de `APP_PORT` en `.env.docker`).
- Salud: `GET /api/health`.

**Primera vez en Docker (solo dev)**: el seed que **vacía la BD** es `seed.js`. En el contenedor:

```bash
docker compose --env-file .env.docker exec app node prisma/seed.js
```

En **producción** usa secretos reales, HTTPS delante del contenedor, y evita contraseñas por defecto en PostgreSQL.

---

## Hosting en Render

En la raíz del repo hay un **`render.yaml`** (Blueprint) que:

1. **Build**: instala dependencias, genera el cliente Prisma y construye el frontend (`frontend/dist`).
2. **preDeploy**: `prisma db push` + **`node prisma/seed-render.js`** — **vacía toda la base** (alumnos, asesoras, horarios, planes, auditoría, etc.) y deja **únicamente** las tres cuentas administradoras **Carla**, **Sten** y **Samuel** (`carla@tkte.bo`, `sten@tkte.bo`, `samuel@tkte.bo`). Cada nuevo despliegue repite este proceso: el sistema hosteado queda siempre **solo con esos 3 admins**, sin otros usuarios.
3. **Start**: sirve API + estáticos desde `backend` con `NODE_ENV=production` (misma lógica que en VM: `FRONTEND_DIST` por defecto apunta a `../../frontend/dist` respecto a `backend/src`).

**Aviso:** si en el futuro necesitas **conservar** alumnos o asesoras entre deploys, no ejecutes `seed-render` en cada `preDeploy` (o sustitúyelo por un seed que solo cree admins la primera vez).

**Variables que debes configurar en el panel de Render** (o en el Blueprint): `JWT_SECRET` (≥32 caracteres, fuerte), `CORS_ORIGIN` (URL pública `https://…`). Opcional: `BOOTSTRAP_ADMIN_PASSWORD` para la clave inicial de los tres admins (por defecto `123456`).

| Script | Uso |
|--------|-----|
| `npm run db:seed` (`seed.js`) | **Local**: vacía la BD y deja solo los 3 admins (clave `123456`). Misma lógica de vaciado que `seed-render`. |
| `npm run db:seed:render` (`seed-render.js`) | **Render / hosting**: vacía la BD y solo los 3 admins. |

La lista de correos y nombres está en `backend/prisma/admins-iniciales.js`; el orden de borrado en `backend/prisma/vaciar-base.js`.

---

## Desarrollo sin Docker

1. Instalar PostgreSQL y crear la base.
2. `backend/`: copiar `.env.example` → `.env`, `npm ci`, `npx prisma generate`, `npx prisma db push`.
3. `backend/`: `npm run dev` (API, p. ej. puerto 4000).
4. `frontend/`: `npm ci`, `npm run dev` (Vite, p. ej. puerto 3000 con proxy a `/api`).

---

## Dónde profundizar

- Esquema de datos: `backend/prisma/schema.prisma`.
- Configuración BD paso a paso: `backend/prisma/COMO-CONFIGURAR-BD.md`.
- Rutas API: `backend/src/routes/` (`auth`, `usuario`, `asesora`, `admin`).
- Interfaz: `frontend/src/` (páginas por rol y layouts).

Si actualizas el comportamiento del sistema, conviene **actualizar también este archivo** para que nuevas personas no lean información obsoleta.
