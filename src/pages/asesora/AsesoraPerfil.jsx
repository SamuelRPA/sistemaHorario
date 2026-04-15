import React, { useState, useEffect } from 'react';
import { FUNCIONES_OPCIONES } from '../../constants/funciones';
import { soloTextoNombre, soloCelular, trimFormStrings } from '../../utils/inputFilters';
import { apiUrl } from '../../apiUrl.js';

export default function AsesoraPerfil() {
  const [perfil, setPerfil] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState(null); // { type, message }

  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/api/asesora/perfil'), { credentials: 'include' }).then((r) => r.json()),
      fetch(apiUrl('/api/asesora/planes'), { credentials: 'include' }).then((r) => (r.ok ? r.json() : { planes: [] })),
    ])
      .then(([p, pl]) => {
        setPerfil(p);
        setPlanes(pl.planes || []);
        setForm({
          nombre: p.nombre,
          apellidos: p.apellidos,
          celular: p.celular ?? '',
          email: p.email ?? '',
          linkZoomGlobal: p.linkZoomGlobal ?? '',
          planIds: (p.planesAsesora || []).map((pa) => pa.planId),
          funciones: Array.isArray(p.funciones) ? p.funciones : [],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const submit = (e) => {
    e.preventDefault();
    setSaving(true);
    const { email, ...rest } = form;
    const body = trimFormStrings(rest, ['nombre', 'apellidos', 'celular', 'linkZoomGlobal']);
    fetch(apiUrl('/api/asesora/perfil'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then((r) =>
        r.ok
          ? fetch(apiUrl('/api/asesora/perfil'), { credentials: 'include' }).then((r2) => r2.json()).then(setPerfil).then(() => setPopup({ type: 'success', message: 'Perfil guardado correctamente.' }))
          : r.json()
      )
      .then((data) => data?.error && setPopup({ type: 'error', message: data.error }))
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="card">Cargando perfil...</div>;

  return (
    <div className="anadir-page">
      <h2 style={{ marginBottom: '0.5rem', color: 'var(--brand-blue)' }}>Editar perfil</h2>
      <p style={{ color: '#475569', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
        Planes que imparte, planes asignados y datos personales (auditado para el administrador).
      </p>
      <div className="anadir-form">
        <form onSubmit={submit}>
          <div className="anadir-section">
            <div className="anadir-section-title">Datos personales</div>
            <div className="anadir-form-grid">
              <div className="form-group"><label>Nombre *</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: soloTextoNombre(e.target.value) })} onBlur={(e) => setForm({ ...form, nombre: soloTextoNombre(e.target.value.trim()) })} inputMode="text" required /></div>
              <div className="form-group"><label>Apellidos *</label><input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: soloTextoNombre(e.target.value) })} onBlur={(e) => setForm({ ...form, apellidos: soloTextoNombre(e.target.value.trim()) })} inputMode="text" required /></div>
              <div className="form-group"><label>Celular</label><input value={form.celular} onChange={(e) => setForm({ ...form, celular: soloCelular(e.target.value) })} onBlur={(e) => setForm({ ...form, celular: soloCelular(e.target.value.trim()) })} inputMode="tel" placeholder="Opcional" /></div>
              <div className="form-group full-width"><label>Link Zoom global</label><input type="url" value={form.linkZoomGlobal} onChange={(e) => setForm({ ...form, linkZoomGlobal: e.target.value })} onBlur={(e) => setForm({ ...form, linkZoomGlobal: e.target.value.trim() })} placeholder="https://zoom.us/..." /></div>
            </div>
          </div>
          <div className="anadir-section">
            <div className="anadir-section-title">Planes que imparte (materias)</div>
            <div className="anadir-checkgroup" style={{ marginTop: '0.35rem' }}>
              {FUNCIONES_OPCIONES.map((f) => (
                <label key={f.id}>
                  <input
                    type="checkbox"
                    checked={(form.funciones || []).includes(f.id)}
                    onChange={(e) => setForm({
                      ...form,
                      funciones: e.target.checked ? [...(form.funciones || []), f.id] : (form.funciones || []).filter((id) => id !== f.id),
                    })}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="anadir-section">
            <div className="anadir-section-title">Planes asignados (paquetes)</div>
            <div className="anadir-checkgroup" style={{ marginTop: '0.35rem' }}>
              {planes.map((p) => (
                <label key={p.id}>
                  <input
                    type="checkbox"
                    checked={(form.planIds || []).includes(p.id)}
                    onChange={(e) => {
                      const ids = form.planIds || [];
                      if (e.target.checked) setForm({ ...form, planIds: [...ids, p.id] });
                      else setForm({ ...form, planIds: ids.filter((id) => id !== p.id) });
                    }}
                  />
                  <span>{p.nombre}</span>
                </label>
              ))}
            </div>
            {planes.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No hay planes.</p>}
          </div>
          <div className="anadir-form-actions">
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
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
              border: popup.type === 'success' ? '2px solid rgba(249,161,33,0.95)' : '2px solid rgba(211,46,46,0.95)',
              background: popup.type === 'success' ? 'rgba(249,161,33,0.22)' : 'rgba(211,46,46,0.20)',
            }}
          >
            <h3 style={{ marginTop: 0, color: popup.type === 'success' ? 'var(--success-green)' : 'var(--danger-red)' }}>
              {popup.type === 'success' ? 'Confirmado' : 'Error'}
            </h3>
            <p style={{ marginTop: 0, color: 'var(--text)' }}>{popup.message}</p>
            <button type="button" className={`btn ${popup.type === 'success' ? '' : 'danger'}`} onClick={() => setPopup(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

