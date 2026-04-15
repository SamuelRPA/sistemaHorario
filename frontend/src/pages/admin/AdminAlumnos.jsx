import React, { useState, useEffect } from 'react';
import DetalleAlumno from '../../components/DetalleAlumno';
import { FUNCIONES_OPCIONES, labelFuncion } from '../../constants/funciones';
import { labelModalidad } from '../../constants/modalidad';
import { soloTextoNombre, soloCelular, trimFormStrings, normalizeEnteroHorasSaldo } from '../../utils/inputFilters';
import { apiUrl } from '../../apiUrl.js';

export default function AdminAlumnos() {
  const [busqueda, setBusqueda] = useState('');
  const [funcionesFiltro, setFuncionesFiltro] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [saving, setSaving] = useState(false);

  const colorPorCantidad = (n) => {
    const num = Number(n) || 0;
    // Verde si hay pocos, luego naranja, luego rojo.
    if (num <= 5) return { bg: 'rgba(106, 198, 50, 0.18)', border: 'rgba(106,198,50,0.85)', text: 'var(--success-green)' };
    if (num <= 15) return { bg: 'rgba(249, 161, 33, 0.18)', border: 'rgba(249,161,33,0.9)', text: 'var(--orange)' };
    return { bg: 'rgba(211, 46, 46, 0.18)', border: 'rgba(211,46,46,0.92)', text: 'var(--danger-red)' };
  };

  useEffect(() => {
    fetch(apiUrl('/api/admin/planes'), { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { planes: [] })
      .then((d) => setPlanes(d.planes || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (busqueda.trim()) params.set('busqueda', busqueda.trim());
    if (funcionesFiltro.length) params.set('funciones', funcionesFiltro.join(','));
    fetch(apiUrl(`/api/admin/alumnos?${params}`), { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setAlumnos(data.alumnos || []))
      .catch(() => setAlumnos([]))
      .finally(() => setLoading(false));
  }, [busqueda, funcionesFiltro.join(',')]);

  const toggleFuncion = (id) => {
    setFuncionesFiltro((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const openDetalle = (usuarioId) => {
    setEditando(false);
    setForm(null);
    fetch(apiUrl(`/api/admin/usuarios/${usuarioId}`), { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setDetalle)
      .catch(() => setDetalle(null));
  };

  const iniciarEdicion = () => {
    const u = detalle?.usuario;
    if (!u) return;
    setForm({
      nombre: u.nombre ?? '',
      apellidos: u.apellidos ?? '',
      celular: u.celular ?? '',
      planId: u.planId ?? '',
      pais: u.pais ?? 'Bolivia',
      departamento: u.departamento ?? '',
      modalidad: u.modalidad ?? 'online',
      tutorLegal: u.tutorLegal ?? '',
      horasSaldo: u.horasSaldo != null && u.horasSaldo !== 0 ? String(u.horasSaldo) : '',
      clasesPorSemana: u.clasesPorSemana ?? '',
      observaciones: u.observaciones ?? '',
      cuotasTotales: u.cuotasTotales ?? '',
      montoTotal: u.montoTotal != null ? String(u.montoTotal) : '',
      montoEnganche: u.montoEnganche != null ? String(u.montoEnganche) : '',
      montoPorCuota: u.montoPorCuota != null ? String(u.montoPorCuota) : '',
      fechaPrimerVencimiento: u.fechaPrimerVencimiento ? String(u.fechaPrimerVencimiento).slice(0, 10) : '',
      pagoContado: u.pagoContado ?? false,
      activo: u.activo ?? true,
      funciones: (u.funciones && Array.isArray(u.funciones) ? u.funciones : []).slice(),
    });
    setEditando(true);
  };

  const guardarAlumno = (e) => {
    e.preventDefault();
    if (!detalle?.usuario?.id || !form) return;
    const nombreValido = (v) => /^[\p{L}\s'-.]+$/u.test(String(v || '').trim());
    const celularValido = (v) => !v || /^[0-9+\s-]{7,20}$/.test(String(v).trim());
    if (!nombreValido(form.nombre)) {
      alert('El nombre no puede contener números ni símbolos inválidos.');
      return;
    }
    if (!nombreValido(form.apellidos)) {
      alert('Los apellidos no pueden contener números ni símbolos inválidos.');
      return;
    }
    if (form.tutorLegal && !nombreValido(form.tutorLegal)) {
      alert('El tutor legal no puede contener números ni símbolos inválidos.');
      return;
    }
    if (!celularValido(form.celular)) {
      alert('El celular solo puede tener números y caracteres válidos (+, espacios, guiones).');
      return;
    }
    if (form.clasesPorSemana !== '' && form.clasesPorSemana != null) {
      const cps = Number(form.clasesPorSemana);
      if (!Number.isFinite(cps) || cps < 1 || cps > 10) {
        alert('Días por semana debe estar entre 1 y 10.');
        return;
      }
    }
    const mtNum = form.montoTotal === '' ? null : parseFloat(form.montoTotal, 10);
    let engNum = null;
    if (form.montoEnganche !== '' && form.montoEnganche != null) {
      engNum = Math.max(0, parseFloat(String(form.montoEnganche).replace(',', '.'), 10) || 0);
    }
    if (mtNum != null && Number.isFinite(mtNum) && engNum != null && engNum > mtNum) {
      alert('El enganche (inscripción) no puede ser mayor al monto total.');
      return;
    }
    const pasabaActivo = detalle?.usuario?.activo !== false;
    const quedaActivo = form?.activo !== false;
    if (pasabaActivo && !quedaActivo) {
      const ok = window.confirm(
        '¿Inhabilitar este alumno?\n\nSe quitarán todas sus inscripciones a horarios (quedan libres las plazas), las horas saldo pasan a 0 y no podrá iniciar sesión.'
      );
      if (!ok) return;
    }
    setSaving(true);
    const { montoPorCuota: _omitMpc, ...formSinMpc } = form;
    const payload = trimFormStrings(
      {
        ...formSinMpc,
        horasSaldo: Math.max(0, Number(form.horasSaldo) || 0),
        clasesPorSemana: form.clasesPorSemana === '' ? null : Math.max(1, parseInt(form.clasesPorSemana, 10) || 1),
        cuotasTotales: form.cuotasTotales === '' ? null : Math.max(0, Number(form.cuotasTotales) || 0),
        montoTotal: form.montoTotal === '' ? null : parseFloat(form.montoTotal, 10),
        montoEnganche: engNum,
        fechaPrimerVencimiento: form.fechaPrimerVencimiento === '' ? null : form.fechaPrimerVencimiento,
      },
      ['nombre', 'apellidos', 'celular', 'tutorLegal', 'pais', 'departamento', 'observaciones']
    );
    fetch(apiUrl(`/api/admin/usuarios/${detalle.usuario.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
      .then((r) => r.ok ? openDetalle(detalle.usuario.id) : r.json())
      .then((data) => data?.error && alert(data.error))
      .finally(() => setSaving(false));
  };

  return (
    <div>
      <h2>Alumnos</h2>
      <p style={{ color: '#6b7280' }}>Busca por nombre o apellidos y filtra por plan. Haz clic en un alumno para ver o editar todo.</p>
      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 800 }}>Cantidad de alumnos</div>
        <div
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: 9999,
            background: colorPorCantidad(alumnos.length).bg,
            border: `1px solid ${colorPorCantidad(alumnos.length).border}`,
            color: colorPorCantidad(alumnos.length).text,
            fontWeight: 900,
          }}
        >
          {alumnos.length} alumnos
        </div>
      </div>
      <div className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label>Buscar (nombre o apellidos)</label>
          <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej. Juan Pérez" />
        </div>
      </div>
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
              <tr><th>Nombre</th><th>Apellidos</th><th>Planes</th><th>Horas saldo</th><th>Modalidad</th><th></th></tr>
            </thead>
            <tbody>
              {alumnos.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td>{u.apellidos}</td>
                  <td>{(u.funciones || []).map(labelFuncion).join(', ') || '-'}</td>
                  <td>{u.horasSaldo}</td>
                  <td>{labelModalidad(u.modalidad)}</td>
                  <td><button type="button" className="btn" onClick={() => openDetalle(u.id)}>Ver detalle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && alumnos.length === 0 && <p style={{ color: '#6b7280' }}>No hay alumnos que coincidan con el filtro.</p>}
      </div>
      {detalle && (
        <div className="modal-overlay" onClick={() => { setDetalle(null); setEditando(false); setForm(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '60vw', height: '60vh', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>{detalle.usuario?.nombre} {detalle.usuario?.apellidos}</h3>
                <p className="text-muted" style={{ marginTop: 0, marginBottom: 0 }}>
                  Ver detalle del alumno
                </p>
              </div>
              {!editando ? (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn" onClick={iniciarEdicion}>Editar</button>
                  <button type="button" className="btn secondary" onClick={() => { setDetalle(null); setEditando(false); setForm(null); }}>Cerrar</button>
                </div>
              ) : null}
            </div>
            <div style={{ height: 1, background: 'rgba(44,58,141,0.14)', margin: '0.9rem 0 1rem 0' }} />
            {!editando ? (
              <>
                <DetalleAlumno
                  usuario={detalle.usuario}
                  ultimoRegistro={detalle.ultimoRegistro}
                  historialAuditoria={detalle.historialAuditoria}
                  mostrarId={false}
                  acciones={
                    <div className="card" style={{ marginTop: '1rem', borderLeft: '4px solid var(--success-green)' }}>
                      <h4>Horas (saldo)</h4>
                      <AccionesRapidasHoras usuario={detalle.usuario} onDone={() => openDetalle(detalle.usuario?.id)} />
                    </div>
                  }
                />
              </>
            ) : (
              <form onSubmit={guardarAlumno} className="anadir-form" style={{ boxShadow: 'none', padding: 0 }}>
                <div className="anadir-section">
                  <div className="anadir-section-title">Datos personales</div>
                  <div className="anadir-form-grid">
                    <div className="form-group"><label>Nombre *</label><input value={form?.nombre} onChange={(e) => setForm({ ...form, nombre: soloTextoNombre(e.target.value) })} onBlur={(e) => setForm({ ...form, nombre: soloTextoNombre(e.target.value.trim()) })} inputMode="text" required /></div>
                    <div className="form-group"><label>Apellidos *</label><input value={form?.apellidos} onChange={(e) => setForm({ ...form, apellidos: soloTextoNombre(e.target.value) })} onBlur={(e) => setForm({ ...form, apellidos: soloTextoNombre(e.target.value.trim()) })} inputMode="text" required /></div>
                    <div className="form-group"><label>Celular</label><input value={form?.celular} onChange={(e) => setForm({ ...form, celular: soloCelular(e.target.value) })} onBlur={(e) => setForm({ ...form, celular: soloCelular(e.target.value.trim()) })} inputMode="tel" /></div>
                    <div className="form-group"><label>Tutor legal</label><input value={form?.tutorLegal} onChange={(e) => setForm({ ...form, tutorLegal: soloTextoNombre(e.target.value) })} onBlur={(e) => setForm({ ...form, tutorLegal: soloTextoNombre(e.target.value.trim()) })} inputMode="text" /></div>
                  </div>
                </div>
                <div className="anadir-section">
                  <div className="anadir-section-title">Planes y ubicación</div>
                  <div className="anadir-form-grid">
                    <div className="form-group full-width">
                      <label>Planes (materias)</label>
                      <div className="anadir-checkgroup" style={{ marginTop: '0.35rem' }}>
                        {FUNCIONES_OPCIONES.map((f) => (
                          <label key={f.id}>
                            <input type="checkbox" checked={(form?.funciones || []).includes(f.id)} onChange={(e) => setForm({ ...form, funciones: e.target.checked ? [...(form.funciones || []), f.id] : (form.funciones || []).filter((id) => id !== f.id) })} />
                            <span>{f.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="form-group"><label>Plan (paquete)</label><select value={form?.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}><option value="">Sin plan</option>{planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
                    <div className="form-group"><label>País</label><input value={form?.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })} onBlur={(e) => setForm({ ...form, pais: e.target.value.trim() })} /></div>
                    <div className="form-group"><label>Departamento</label><input value={form?.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} onBlur={(e) => setForm({ ...form, departamento: e.target.value.trim() })} /></div>
                    <div className="form-group"><label>Modalidad</label><select value={form?.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value })}><option value="presencial">Presencial</option><option value="online">Virtual</option><option value="ambos">Presencial y virtual (ambos)</option></select></div>
                  </div>
                </div>
                <div className="anadir-section">
                  <div className="anadir-section-title">Horas y pagos</div>
                  <div className="anadir-form-grid">
                    <div className="form-group"><label>Horas saldo</label><input type="text" inputMode="numeric" autoComplete="off" value={form?.horasSaldo ?? ''} onChange={(e) => setForm({ ...form, horasSaldo: normalizeEnteroHorasSaldo(e.target.value) })} placeholder="Ej. 32" /></div>
                    <div className="form-group"><label>Días por semana (clases) para fecha estimada</label><input type="number" min={1} max={10} value={form?.clasesPorSemana} onChange={(e) => setForm({ ...form, clasesPorSemana: e.target.value })} placeholder="Ej. 2" /></div>
                    <div className="form-group"><label>Cuotas totales</label><input type="number" min={0} value={form?.cuotasTotales} onChange={(e) => setForm({ ...form, cuotasTotales: e.target.value })} /></div>
                    <div className="form-group"><label>Monto total</label><input type="number" min={0} step="0.01" value={form?.montoTotal} onChange={(e) => setForm({ ...form, montoTotal: e.target.value })} placeholder="Ej. 3000" /></div>
                    <div className="form-group"><label>Enganche / inscripción</label><input type="number" min={0} step="0.01" value={form?.montoEnganche ?? ''} onChange={(e) => setForm({ ...form, montoEnganche: e.target.value })} placeholder="Se resta del total" /></div>
                    <div className="form-group"><label>Monto por cuota (calculado)</label><input type="text" readOnly value={form?.montoPorCuota != null && form?.montoPorCuota !== '' ? form.montoPorCuota : ''} placeholder="Se recalcula al guardar" style={{ background: '#f8fafc' }} /></div>
                    {form?.cuotasTotales !== '' && Number(form?.cuotasTotales) > 0 && !form?.pagoContado && (
                      <div className="form-group">
                        <label>Fecha primer vencimiento</label>
                        <input type="date" value={form?.fechaPrimerVencimiento || ''} onChange={(e) => setForm({ ...form, fechaPrimerVencimiento: e.target.value })} />
                      </div>
                    )}
                    <div className="form-group">
                      <label className="check-left">
                        <input type="checkbox" checked={form?.pagoContado} onChange={(e) => setForm({ ...form, pagoContado: e.target.checked })} />
                        Pago al contado
                      </label>
                    </div>
                    <div className="form-group">
                      <label className="check-left">
                        <input type="checkbox" checked={form?.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                        Activo (al desmarcar: quita inscripciones, horas saldo 0, sin acceso)
                      </label>
                    </div>
                  </div>
                </div>
                <div className="anadir-section">
                  <div className="anadir-section-title">Observaciones</div>
                  <div className="form-group"><textarea value={form?.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} onBlur={(e) => setForm({ ...form, observaciones: e.target.value.trim() })} rows={2} style={{ width: '100%' }} /></div>
                </div>
                <div className="anadir-form-actions">
                  <button type="submit" className="btn" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
                  <button type="button" className="btn danger" style={{ marginLeft: 8 }} onClick={() => { setEditando(false); setForm(null); }}>Cancelar</button>
                </div>
              </form>
            )}
            {editando ? (
              <button type="button" className="btn secondary" style={{ marginTop: '1rem' }} onClick={() => { setDetalle(null); setEditando(false); setForm(null); }}>
                Cerrar
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function AccionesRapidasHoras({ usuario, onDone }) {
  const usuarioId = usuario?.id;
  const currentHoras = Math.max(0, Number(usuario?.horasSaldo) || 0);
  const [horas, setHoras] = useState('');

  const patch = (body, reset) => {
    if (!usuarioId) return;
    fetch(apiUrl(`/api/admin/usuarios/${usuarioId}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then((r) => r.ok ? (onDone(), reset?.()) : r.json())
      .then((data) => data?.error && alert(data.error));
  };

  const bajarHoras = () => patch({ horasSaldo: Math.max(0, currentHoras - 1) });
  const subirHoras = () => patch({ horasSaldo: currentHoras + 1 });
  const aplicar = () => {
    if (horas === '') return;
    const n = Math.max(0, parseInt(horas, 10) || 0);
    patch({ horasSaldo: n }, () => setHoras(''));
  };

  if (!usuarioId) return null;
  return (
    <>
      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn secondary" onClick={bajarHoras} disabled={currentHoras <= 0}>Bajar</button>
          <span style={{ minWidth: '2rem' }}>{currentHoras}</span>
          <button type="button" className="btn secondary" onClick={subirHoras}>Subir</button>
          <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>o valor:</span>
          <input type="text" inputMode="numeric" autoComplete="off" value={horas} onChange={(e) => setHoras(normalizeEnteroHorasSaldo(e.target.value))} placeholder="Opcional" style={{ width: '5rem' }} />
        </div>
      </div>
      <button type="button" className="btn" onClick={aplicar}>Aplicar</button>
    </>
  );
}
