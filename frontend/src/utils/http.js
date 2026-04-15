/**
 * Lee respuestas de fetch sin asumir JSON siempre.
 * Evita errores tipo "Unexpected token < in JSON..." cuando el backend devuelve HTML.
 */
export async function readApiResponse(res) {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');
  let data = null;
  let text = '';

  try {
    if (isJson) {
      data = await res.json();
    } else {
      text = await res.text();
    }
  } catch (_) {
    // Si el body viene vacío o malformado, devolvemos null y manejamos con mensajes amigables.
  }

  return { ok: res.ok, status: res.status, data, text };
}

export function friendlyApiError(parsed, fallback = 'No se pudo completar la operación. Intenta de nuevo.') {
  if (parsed?.data?.error && typeof parsed.data.error === 'string') return parsed.data.error;
  if (parsed?.status >= 500) return 'Tuvimos un problema temporal. Intenta nuevamente en unos minutos.';
  if (parsed?.status === 404) return 'No encontramos el servicio solicitado.';
  if (parsed?.status === 401 || parsed?.status === 403) return 'Tu sesión no está autorizada. Inicia sesión otra vez.';
  if (parsed?.status === 0) return 'No pudimos conectarnos al servidor. Revisa tu internet e intenta nuevamente.';
  return fallback;
}
