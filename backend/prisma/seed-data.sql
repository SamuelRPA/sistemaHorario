-- ============================================================
-- DATOS DE PRUEBA - Sistema de Horarios
-- PostgreSQL
-- ============================================================
-- Ejecutar DESPUÉS de schema.sql (o después de prisma db push).
-- La contraseña por defecto es 'admin123' (hash bcrypt).
-- Para generar el hash correcto ejecuta: node prisma/seed.js
-- o usa el hash que se indica abajo (corresponde a 'admin123').
-- ============================================================

-- Contraseña para las 3 cuentas: admin123 (hash bcrypt cost 10)
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 1. Plan
-- ------------------------------------------------------------
INSERT INTO "Plan" ("id", "nombre", "horas_incluidas", "reglas", "pais_aplica") VALUES
  ('11111111-1111-1111-1111-111111111101', 'Plan estándar', 8, '{}', NULL),
  ('11111111-1111-1111-1111-111111111102', 'Plan intensivo', 16, '{"solo_online": false}', NULL);

-- ------------------------------------------------------------
-- 2. Cuentas (login) — contraseña: admin123
-- ------------------------------------------------------------
INSERT INTO "Cuenta" ("id", "email", "password_hash", "rol", "activo", "nombre", "apellidos", "celular") VALUES
  ('22222222-2222-2222-2222-222222222201', 'admin@sistema.local', '$2a$10$WewAlE5h2uPvcMYvwdZMy.GKiQFvTom9uJO7kryqhuTtzMG//tKWG', 'administrador', true, 'Admin', 'Principal', NULL),
  ('22222222-2222-2222-2222-222222222202', 'asesora@sistema.local', '$2a$10$WewAlE5h2uPvcMYvwdZMy.GKiQFvTom9uJO7kryqhuTtzMG//tKWG', 'asesora', true, NULL, NULL, NULL),
  ('22222222-2222-2222-2222-222222222203', 'usuario@sistema.local', '$2a$10$WewAlE5h2uPvcMYvwdZMy.GKiQFvTom9uJO7kryqhuTtzMG//tKWG', 'usuario', true, NULL, NULL, NULL);

-- ------------------------------------------------------------
-- 3. Usuario (alumno)
-- ------------------------------------------------------------
INSERT INTO "Usuario" ("id", "cuenta_id", "nombre", "apellidos", "celular", "plan_id", "pais", "departamento", "modalidad", "tutor_legal", "horas_saldo", "observaciones", "fecha_registro", "cuotas_totales", "pago_contado", "enviado_revision", "faltas_consecutivas", "activo") VALUES
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222203', 'Juan', 'Pérez Alumno', '+591 70000001', '11111111-1111-1111-1111-111111111101', 'Bolivia', 'La Paz', 'online', NULL, 10, NULL, NOW(), 12, false, false, 0, true);

-- ------------------------------------------------------------
-- 4. Asesora
-- ------------------------------------------------------------
INSERT INTO "Asesora" ("id", "cuenta_id", "nombre", "apellidos", "celular", "email", "link_zoom_global") VALUES
  ('44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222202', 'María', 'García Asesora', '+591 70000002', 'asesora@sistema.local', 'https://zoom.us/j/ejemplo123');

-- ------------------------------------------------------------
-- 5. plan_asesora (asesora pertenece al plan estándar)
-- ------------------------------------------------------------
INSERT INTO "plan_asesora" ("asesora_id", "plan_id") VALUES
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111101');

-- ------------------------------------------------------------
-- 6. Horario (slot Lunes 09:00-10:00, online)
-- ------------------------------------------------------------
INSERT INTO "Horario" ("id", "asesora_id", "dia_semana", "hora_inicio", "hora_fin", "modalidad", "link_zoom", "cerrado", "capacidad_max") VALUES
  ('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444401', 1, '09:00', '10:00', 'online', 'https://zoom.us/j/clase-lunes', false, 5);

-- ------------------------------------------------------------
-- 7. horario_plan (el slot es para plan estándar)
-- ------------------------------------------------------------
INSERT INTO "horario_plan" ("horario_id", "plan_id") VALUES
  ('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111101');

-- ------------------------------------------------------------
-- 8. Inscripción (Juan en el horario del lunes)
-- ------------------------------------------------------------
INSERT INTO "inscripcion_horario" ("id", "usuario_id", "horario_id", "fecha_desde", "estado") VALUES
  ('66666666-6666-6666-6666-666666666601', '33333333-3333-3333-3333-333333333301', '55555555-5555-5555-5555-555555555501', NOW(), 'activa');

-- ------------------------------------------------------------
-- 9. Sesión de ejemplo (hoy)
-- ------------------------------------------------------------
INSERT INTO "Sesion" ("id", "horario_id", "fecha", "fecha_hora_fin", "paso_clase_asesora", "timestamp_asistencia") VALUES
  ('77777777-7777-7777-7777-777777777701', '55555555-5555-5555-5555-555555555501', CURRENT_DATE, CURRENT_DATE + INTERVAL '10 hours', false, NULL);

-- ------------------------------------------------------------
-- 10. Mensualidad de ejemplo (mes actual, no pagada)
-- ------------------------------------------------------------
INSERT INTO "mensualidad" ("id", "usuario_id", "mes", "anio", "pagado", "monto", "fecha_pago") VALUES
  ('88888888-8888-8888-8888-888888888801', '33333333-3333-3333-3333-333333333301', EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, false, 150.00, NULL);
