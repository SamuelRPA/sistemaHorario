import React, { useState, useEffect, useMemo } from 'react';
import DetalleAlumno from '../../components/DetalleAlumno';
import { labelModalidad } from '../../constants/modalidad';
import { normalizeEnteroHorasSaldo } from '../../utils/inputFilters';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Franjas horarias de 7:00 a 21:00 (cada hora)
const SLOTS_HORARIOS = Array.from({ length: 15 }, (_, i) => {
  const h = 7 + i;
  return `${String(h).padStart(2, '0')}:00`;
});

export default function AdminHorarios() {
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalidad, setModalidad] = useState('');
  const [slotDetalle, setSlotDetalle] = useState(null);
  const [usuarioDetalle, setUsuarioDetalle] = useState(null);
  const [eleccionMultiples, setEleccionMultiples] = useState(null); // { slots: [...] } para elegir cuál ver

  useEffect(() => {
    const q = modalidad ? `?modalidad=${modalidad}` : '';
    fetch(`/api/admin/horarios${q}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setHorarios(data.horarios || []))
      .catch(() => setHorarios([]))
      .finally(() => setLoading(false));
  }, [modalidad]);

  // Grid: por cada (diaSemana, horaInicio) agrupar horarios (puede haber virtual y presencial a la misma hora)
  const grid = useMemo(() => {
    const g = {};
    SLOTS_HORARIOS.forEach((hora) => {
      DIAS.forEach((_, idx) => {
        const dia = idx + 1;
        const key = `${dia}-${hora}`;
        g[key] = horarios.filter(
          (h) => h.diaSemana === dia && h.horaInicio === hora && !h.cerrado
        );
      });
    });
    return g;
  }, [horarios]);

  const openSlot = (h) => {
    setUsuarioDetalle(null);
    setEleccionMultiples(null);
    fetch(`/api/admin/horarios/${h.id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setSlotDetalle)
      .catch(() => setSlotDetalle(h));
  };

  const openCelda = (diaIndex, hora) => {
    const dia = diaIndex + 1;
    const key = `${dia}-${hora}`;
    const slots = grid[key] || [];
    if (slots.length === 0) return;
    if (slots.length === 1) {
      openSlot(slots[0]);
    } else {
      setEleccionMultiples({ slots, hora, diaNombre: DIAS[diaIndex] });
      setSlotDetalle(null);
      setUsuarioDetalle(null);
    }
  };

  const openUsuario = (usuarioId) => {
    fetch(`/api/admin/usuarios/${usuarioId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setUsuarioDetalle)
      .catch(() => setUsuarioDetalle(null));
  };

  if (loading) return <div className="card">Cargando...</div>;

  return (
    <div>
      <h2>Horarios</h2>
      <p style={{ color: '#6b7280' }}>Haz clic en una celda con clase para ver alumnos y asesora. Si hay varias clases a la misma hora, podrás elegir cuál ver.</p>
      <div className="form-group" style={{ maxWidth: 220, marginBottom: '1rem' }}>
        <label>Filtrar por modalidad</label>
        <select value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
          <option value="">Todas (virtual y presencial)</option>
          <option value="online">Solo virtual</option>
          <option value="presencial">Solo presencial</option>
        </select>
      </div>
      <div className="card card-schedule" style={{ overflowX: 'auto' }}>
        <table className="schedule-grid">
          <thead>
            <tr>
              <th className="schedule-time-col">Hora</th>
              {DIAS.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS_HORARIOS.map((hora) => (
              <tr key={hora}>
                <td className="schedule-time-col">{hora}</td>
                {DIAS.map((d, diaIndex) => {
                  const key = `${diaIndex + 1}-${hora}`;
                  const slots = grid[key] || [];
                  const totalAlumnos = slots.reduce(
                    (acc, s) => acc + (s.inscripciones?.length ?? s._count?.inscripciones ?? 0),
                    0
                  );
                  const tieneClase = slots.length > 0;
                  return (
                    <td
                      key={key}
                      className={`schedule-cell ${
                        tieneClase
                          ? (totalAlumnos > 0 ? 'schedule-cell--has-class' : 'schedule-cell--without-students')
                          : 'schedule-cell--empty'
                      }`}
                      onClick={() => openCelda(diaIndex, hora)}
                    >
                      {slots.length === 0 && '-'}
                      {slots.length === 1 && (
                        <span className="schedule-cell-label">
                          {labelModalidad(slots[0].modalidad)}
                          {' — '}
                          {slots[0].asesora ? `${slots[0].asesora.nombre} ${slots[0].asesora.apellidos}` : '-'}
                        </span>
                      )}
                      {slots.length > 1 && (
                        <span className="schedule-cell-label schedule-cell-label--multiple">
                          {slots.length} clases (clic para elegir)
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Popup: elegir qué clase ver cuando hay varias en la misma hora */}
      {eleccionMultiples && (
        <div className="modal-overlay" onClick={() => setEleccionMultiples(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: 360 }}>
            <h3>Hay varias clases a las {eleccionMultiples.hora} del {eleccionMultiples.diaNombre}</h3>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Elige cuál ver:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {eleccionMultiples.slots.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className="btn"
                  onClick={() => {
                    openSlot(h);
                    setEleccionMultiples(null);
                  }}
                >
                  {labelModalidad(h.modalidad)} — {h.asesora ? `${h.asesora.nombre} ${h.asesora.apellidos}` : '-'} ({h.inscripciones?.length ?? 0} alumnos)
                </button>
              ))}
            </div>
            <button type="button" className="btn secondary" style={{ marginTop: '1rem' }} onClick={() => setEleccionMultiples(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Popup: detalle del slot (alumnos, asesora) */}
      {slotDetalle && (
        <div className="modal-overlay" onClick={() => { setSlotDetalle(null); setUsuarioDetalle(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: 480 }}>
            <h3>{DIAS[slotDetalle.diaSemana - 1]} {slotDetalle.horaInicio}–{slotDetalle.horaFin} ({labelModalidad(slotDetalle.modalidad)})</h3>
            <p><strong>Asesora:</strong> {slotDetalle.asesora ? `${slotDetalle.asesora.nombre} ${slotDetalle.asesora.apellidos}` : '-'}</p>
            <table>
              <thead>
                <tr><th>Alumno</th><th>Plan</th><th></th></tr>
              </thead>
              <tbody>
                {(slotDetalle.inscripciones || []).map((i) => (
                  <tr key={i.usuarioId}>
                    <td>{i.usuario?.nombre} {i.usuario?.apellidos}</td>
                    <td>{i.usuario?.plan?.nombre ?? '-'}</td>
                    <td><button type="button" className="btn secondary" onClick={() => openUsuario(i.usuarioId)}>Ver usuario</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AdminSustitucionesSemanales
              horarioId={slotDetalle.id}
              titularId={slotDetalle.asesora?.id}
              items={slotDetalle.sustitucionesSemanales || []}
              onChanged={() => {
                fetch(`/api/admin/horarios/${slotDetalle.id}`, { credentials: 'include' })
                  .then((r) => (r.ok ? r.json() : Promise.reject()))
                  .then(setSlotDetalle)
                  .catch(() => {});
              }}
            />
            <button type="button" className="btn" style={{ marginTop: '1rem' }} onClick={() => { setSlotDetalle(null); setUsuarioDetalle(null); }}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Popup: detalle del alumno */}
      {usuarioDetalle && (
        <div className="modal-overlay" onClick={() => setUsuarioDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
            <h3>{usuarioDetalle.usuario?.nombre} {usuarioDetalle.usuario?.apellidos}</h3>
            <DetalleAlumno
              usuario={usuarioDetalle.usuario}
              ultimoRegistro={usuarioDetalle.ultimoRegistro}
              historialAuditoria={usuarioDetalle.historialAuditoria}
              mostrarId={false}
            />
            <button type="button" className="btn" style={{ marginTop: '1rem' }} onClick={() => setUsuarioDetalle(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function lunesSiguiente(fechaStr) {
  const d = new Date(`${fechaStr}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

function AdminSustitucionesSemanales({ horarioId, titularId, items, onChanged }) {
  const [asesoras, setAsesoras] = useState([]);
  const [semanaInicio, setSemanaInicio] = useState(() => lunesSiguiente(new Date().toISOString().slice(0, 10)));
  const [sustitutaId, setSustitutaId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/asesoras', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setAsesoras(d.asesoras || []))
      .catch(() => setAsesoras([]));
  }, []);

  const opcionesSustituta = useMemo(
    () => asesoras.filter((a) => a.id !== titularId),
    [asesoras, titularId]
  );

  const guardar = () => {
    if (!sustitutaId) {
      alert('Elige la asesora sustituta.');
      return;
    }
    setSaving(true);
    fetch('/api/admin/sustituciones-semanales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ horarioId, semanaInicio, asesoraSustitutaId: sustitutaId }),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e))))
      .then(() => {
        setSustitutaId('');
        onChanged();
      })
      .catch((e) => alert(e.error || 'No se pudo guardar'))
      .finally(() => setSaving(false));
  };

  const eliminar = (id) => {
    if (!window.confirm('¿Quitar esta sustitución? La titular volverá a gestionar esa semana.')) return;
    fetch(`/api/admin/sustituciones-semanales/${id}`, { method: 'DELETE', credentials: 'include' })
      .then((r) => (r.ok ? onChanged() : r.json().then((e) => Promise.reject(e))))
      .catch((e) => alert(e.error || 'Error al eliminar'));
  };

  return (
    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
      <h4 style={{ marginTop: 0 }}>Sustitución por una semana</h4>
      <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
        Solo esa semana (desde el lunes elegido) otra asesora dicta el horario y las horas cuentan para ella al marcar la clase. El resto de semanas sigue la titular.
      </p>
      <div className="form-group" style={{ maxWidth: 280 }}>
        <label>Lunes de la semana</label>
        <input type="date" value={semanaInicio} onChange={(e) => setSemanaInicio(e.target.value)} />
      </div>
      <div className="form-group" style={{ maxWidth: 360 }}>
        <label>Asesora sustituta</label>
        <select value={sustitutaId} onChange={(e) => setSustitutaId(e.target.value)}>
          <option value="">— Elegir —</option>
          {opcionesSustituta.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre} {a.apellidos}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="btn" onClick={guardar} disabled={saving}>
        {saving ? 'Guardando…' : 'Asignar sustitución'}
      </button>
      {items.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Programadas</strong>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
            {items.map((s) => (
              <li key={s.id} style={{ marginBottom: '0.35rem' }}>
                Semana del {s.semanaInicio?.slice?.(0, 10) ?? '—'}:{' '}
                {s.asesoraSustituta ? `${s.asesoraSustituta.nombre} ${s.asesoraSustituta.apellidos}` : '—'}{' '}
                <button type="button" className="btn secondary" style={{ marginLeft: 8, padding: '0.2rem 0.5rem' }} onClick={() => eliminar(s.id)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AdminUsuarioAcciones({ usuarioId, onDone }) {
  const [horas, setHoras] = useState('');
  const [activo, setActivo] = useState(null);

  const aplicar = () => {
    const body = {};
    if (horas !== '') body.horasSaldo = parseInt(horas, 10);
    if (activo !== null) body.activo = activo;
    if (Object.keys(body).length === 0) return;
    fetch(`/api/admin/usuarios/${usuarioId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then((r) => r.ok ? (onDone(), setHoras(''), setActivo(null)) : r.json())
      .then((data) => data?.error && alert(data.error));
  };

  return (
    <>
      <div className="form-group">
        <label>Horas (saldo)</label>
        <input type="text" inputMode="numeric" autoComplete="off" value={horas} onChange={(e) => setHoras(normalizeEnteroHorasSaldo(e.target.value))} placeholder="Dejar vacío para no cambiar" />
      </div>
      <div className="form-group">
        <label>Estado</label>
        <select value={activo === null ? '' : activo} onChange={(e) => setActivo(e.target.value === '' ? null : e.target.value === 'true')}>
          <option value="">Sin cambiar</option>
          <option value="true">Activo</option>
          <option value="false">Inhabilitar</option>
        </select>
      </div>
      <button type="button" className="btn" onClick={aplicar}>Aplicar</button>
    </>
  );
}
