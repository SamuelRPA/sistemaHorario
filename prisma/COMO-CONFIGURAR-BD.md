# Cómo configurar la base de datos (PostgreSQL)

Sigue estos pasos en orden. Tienes dos opciones: **con Prisma** (recomendada) o **solo SQL**.

---

## Paso 0: Crear la base de datos en PostgreSQL

1. Abre **pgAdmin**, **psql** o el cliente que uses.
2. Crea una base de datos nueva, por ejemplo:
   - Nombre: `sistema_horario`
   - Propietario: tu usuario de PostgreSQL

En **psql** (como superusuario):

```sql
CREATE DATABASE sistema_horario
  WITH ENCODING 'UTF8'
  OWNER postgres;
```

En **pgAdmin**: clic derecho en "Databases" → Create → Database → nombre `sistema_horario`.

---

## Opción A: Con Prisma (recomendada)

Usa el esquema de Prisma y el seed en Node; las tablas se crean solas.

### 1. Configurar la URL de la base de datos

En la carpeta `backend`, crea el archivo `.env` (o copia `.env.example`):

```env
DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@localhost:5432/sistema_horario"
JWT_SECRET="cambiar-en-produccion-secreto-muy-largo"
PORT=4000
```

Sustituye `USUARIO` y `CONTRASEÑA` por tu usuario y contraseña de PostgreSQL. Ejemplo:

```env
DATABASE_URL="postgresql://postgres:mi_password@localhost:5432/sistema_horario"
```

#### Supabase (u otro Postgres en la nube)

En Supabase hay **varias** cadenas de conexión (botón **Connect** del proyecto):

| Modo | Cuándo usarlo |
|------|----------------|
| **Direct connection** (`db.xxxxx.supabase.co:5432`) | Pensado para IPv6. En **Windows o redes solo IPv4** suele fallar con Prisma: `P1001: Can't reach database server`. |
| **Session pooler** (`aws-0-REGION.pooler.supabase.com:5432`, usuario `postgres.PROJECT_REF`) | **Recomendado desde tu PC y en Render** si no tienes el add-on IPv4: funciona por **IPv4 e IPv6**. |

**No uses la URI “Direct”** en `.env` si ves el error P1001. En el panel: **Connect** → pestaña **Session pooler** (o “Shared pooler” / session mode) → copia la URI, sustituye la contraseña y añade al final:

`?sslmode=require`

Ejemplo de forma (los valores reales salen del panel; región y `PROJECT_REF` son tuyos):

```env
DATABASE_URL="postgresql://postgres.TU_PROJECT_REF:TU_PASSWORD@aws-0-TU_REGION.pooler.supabase.com:5432/postgres?sslmode=require"
JWT_SECRET="(mínimo 32 caracteres aleatorios en producción)"
PORT=4000
```

(`TU_PROJECT_REF`, `TU_REGION` y el host exacto los copias del panel en **Session pooler**; no inventes la región.)

- Si la contraseña tiene caracteres especiales (`@`, `#`, etc.), **codifícala en URL** (p. ej. `@` → `%40`).
- Comprueba en el dashboard que el proyecto **no esté pausado** (plan gratuito pausa tras inactividad).
- Si sigue fallando: **Project Settings → Database → Network bans** y revisa que tu IP no esté bloqueada.

**Comprobar red (PowerShell):**

```powershell
Test-NetConnection aws-0-TU_REGION.pooler.supabase.com -Port 5432
```

(Usa el mismo host que en tu `DATABASE_URL` del Session pooler.)

Base `postgres` y el prefijo de usuario del pooler (`postgres.TU_REF`) vienen del propio panel; no hace falta crear otra base para empezar.

### 2. Crear las tablas (esquema)

Desde la carpeta `backend`:

```bash
npm install
npx prisma db push
```

Esto crea todas las tablas, tipos enum e índices según `schema.prisma` (en la base que indique `DATABASE_URL`).

### 3. Solo los 3 administradores (sin datos de demo)

**No uses** `seed-data.sql` ni lo ejecutes en Supabase si quieres una base limpia: ese archivo inserta planes, alumnos, asesoras y horarios de prueba.

Para dejar **solo** las cuentas **Carla**, **Sten** y **Samuel** (y borrar cualquier otro dato previo en esas tablas), usa el seed en Node que primero vacía las tablas de negocio y luego crea/actualiza esas tres cuentas admin:

```bash
node prisma/seed-render.js
```

Opcional: define la contraseña inicial con variable de entorno (si no, es `123456`):

```bash
# Windows PowerShell
$env:BOOTSTRAP_ADMIN_PASSWORD="tu_clave_segura"; node prisma/seed-render.js
```

O en un solo paso (esquema + solo 3 admins), desde `backend`:

```bash
npm run db:supabase
```

Equivale a `npx prisma db push` seguido de `node prisma/seed-render.js`.

**Cuentas** (tras el seed anterior):

| Email | Contraseña |
|--------|-------------|
| carla@tkte.bo | `BOOTSTRAP_ADMIN_PASSWORD` o `123456` |
| sten@tkte.bo | igual |
| samuel@tkte.bo | igual |

En desarrollo local puedes usar también `node prisma/seed.js` (mismo efecto: base vaciada + esos 3 admins; contraseña fija `123456`).

---

## Opción B: Solo SQL (esquema + datos a mano)

Si quieres crear todo con SQL sin usar Prisma en este paso:

### 1. Conectar a la base de datos

Asegúrate de estar conectado a la base `sistema_horario` (no a `postgres`).

### 2. Ejecutar el esquema

Ejecuta el archivo que crea tablas y tipos:

- **Archivo:** `backend/prisma/schema.sql`

En **psql**:

```bash
psql -U postgres -d sistema_horario -f backend/prisma/schema.sql
```

En **pgAdmin**: abre `schema.sql`, selecciona todo y ejecuta (F5).

### 3. Datos de prueba (opcional; **no** para “solo 3 admins”)

El archivo **`seed-data.sql`** inserta planes, usuarios demo, asesora, horarios, etc. Úsalo solo si quieres esa base de prueba. Para producción o Supabase con solo administradores, **no** lo ejecutes; usa la **Opción A** paso 3 con `seed-render.js` (o `npm run db:supabase`).

### 4. Si luego usas Prisma

Después de crear la base con SQL, en `backend` puedes hacer:

```bash
npx prisma generate
```

Así el cliente de Prisma conoce las tablas. No hace falta `prisma db push` si ya aplicaste `schema.sql`.

---

## Resumen rápido (Opción A)

**Local o Supabase con solo 3 administradores:**

```bash
cd backend
cp .env.example .env
# Editar .env: DATABASE_URL (Supabase: ?sslmode=require al final) y JWT_SECRET
npm install
npm run db:supabase
npm run dev
```

Solo tablas (sin tocar datos todavía): `npx prisma db push`. Solo rellenar admins: `node prisma/seed-render.js`.

---

## Archivos de referencia

| Archivo | Descripción |
|--------|-------------|
| `schema.prisma` | Modelo Prisma (fuente del diseño). |
| `schema.sql` | DDL PostgreSQL: `CREATE TYPE`, `CREATE TABLE`, índices. |
| `seed-data.sql` | INSERTs de **demo** (no usar si quieres solo 3 admins). |
| `seed.js` / `seed-render.js` | Vacían tablas de negocio y dejan **solo** Carla, Sten y Samuel (`admins-iniciales.js`). |
