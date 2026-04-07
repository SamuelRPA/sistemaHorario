import React, { useState, useEffect } from 'react';
import { soloTextoNombre, soloCelular, trimFormStrings } from '../../utils/inputFilters';
import { useAuth } from '../../context/AuthContext';

export default function AdminPerfil() {
  const { refresh } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    fetch('/api/admin/perfil', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p) => {
        setPerfil(p);
        setForm({
          email: p.email ?? '',
          nombre: p.nombre ?? '',
          apellidos: p.apellidos ?? '',
          celular: p.celular ?? '',
        });
      })
      .catch(() => setPerfil(null))
      .finally(() => setLoading(false));
  }, []);

  const submit = (e) => {
    e.preventDefault();
    setSaving(true);
    const body = trimFormStrings(
      {
        email: form.email,
        nombre: form.nombre,
        apellidos: form.apellidos,
        celular: form.celular,
      },
      ['email', 'nombre', 'apellidos', 'celular']
    );
    if (body.email) body.email = body.email.toLowerCase();
    fetch('/api/admin/perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d))))
      .then(() =>
        fetch('/api/admin/perfil', { credentials: 'include' }).then((res) =>
          res.ok ? res.json() : Promise.reject()
        )
      )
      .then((p) => {
        setPerfil(p);
        setForm({
          email: p.email ?? '',
          nombre: p.nombre ?? '',
          apellidos: p.apellidos ?? '',
          celular: p.celular ?? '',
        });
        refresh();
        setPopup({ type: 'success', message: 'Perfil actualizado correctamente.' });
      })
      .catch((err) => setPopup({ type: 'error', message: err?.error || 'Error al guardar' }))
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="card">Cargando perfil...</div>;
  if (!perfil) return <div className="card">No se pudo cargar el perfil.</div>;

  return (
    <div className="anadir-page">
      <h2 style={{ marginBottom: '0.5rem', color: 'var(--brand-blue)' }}>Editar perfil</h2>
      <p style={{ color: '#475569', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
        Correo de inicio de sesión, nombre visible en la barra y registro en auditoría. Si cambias el correo, la sesión se mantiene activa.
      </p>

      <div className="anadir-form">
        <form onSubmit={submit}>
          <div className="anadir-section">
            <div className="anadir-section-title">Cuenta</div>
            <div className="anadir-form-grid">
              <div className="form-group full-width">
                <label>Correo (inicio de sesión) *</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onBlur={(e) => setForm({ ...form, email: e.target.value.trim().toLowerCase() })}
                  required
                />
              </div>
            </div>
          </div>
          <div className="anadir-section">
            <div className="anadir-section-title">Datos personales</div>
            <div className="anadir-form-grid">
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: soloTextoNombre(e.target.value) })}
                  onBlur={(e) => setForm({ ...form, nombre: soloTextoNombre(e.target.value.trim()) })}
                  inputMode="text"
                  required
                />
              </div>
              <div className="form-group">
                <label>Apellidos *</label>
                <input
                  value={form.apellidos}
                  onChange={(e) => setForm({ ...form, apellidos: soloTextoNombre(e.target.value) })}
                  onBlur={(e) => setForm({ ...form, apellidos: soloTextoNombre(e.target.value.trim()) })}
                  inputMode="text"
                  required
                />
              </div>
              <div className="form-group">
                <label>Celular</label>
                <input
                  value={form.celular}
                  onChange={(e) => setForm({ ...form, celular: soloCelular(e.target.value) })}
                  onBlur={(e) => setForm({ ...form, celular: soloCelular(e.target.value.trim()) })}
                  inputMode="tel"
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>
          <div className="anadir-form-actions">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>

      {popup && (
        <div className="modal-overlay" onClick={() => setPopup(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '520px',
              maxWidth: '95vw',
              border:
                popup.type === 'success'
                  ? '2px solid rgba(249,161,33,0.95)'
                  : '2px solid rgba(211,46,46,0.95)',
              background:
                popup.type === 'success'
                  ? 'rgba(249,161,33,0.22)'
                  : 'rgba(211,46,46,0.20)',
            }}
          >
            <h3
              style={{
                marginTop: 0,
                color: popup.type === 'success' ? 'var(--success-green)' : 'var(--danger-red)',
              }}
            >
              {popup.type === 'success' ? 'Confirmado' : 'Error'}
            </h3>
            <p style={{ marginTop: 0, color: 'var(--text)' }}>{popup.message}</p>
            <button
              type="button"
              className={`btn ${popup.type === 'success' ? '' : 'danger'}`}
              onClick={() => setPopup(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
