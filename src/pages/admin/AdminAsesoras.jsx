import React, { useState, useEffect } from 'react';
import { soloTextoNombre, soloCelular, trimFormStrings } from '../../utils/inputFilters';
import { FUNCIONES_OPCIONES, labelFuncion } from '../../constants/funciones';
import { apiUrl } from '../../apiUrl.js';

export default function AdminAsesoras() {
  const [funcionesFiltro, setFuncionesFiltro] = useState([]);
  const [asesoras, setAsesoras] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/admin/planes'), { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { planes: [] })
      .then((d) => setPlanes(d.planes || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = funcionesFiltro.length ? new URLSearchParams({ funciones: funcionesFiltro.join(',') }) : new URLSearchParams();
    fetch(apiUrl(`/api/admin/asesoras?${params}`), { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setAsesoras(data.asesoras || []))
      .catch(() => setAsesoras([]))
      .finally(() => setLoading(false));
  }, [funcionesFiltro.join(',')]);

  const toggleFuncion = (id) => {
    setFuncionesFiltro((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const iniciarEdicion = () => {
    const a = detalle;
    if (!a) return;
    setForm({
      nombre: a.nombre ?? '',
      apellidos: a.apellidos ?? '',
      celular: a.celular ?? '',
      linkZoomGlobal: a.linkZoomGlobal ?? '',
      funciones: (a.funciones && Array.isArray(a.funciones) ? a.funciones : []).slice(),
      planIds: (a.planesAsesora || []).map((pa) => pa.planId),
      activo: a.activo !== false,
    });
    setEditando(true);
  };

  const guardarAsesora = (e) => {
    e.preventDefault();
    if (!detalle?.id || !form) return;
    const pasabaActiva = detalle.activo !== false;
    const quedaActiva = form?.activo !== false;
    if (pasabaActiva && !quedaActiva) {
      const ok = window.confirm(
        '¿Inhabilitar esta asesora?\n\nSe eliminarán todas sus franjas (horarios), inscripciones y sesiones vinculadas. Los cupos quedarán libres. No podrá iniciar sesión.'
      );
      if (!ok) return;
    }
    setSaving(true);
    const body = trimFormStrings({ ...form, activo: form?.activo !== false }, [
      'nombre',
      'apellidos',
      'celular',
      'linkZoomGlobal',
    ]);
    fetch(apiUrl(`/api/admin/asesoras/${detalle.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then((r) => r.ok ? (setDetalle(null), setEditando(false), setForm(null), fetch(apiUrl(`/api/admin/asesoras?${funcionesFiltro.length ? new URLSearchParams({ funciones: funcionesFiltro.join(',') }) : ''}`), { credentials: 'include' }).then((res) => res.json()).then((d) => setAsesoras(d.asesoras || []))) : r.json())
      .then((data) => data?.error && alert(data.error))
      .finally(() => setSaving(false));
  };

  return (
    <div>
      <h2>Asesoras</h2>
      <p style={{ color: '#6b7280' }}>Filtra por plan. Haz clic en una asesora para ver o editar toda su información.</p>
      <div className="card">
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Planes</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {FUNCIONES_OPCIONES.map((f) => (
            <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input type="checkbox" checked={funcionesFiltro.includes(f.id)} onChange={() => toggleFuncion(f.id)} />
              {f.label}
            </label>
          ))}
        </div>
      </div>
      <div className="card">
        {loading && <p>Cargando...</p>}
        {!loading && (
          <table>
            <thead>
              <tr><th>Nombre</th><th>Apellidos</th><th>Planes</th><th>Planes asignados</th><th></th></tr>
            </thead>
            <tbody>
              {asesoras.map((a) => (
                <tr key={a.id}>
                  <td>{a.nombre}</td>
                  <td>{a.apellidos}</td>
                  <td>{(a.funciones || []).map(labelFuncion).join(', ') || '-'}</td>
                  <td>{(a.planesAsesora || []).map((pa) => pa.plan?.nombre).filter(Boolean).join(', ') || '-'}</td>
                  <td><button type="button" className="btn" onClick={() => { setDetalle(a); setEditando(false); setForm(null); }}>Ver detalle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && asesoras.length === 0 && <p style={{ color: '#6b7280' }}>No hay asesoras que coincidan con el filtro.</p>}
      </div>
      {detalle && (
        <div className="modal-overlay" onClick={() => { setDetalle(null); setEditando(false); setForm(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '60vw', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>{detalle.nombre} {detalle.apellidos}</h3>
            {!editando ? (
              <>
                <div className="stats-card">
                  <div className="anadir-section-title">Datos</div>
                  <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1.5rem', margin: 0, fontSize: '0.9375rem' }}>
                    <dt style={{ color: '#6b7280' }}>Email</dt><dd>{detalle.cuenta?.email ?? detalle.email ?? '-'}</dd>
                    <dt style={{ color: '#6b7280' }}>Estado</dt><dd><span className={detalle.activo !== false ? 'stats-badge yes' : 'stats-badge no'}>{detalle.activo !== false ? 'Activa' : 'Inhabilitada'}</span></dd>
                    <dt style={{ color: '#6b7280' }}>Celular</dt><dd>{detalle.celular ?? '-'}</dd>
                    <dt style={{ color: '#6b7280' }}>Planes (materias)</dt><dd>{(detalle.funciones || []).map(labelFuncion).join(', ') || '-'}</dd>
                    <dt style={{ color: '#6b7280' }}>Link Zoom</dt><dd>{detalle.linkZoomGlobal ? <a href={detalle.linkZoomGlobal} target="_blank" rel="noreferrer">Abrir</a> : '-'}</dd>
                    <dt style={{ color: '#6b7280' }}>Planes asignados</dt><dd>{(detalle.planesAsesora || []).map((pa) => pa.plan?.nombre).filter(Boolean).join(', ') || '-'}</dd>
                  </dl>
                </div>
                <button type="button" className="btn" style={{ marginRight: 8 }} onClick={iniciarEdicion}>Editar</button>
              </>
            ) : (
              <form onSubmit={guardarAsesora} className="anadir-form" style={{ boxShadow: 'none', padding: 0 }}>
                <div className="anadir-section">
                  <div className="anadir-section-title">Datos personales</div>
                  <div className="anadir-form-grid">
                    <div className="form-group"><label>Nombre *</label><input value={form?.nombre} onChange={(e) => setForm({ ...form, nombre: soloTextoNombre(e.target.value) })} onBlur={(e) => setForm({ ...form, nombre: soloTextoNombre(e.target.value.trim()) })} inputMode="text" required /></div>
                    <div className="form-group"><label>Apellidos *</label><input value={form?.apellidos} onChange={(e) => setForm({ ...form, apellidos: soloTextoNombre(e.target.value) })} onBlur={(e) => setForm({ ...form, apellidos: soloTextoNombre(e.target.value.trim()) })} inputMode="text" required /></div>
                    <div className="form-group"><label>Celular</label><input value={form?.celular} onChange={(e) => setForm({ ...form, celular: soloCelular(e.target.value) })} onBlur={(e) => setForm({ ...form, celular: soloCelular(e.target.value.trim()) })} inputMode="tel" placeholder="Opcional" /></div>
                    <div className="form-group full-width">
                      <label className="check-left">
                        <input type="checkbox" checked={form?.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                        Activa (al desmarcar: no puede entrar y se borran todas sus clases/horarios; cupos libres)
                      </label>
                    </div>
                    <div className="form-group full-width"><label>Link Zoom global</label><input type="url" value={form?.linkZoomGlobal} onChange={(e) => setForm({ ...form, linkZoomGlobal: e.target.value })} onBlur={(e) => setForm({ ...form, linkZoomGlobal: e.target.value.trim() })} placeholder="https://zoom.us/..." /></div>
                  </div>
                </div>
                <div className="anadir-section">
                  <div className="anadir-section-title">Planes que imparte (materias)</div>
                  <div className="anadir-checkgroup" style={{ marginTop: '0.35rem' }}>
                    {FUNCIONES_OPCIONES.map((f) => (
                      <label key={f.id}>
                        <input type="checkbox" checked={(form?.funciones || []).includes(f.id)} onChange={(e) => setForm({ ...form, funciones: e.target.checked ? [...(form.funciones || []), f.id] : (form.funciones || []).filter((id) => id !== f.id) })} />
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
                        <input type="checkbox" checked={(form?.planIds || []).includes(p.id)} onChange={(e) => setForm({ ...form, planIds: e.target.checked ? [...(form.planIds || []), p.id] : (form.planIds || []).filter((id) => id !== p.id) })} />
                        <span>{p.nombre}</span>
                      </label>
                    ))}
                  </div>
                  {planes.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No hay planes.</p>}
                </div>
                <div className="anadir-form-actions">
                  <button type="submit" className="btn" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
                  <button type="button" className="btn danger" style={{ marginLeft: 8 }} onClick={() => { setEditando(false); setForm(null); }}>Cancelar</button>
                </div>
              </form>
            )}
            <button type="button" className="btn" style={{ marginTop: '1rem' }} onClick={() => { setDetalle(null); setEditando(false); setForm(null); }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
