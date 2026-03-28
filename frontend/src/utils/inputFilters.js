/**
 * Solo letras (incl. acentos), espacios, apóstrofe, guión y punto — bloquea números y símbolos raros.
 * Alineado con validación /^[\p{L}\s'-.]+$/u
 */
export function soloTextoNombre(value) {
  return String(value ?? '').replace(/[^\p{L}\s'-.]/gu, '');
}

/**
 * Solo dígitos, +, espacios y guiones — bloquea letras.
 */
export function soloCelular(value) {
  return String(value ?? '').replace(/[^0-9+\s-]/g, '');
}

/** Quita espacios al inicio y al final (evita espacios colgando al final). */
export function trimStr(v) {
  if (v == null) return v;
  return typeof v === 'string' ? v.trim() : v;
}

/**
 * Recorta espacios al inicio y final de las claves indicadas (antes de enviar al API).
 */
export function trimFormStrings(obj, keys) {
  const out = { ...obj };
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(out, k) && typeof out[k] === 'string') {
      out[k] = out[k].trim();
    }
  }
  return out;
}

/**
 * Horas saldo u otros enteros ≥ 0: permite vacío; solo dígitos; sin ceros a la izquierda (ej. "032" → "32").
 */
export function normalizeEnteroHorasSaldo(raw) {
  if (raw == null || raw === '') return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits === '') return '';
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return '';
  return String(Math.max(0, n));
}
