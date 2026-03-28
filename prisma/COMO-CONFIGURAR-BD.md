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

### 2. Crear las tablas (esquema)

Desde la carpeta `backend`:

```bash
npm install
npx prisma db push
```

Esto crea en `sistema_horario` todas las tablas, tipos enum e índices según `schema.prisma`.

### 3. Insertar datos de prueba (seed)

```bash
node prisma/seed.js
```

Se crean:

- 1 plan (Plan estándar)
- 3 cuentas: admin, asesora, usuario (contraseña: **admin123**)
- 1 alumno (Juan), 1 asesora (María), 1 horario (Lunes 09:00–10:00), 1 inscripción

**Listo.** Puedes arrancar el backend con `npm run dev` y entrar con:

- **Admin:** `admin@sistema.local` / `admin123`
- **Asesora:** `asesora@sistema.local` / `admin123`
- **Usuario:** `usuario@sistema.local` / `admin123`

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

### 3. Ejecutar los datos de prueba

- **Archivo:** `backend/prisma/seed-data.sql`

En **psql**:

```bash
psql -U postgres -d sistema_horario -f backend/prisma/seed-data.sql
```

En **pgAdmin**: abre `seed-data.sql`, selecciona todo y ejecuta.

Las cuentas de prueba usan la contraseña **admin123** (hash ya incluido en el SQL).

### 4. Si luego usas Prisma

Después de crear la base con SQL, en `backend` puedes hacer:

```bash
npx prisma generate
```

Así el cliente de Prisma conoce las tablas. No hace falta `prisma db push` si ya aplicaste `schema.sql`.

---

## Resumen rápido (Opción A)

```bash
cd backend
cp .env.example .env
# Editar .env y poner tu DATABASE_URL
npm install
npx prisma db push
node prisma/seed.js
npm run dev
```

---

## Archivos de referencia

| Archivo | Descripción |
|--------|-------------|
| `schema.prisma` | Modelo Prisma (fuente del diseño). |
| `schema.sql` | DDL PostgreSQL: `CREATE TYPE`, `CREATE TABLE`, índices. |
| `seed-data.sql` | INSERTs de prueba (planes, cuentas, usuario, asesora, horario, etc.). |
| `seed.js` | Seed en Node (bcrypt para contraseñas, mismo resultado que seed-data.sql). |
