-- ============================================================
-- ESQUEMA BASE DE DATOS - Sistema de Horarios
-- PostgreSQL (compatible con Prisma)
-- ============================================================
-- Ejecutar como superusuario o dueño de la base de datos.
-- Orden: primero enums, luego tablas (respetando FKs).
-- ============================================================

-- Enums
CREATE TYPE "Rol" AS ENUM ('usuario', 'asesora', 'administrador');
CREATE TYPE "Modalidad" AS ENUM ('online', 'presencial');

-- ------------------------------------------------------------
-- Tabla: Cuenta (login único por email + rol)
-- ------------------------------------------------------------
CREATE TABLE "Cuenta" (
  "id"            TEXT    NOT NULL,
  "email"         TEXT    NOT NULL,
  "password_hash" TEXT   NOT NULL,
  "rol"           "Rol"   NOT NULL,
  "activo"        BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Cuenta_email_key" UNIQUE ("email")
);

-- ------------------------------------------------------------
-- Tabla: Plan
-- ------------------------------------------------------------
CREATE TABLE "Plan" (
  "id"               TEXT    NOT NULL,
  "nombre"           TEXT    NOT NULL,
  "horas_incluidas"  INTEGER NOT NULL,
  "reglas"           JSONB,
  "pais_aplica"      TEXT,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- Tabla: Usuario (alumno)
-- ------------------------------------------------------------
CREATE TABLE "Usuario" (
  "id"                   TEXT         NOT NULL,
  "cuenta_id"            TEXT         NOT NULL,
  "nombre"               TEXT         NOT NULL,
  "apellidos"             TEXT         NOT NULL,
  "celular"               TEXT,
  "plan_id"               TEXT,
  "pais"                  TEXT         NOT NULL DEFAULT 'Bolivia',
  "departamento"          TEXT,
  "modalidad"             "Modalidad"  NOT NULL DEFAULT 'online',
  "tutor_legal"           TEXT,
  "horas_saldo"           INTEGER      NOT NULL DEFAULT 0,
  "observaciones"        TEXT,
  "fecha_registro"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cuotas_totales"       INTEGER,
  "pago_contado"         BOOLEAN      NOT NULL DEFAULT false,
  "enviado_revision"     BOOLEAN      NOT NULL DEFAULT false,
  "faltas_consecutivas"  INTEGER      NOT NULL DEFAULT 0,
  "activo"                BOOLEAN      NOT NULL DEFAULT true,
  CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Usuario_cuenta_id_key" UNIQUE ("cuenta_id"),
  CONSTRAINT "Usuario_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Usuario_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Tabla: Asesora
-- ------------------------------------------------------------
CREATE TABLE "Asesora" (
  "id"                 TEXT   NOT NULL,
  "cuenta_id"          TEXT   NOT NULL,
  "nombre"             TEXT   NOT NULL,
  "apellidos"          TEXT   NOT NULL,
  "celular"            TEXT,
  "email"              TEXT,
  "link_zoom_global"   TEXT,
  CONSTRAINT "Asesora_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Asesora_cuenta_id_key" UNIQUE ("cuenta_id"),
  CONSTRAINT "Asesora_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Tabla: plan_asesora (N:N asesora – plan)
-- ------------------------------------------------------------
CREATE TABLE "plan_asesora" (
  "asesora_id" TEXT NOT NULL,
  "plan_id"    TEXT NOT NULL,
  CONSTRAINT "plan_asesora_pkey" PRIMARY KEY ("asesora_id", "plan_id"),
  CONSTRAINT "plan_asesora_asesora_id_fkey" FOREIGN KEY ("asesora_id") REFERENCES "Asesora"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "plan_asesora_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Tabla: Horario (slot de la asesora)
-- ------------------------------------------------------------
CREATE TABLE "Horario" (
  "id"             TEXT        NOT NULL,
  "asesora_id"     TEXT        NOT NULL,
  "dia_semana"     INTEGER     NOT NULL,
  "hora_inicio"    TEXT        NOT NULL,
  "hora_fin"       TEXT        NOT NULL,
  "modalidad"      "Modalidad" NOT NULL,
  "link_zoom"      TEXT,
  "cerrado"        BOOLEAN     NOT NULL DEFAULT false,
  "capacidad_max"  INTEGER     NOT NULL DEFAULT 10,
  CONSTRAINT "Horario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Horario_asesora_id_fkey" FOREIGN KEY ("asesora_id") REFERENCES "Asesora"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Tabla: horario_plan (N:N horario – plan)
-- ------------------------------------------------------------
CREATE TABLE "horario_plan" (
  "horario_id" TEXT NOT NULL,
  "plan_id"    TEXT NOT NULL,
  CONSTRAINT "horario_plan_pkey" PRIMARY KEY ("horario_id", "plan_id"),
  CONSTRAINT "horario_plan_horario_id_fkey" FOREIGN KEY ("horario_id") REFERENCES "Horario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "horario_plan_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Tabla: inscripcion_horario (usuario inscrito en un horario)
-- ------------------------------------------------------------
CREATE TABLE "inscripcion_horario" (
  "id"          TEXT         NOT NULL,
  "usuario_id"  TEXT         NOT NULL,
  "horario_id"  TEXT         NOT NULL,
  "fecha_desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "estado"      TEXT         NOT NULL DEFAULT 'activa',
  CONSTRAINT "inscripcion_horario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inscripcion_horario_usuario_id_horario_id_key" UNIQUE ("usuario_id", "horario_id"),
  CONSTRAINT "inscripcion_horario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "inscripcion_horario_horario_id_fkey" FOREIGN KEY ("horario_id") REFERENCES "Horario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Tabla: Sesion (clase en una fecha)
-- ------------------------------------------------------------
CREATE TABLE "Sesion" (
  "id"                    TEXT         NOT NULL,
  "horario_id"            TEXT         NOT NULL,
  "fecha"                 DATE         NOT NULL,
  "fecha_hora_fin"        TIMESTAMP(3) NOT NULL,
  "paso_clase_asesora"    BOOLEAN      NOT NULL DEFAULT false,
  "timestamp_asistencia"  TIMESTAMP(3),
  CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Sesion_horario_id_fkey" FOREIGN KEY ("horario_id") REFERENCES "Horario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Tabla: asistencia_sesion (por alumno en una sesión)
-- ------------------------------------------------------------
CREATE TABLE "asistencia_sesion" (
  "id"                TEXT    NOT NULL,
  "sesion_id"         TEXT    NOT NULL,
  "usuario_id"        TEXT    NOT NULL,
  "presente"          BOOLEAN,
  "avance"            TEXT,
  "observaciones"     TEXT,
  "enviado_revision"  BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "asistencia_sesion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asistencia_sesion_sesion_id_usuario_id_key" UNIQUE ("sesion_id", "usuario_id"),
  CONSTRAINT "asistencia_sesion_sesion_id_fkey" FOREIGN KEY ("sesion_id") REFERENCES "Sesion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "asistencia_sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Tabla: mensualidad
-- ------------------------------------------------------------
CREATE TABLE "mensualidad" (
  "id"          TEXT         NOT NULL,
  "usuario_id"  TEXT         NOT NULL,
  "mes"         INTEGER      NOT NULL,
  "anio"        INTEGER      NOT NULL,
  "pagado"      BOOLEAN      NOT NULL DEFAULT false,
  "monto"       DECIMAL(10,2),
  "fecha_pago"  TIMESTAMP(3),
  CONSTRAINT "mensualidad_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mensualidad_usuario_id_mes_anio_key" UNIQUE ("usuario_id", "mes", "anio"),
  CONSTRAINT "mensualidad_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ------------------------------------------------------------
-- Tabla: Auditoria
-- ------------------------------------------------------------
CREATE TABLE "Auditoria" (
  "id"            TEXT         NOT NULL,
  "accion"        TEXT         NOT NULL,
  "entidad"       TEXT         NOT NULL,
  "entidad_id"    TEXT         NOT NULL,
  "detalles"      JSONB,
  "usuario_id"    TEXT,
  "asesora_id"    TEXT,
  "admin_id"      TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Auditoria_asesora_id_fkey" FOREIGN KEY ("asesora_id") REFERENCES "Asesora"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Índices útiles para consultas frecuentes
CREATE INDEX "Usuario_plan_id_idx" ON "Usuario"("plan_id");
CREATE INDEX "Usuario_cuenta_id_idx" ON "Usuario"("cuenta_id");
CREATE INDEX "InscripcionHorario_horario_id_idx" ON "inscripcion_horario"("horario_id");
CREATE INDEX "InscripcionHorario_usuario_id_idx" ON "inscripcion_horario"("usuario_id");
CREATE INDEX "Sesion_horario_id_idx" ON "Sesion"("horario_id");
CREATE INDEX "Sesion_fecha_idx" ON "Sesion"("fecha");
CREATE INDEX "asistencia_sesion_sesion_id_idx" ON "asistencia_sesion"("sesion_id");
CREATE INDEX "asistencia_sesion_usuario_id_idx" ON "asistencia_sesion"("usuario_id");
CREATE INDEX "Auditoria_usuario_id_idx" ON "Auditoria"("usuario_id");
CREATE INDEX "Auditoria_created_at_idx" ON "Auditoria"("created_at");
