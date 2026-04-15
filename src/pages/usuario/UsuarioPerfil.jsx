import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { soloTextoNombre, soloCelular, trimFormStrings } from '../../utils/inputFilters';
import { labelModalidad } from '../../constants/modalidad';
import { apiUrl } from '../../apiUrl.js';

export default function UsuarioPerfil() {
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState(null); // { type: 'success'|'error', message }

  useEffect(() => {
    fetch(apiUrl('/api/usuario/perfil'), { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p) => {
        setPerfil(p);
        setForm({
          nombre: p.nombre ?? '',
          apellidos: p.apellidos ?? '',
          celular: p.celular ?? '',
          tutorLegal: p.tutorLegal ?? '',
          pais: p.pais ?? 'Bolivia',
          departamento: p.departamento ?? '',
          modalidad: p.modalidad ?? 'online',
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
        nombre: form.nombre,
        apellidos: form.apellidos,
        celular: form.celular,
      },
      ['nombre', 'apellidos', 'celular']
    );
    fetch(apiUrl('/api/usuario/perfil'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d))))
      .then(() => {
        fetch(apiUrl('/api/usuario/perfil'), { credentials: 'include' })
          .then((res) => (res.ok ? res.json() : Promise.reject()))
          .then(setPerfil);
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
        Actualiza tus datos personales. El horario de clase lo eliges o cambias según tu plan y la disponibilidad de la asesora.
      </p>

      <div className="anadir-form">
        <form onSubmit={submit}>
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
              <div className="form-group">
                <label>Tutor legal</label>
                <input value={form.tutorLegal} disabled placeholder="Solo administrador" />
              </div>
              <div className="form-group">
                <label>País</label>
                <input value={form.pais} disabled placeholder="Solo administrador" />
              </div>
              <div className="form-group">
                <label>Departamento</label>
                <input value={form.departamento} disabled placeholder="Solo administrador" />
              </div>
              <div className="form-group">
                <label>Modalidad</label>
                <select value={form.modalidad} disabled>
                  <option value="presencial">{labelModalidad('presencial')}</option>
                  <option value="online">{labelModalidad('online')}</option>
                  <option value="ambos">{labelModalidad('ambos')}</option>
                </select>
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

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="anadir-section-title">Mi horario</div>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Puedes elegir o cambiar tu horario de clase según tu plan y la disponibilidad de la asesora.
        </p>
        <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          <Link to="/usuario/horarios-disponibles" className="btn" style={{ display: 'inline-block', marginTop: 4 }}>
            Ver horarios disponibles y elegir / cambiar
          </Link>
        </p>
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
