import React, { useEffect, useMemo, useState } from 'react';
import { labelModalidad } from '../../constants/modalidad';
import { textoMateriasAlumno } from '../../utils/materiasAlumno';
import { lunesISODeFecha, ordenarHorariosPorDiaHora } from '../../utils/semana';
import { apiUrl } from '../../apiUrl.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
// Franjas horarias de 07:00 a 21:00 (cada hora)
const SLOTS_HORARIOS = Array.from({ length: 15 }, (_, i) => {
  const h = 7 + i;
  return `${String(h).padStart(2, '0')}:00`;
});

function cuentaAlumnosSlot(h) {
  if (h.alumnosEfectivosSemana != null) return h.alumnosEfectivosSemana;
  return h._count?.inscripciones ?? 0;
}

export default function AsesoraHorarios() {
  const [horarios, setHorarios] = useState([]);
  const [sustitucionesComoSustituta, setSustitucionesComoSustituta] = useState([]);
  const [sustitucionesComoTitular, setSustitucionesComoTitular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(null);
  const [eleccionMultiples, setEleccionMultiples] = useState(null); // { slots, diaNombre, hora }
  const [sesionData, setSesionData] = useState({ alumnos: [], sesionId: null, puedeEditarAsistencia: true });
  const [alumnoDetalle, setAlumnoDetalle] = useState(null);
  const [historialModalAlumno, setHistorialModalAlumno] = useState(null);
  const [historialAlumno, setHistorialAlumno] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let cancelled = false;
    const lunes = lunesISODeFecha(fecha);
    setLoading(true);
    fetch(apiUrl(`/api/asesora/horarios?lunesSemana=${lunes}`), { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        if (cancelled) return;
        setHorarios(data.horarios || []);
        setSustitucionesComoSustituta(data.sustitucionesComoSustituta || []);
        setSustitucionesComoTitular(data.sustitucionesComoTitular || []);
      })
      .catch(() => {
        if (!cancelled) {
          setHorarios([]);
          setSustitucionesComoSustituta([]);
          setSustitucionesComoTitular([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fecha]);

  const abrirSlot = (horarioId) => {
    setPopup(horarioId);
    setSesionData({ alumnos: [], sesionId: null, puedeEditarAsistencia: true, rolSesion: null });
    setAlumnoDetalle(null);
    fetch(apiUrl(`/api/asesora/sesion/${horarioId}/alumnos?fecha=${fecha}`), { credentials: 'include' })
      .then(async (r) => {
        const errBody = r.ok ? null : await r.json().catch(() => ({}));
        if (r.status === 403 && errBody?.codigo === 'sustitucion_activa') {
          alert(errBody.error || 'Esta semana cubre la sustituta.');
          setPopup(null);
          throw new Error('sustitucion');
        }
        if (!r.ok) throw new Error(errBody?.error || 'Error');
        return r.json();
      })
      .then(async (data) => {
        if (!data.sesionId && data.alumnos?.length > 0) {
          await fetch(apiUrl('/api/asesora/sesion'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ horarioId, fecha }),
          });
          const res = await fetch(apiUrl(`/api/asesora/sesion/${horarioId}/alumnos?fecha=${fecha}`), { credentials: 'include' });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || 'Error');
          }
          return res.json();
        }
        return data;
      })
      .then((data) => setSesionData({
        alumnos: data.alumnos || [],
        sesionId: data.sesionId,
        puedeEditarAsistencia: data.puedeEditarAsistencia !== false,
        rolSesion: data.rolSesion ?? null,
      }))
      .catch((e) => {
        if (e.message !== 'sustitucion') {
          setSesionData({ alumnos: [], sesionId: null, puedeEditarAsistencia: true, rolSesion: null });
        }
      });
  };

  const { alumnos, sesionId, puedeEditarAsistencia: puedeEditar, rolSesion } = sesionData;

  const horariosParaGrid = useMemo(() => {
    const lunes = lunesISODeFecha(fecha);
    const semanaKey = (s) => (typeof s.semanaInicio === 'string' ? s.semanaInicio.slice(0, 10) : '');
    const subs = sustitucionesComoSustituta.filter((s) => semanaKey(s) === lunes);
    const extras = subs.map((s) => ({
      ...s.horario,
      _esSustitucion: true,
      _titularEtiqueta: s.horario?.asesora ? `${s.horario.asesora.nombre} ${s.horario.asesora.apellidos}` : '',
    }));
    const own = horarios.map((h) => {
      const cubre = sustitucionesComoTitular.find((t) => t.horarioId === h.id && semanaKey(t) === lunes);
      return cubre ? { ...h, _cubiertaPor: cubre.sustituta } : h;
    });
    return ordenarHorariosPorDiaHora([...own, ...extras]);
  }, [horarios, sustitucionesComoSustituta, sustitucionesComoTitular, fecha]);

  const horarioSeleccionado = popup ? horariosParaGrid.find((h) => h.id === popup) : null;

  const marcarTodosPresentes = () => {
    if (!sesionId) return;
    fetch(apiUrl(`/api/asesora/sesion/${sesionId}/marcar-todos-presentes`), { method: 'POST', credentials: 'include' })
      .then((r) => r.ok ? abrirSlot(popup) : r.json())
      .then((data) => data?.error && alert(data.error));
  };

  const abrirHistorialAlumno = (alumno) => {
    setHistorialModalAlumno(alumno);
    setHistorialAlumno([]);
    setLoadingHistorial(true);
    fetch(apiUrl(`/api/asesora/alumno/${alumno.usuarioId}/historial`), { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setHistorialAlumno(data.historial || []))
      .catch(() => setHistorialAlumno([]))
      .finally(() => setLoadingHistorial(false));
  };

  const grid = useMemo(() => {
    const g = {};
    SLOTS_HORARIOS.forEach((hora) => {
      DIAS.forEach((_, idx) => {
        const dia = idx + 1;
        const key = `${dia}-${hora}`;
        g[key] = horariosParaGrid.filter((h) => h.diaSemana === dia && h.horaInicio === hora && !h.cerrado);
      });
    });
    return g;
  }, [horariosParaGrid]);

  const resumenClases = useMemo(() => {
    const propios = horarios.filter((h) => !h.cerrado);
    const totalClases = propios.length;
    let totalHoras = 0;
    propios.forEach((h) => {
      const [hi, mi] = (h.horaInicio || '0:0').split(':').map(Number);
      const [hf, mf] = (h.horaFin || '0:0').split(':').map(Number);
      totalHoras += (hf * 60 + mf - hi * 60 - mi) / 60;
    });
    return { totalClases, totalHoras: Math.round(totalHoras * 10) / 10 };
  }, [horarios]);

  const openCelda = (diaIndex, hora) => {
    const dia = diaIndex + 1;
    const key = `${dia}-${hora}`;
    const slots = grid[key] || [];
    if (!slots.length) return;
    if (slots.length === 1 && slots[0]._cubiertaPor) {
      window.alert(
        `Esta semana el horario lo cubre ${slots[0]._cubiertaPor.nombre} ${slots[0]._cubiertaPor.apellidos}. Solo ella puede registrar la sesión.`
      );
      return;
    }
    if (slots.length === 1) {
      abrirSlot(slots[0].id);
    } else {
      setEleccionMultiples({ slots, diaNombre: DIAS[diaIndex], hora });
    }
  };

  if (loading) return <div className="card">Cargando horarios...</div>;

  return (
    <div>
      <h2>Mis horarios</h2>
      <p style={{ color: '#6b7280' }}>Toca un slot marcado para ver alumnos del día. Si el administrador asignó una sustitución para la fecha elegida, verás el aviso en la celda.</p>
      {(sustitucionesComoTitular.length > 0 || sustitucionesComoSustituta.length > 0) && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.45)' }}>
          {sustitucionesComoTitular.length > 0 && (
            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Sustituciones en tus horarios:</strong> en las semanas indicadas otra asesora cubre la clase (tú no registras esa sesión esa semana).
            </p>
          )}
          {sustitucionesComoSustituta.length > 0 && (
            <p style={{ margin: 0 }}>
              <strong>Cubres como sustituta:</strong> aparecen en el cuadro el día de la semana correspondiente a la fecha elegida.
            </p>
          )}
        </div>
      )}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(106, 198, 50, 0.15)', border: '1px solid rgba(106, 198, 50, 0.65)' }}>
        <strong>Resumen semanal:</strong> tienes <strong>{resumenClases.totalClases} clases</strong> y <strong>{resumenClases.totalHoras} horas</strong> de clase por semana.
      </div>
      <div className="form-group" style={{ maxWidth: 280 }}>
        <label>Fecha (clase del día)</label>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 6, marginBottom: 0 }}>
          Semana del <strong>{lunesISODeFecha(fecha)}</strong>: cupo y alumnos según esa semana. El cuadro mantiene el orden por día y hora.
        </p>
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
                {DIAS.map((_, diaIndex) => {
                  const key = `${diaIndex + 1}-${hora}`;
                  const slots = grid[key] || [];
                  const totalAlumnos = slots.reduce((acc, s) => acc + cuentaAlumnosSlot(s), 0);
                  const tieneClase = slots.length > 0;
                  return (
                    <td
                      key={key}
                      className={`schedule-cell ${
                        tieneClase ? (totalAlumnos > 0 ? 'schedule-cell--has-class' : 'schedule-cell--without-students') : 'schedule-cell--empty'
                      }`}
                      onClick={() => openCelda(diaIndex, hora)}
                    >
                      {slots.length === 0 && '-'}
                      {slots.length === 1 && (
                        <span className="schedule-cell-label">
                          {labelModalidad(slots[0].modalidad)} {' — '}
                          {cuentaAlumnosSlot(slots[0])} alumnos
                          {slots[0]._esSustitucion && slots[0]._titularEtiqueta && (
                            <span style={{ display: 'block', fontSize: '0.78rem', color: '#1d4ed8', marginTop: 2 }}>
                              Sustitución (titular: {slots[0]._titularEtiqueta})
                            </span>
                          )}
                          {slots[0]._cubiertaPor && (
                            <span style={{ display: 'block', fontSize: '0.78rem', color: '#b45309', marginTop: 2 }}>
                              Cubre {slots[0]._cubiertaPor.nombre} {slots[0]._cubiertaPor.apellidos}
                            </span>
                          )}
                        </span>
                      )}
                      {slots.length > 1 && (
                        <span className="schedule-cell-label schedule-cell-label--multiple">
                          {slots.length} clases
                          {slots.some((s) => s._esSustitucion || s._cubiertaPor) && (
                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#1d4ed8' }}>incluye sustitución</span>
                          )}
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

      {eleccionMultiples && (
        <div className="modal-overlay" onClick={() => setEleccionMultiples(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: 360 }}>
            <h3>Varias clases a las {eleccionMultiples.hora} del {eleccionMultiples.diaNombre}</h3>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Elige cuál abrir:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {eleccionMultiples.slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (s._cubiertaPor) {
                      window.alert(
                        `Esta semana el horario lo cubre ${s._cubiertaPor.nombre} ${s._cubiertaPor.apellidos}.`
                      );
                      return;
                    }
                    setEleccionMultiples(null);
                    abrirSlot(s.id);
                  }}
                >
                  {labelModalidad(s.modalidad)} — {s.horaInicio}–{s.horaFin}
                  {s._cubiertaPor && ' (cubierta por sustituta)'}
                </button>
              ))}
            </div>
            <button type="button" className="btn secondary" style={{ marginTop: '1rem' }} onClick={() => setEleccionMultiples(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
      {popup && (
        <div className="modal-overlay" onClick={() => { setPopup(null); setAlumnoDetalle(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '60vw', height: '60vh', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>
              {horarioSeleccionado
                ? `${DIAS[horarioSeleccionado.diaSemana - 1]} ${horarioSeleccionado.horaInicio}–${horarioSeleccionado.horaFin}`
                : 'Alumnos del día'}
            </h3>
            {horarioSeleccionado && (
              <p style={{ marginTop: 0, color: '#6b7280' }}>
                {labelModalidad(horarioSeleccionado.modalidad)}
                {horarioSeleccionado._esSustitucion && horarioSeleccionado._titularEtiqueta && (
                  <span style={{ display: 'block', marginTop: 6, color: '#1d4ed8' }}>
                    Sustitución — horario de {horarioSeleccionado._titularEtiqueta}
                  </span>
                )}
                {rolSesion === 'sustituta' && (
                  <span style={{ display: 'block', marginTop: 6, color: '#047857' }}>Registras esta sesión como sustituta (la hora cuenta para ti).</span>
                )}
              </p>
            )}
            {Array.isArray(alumnos) && alumnos.length > 0 && puedeEditar && (
              <button type="button" className="btn" style={{ marginBottom: '1rem' }} onClick={marcarTodosPresentes}>
                Marcar todos como presentes
              </button>
            )}
            {Array.isArray(alumnos) && alumnos.length > 0 ? (
              <table className="stats-table">
                <thead>
                  <tr><th>Alumno</th><th>Materia</th><th>Avance clase anterior</th><th>Horas restantes</th><th>Fin estimado</th><th>Presente</th><th></th></tr>
                </thead>
                <tbody>
                  {alumnos.map((a) => (
                    <tr key={a.usuarioId}>
                      <td>
                        {a.nombre} {a.apellidos}
                        {a.alcance === 'solo_semana' && (
                          <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748b' }}>Solo esta semana</span>
                        )}
                      </td>
                      <td>{textoMateriasAlumno(a.funciones)}</td>
                      <td style={{ maxWidth: 120 }}>{a.avanceClaseAnterior ?? '-'}</td>
                      <td>{a.horasRestantes ?? '-'}</td>
                      <td>{a.fechaEstimadaFin ?? '-'}</td>
                      <td>
                        {a.presente === true ? (
                          <span className="stats-badge yes">Sí</span>
                        ) : a.presente === false ? (
                          <span className="stats-badge no">No</span>
                        ) : (
                          <span style={{ color: '#6b7280' }}>-</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button type="button" className="btn secondary" onClick={() => abrirHistorialAlumno(a)}>
                            Historial
                          </button>
                          <button type="button" className="btn" style={{ padding: '0.45rem 0.9rem' }} onClick={() => setAlumnoDetalle(a)}>
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#6b7280' }}>Sin alumnos o cargando...</p>
            )}
            {!puedeEditar && Array.isArray(alumnos) && alumnos.length > 0 && (
              <div className="stats-note" style={{ borderLeft: '4px solid #f59e0b' }}>
                Pasaron más de 24 h: no se puede modificar asistencia ni avance.
              </div>
            )}
            <button type="button" className="btn" style={{ marginTop: '1rem' }} onClick={() => { setPopup(null); setAlumnoDetalle(null); }}>Cerrar</button>
          </div>
        </div>
      )}

      {historialModalAlumno && popup && (
        <div
          className="modal-overlay"
          onClick={() => {
            setHistorialModalAlumno(null);
            setHistorialAlumno([]);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '80vw', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>
              Historial de {historialModalAlumno.nombre} {historialModalAlumno.apellidos}
            </h3>
            {loadingHistorial ? (
              <div className="card">Cargando historial...</div>
            ) : (
              <>
                {historialAlumno.length === 0 ? (
                  <p style={{ color: '#6b7280' }}>No hay historial disponible.</p>
                ) : (
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Modalidad</th>
                        <th>Hora</th>
                        <th>Presente</th>
                        <th>Avance</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialAlumno.map((h, idx) => (
                        <tr key={idx}>
                          <td>{h.fecha ? new Date(h.fecha).toLocaleDateString() : '-'}</td>
                          <td>{h.modalidad ?? '-'}</td>
                          <td>{h.horaInicio}-{h.horaFin}</td>
                          <td>
                            {h.presente === true ? 'Sí' : h.presente === false ? 'No' : '-'}
                          </td>
                          <td style={{ maxWidth: 140 }}>{h.avance ?? '-'}</td>
                          <td>{h.observaciones ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setHistorialModalAlumno(null);
                  setHistorialAlumno([]);
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {alumnoDetalle && popup && (
        <ModalEditarAlumno
          sesionId={sesionId}
          horarioId={popup}
          fecha={fecha}
          alumno={alumnoDetalle}
          puedeEditar={puedeEditar}
          onClose={() => setAlumnoDetalle(null)}
          onSave={() => { setAlumnoDetalle(null); abrirSlot(popup); }}
        />
      )}
    </div>
  );
}

function ModalEditarAlumno({ sesionId, horarioId, fecha, alumno, puedeEditar, onClose, onSave }) {
  const [presente, setPresente] = useState(alumno.presente);
  const [avance, setAvance] = useState(alumno.avance ?? '');
  const [observaciones, setObservaciones] = useState(alumno.observaciones ?? '');
  const [enviadoRevision, setEnviadoRevision] = useState(alumno.enviadoRevision);
  const [saving, setSaving] = useState(false);

  const guardar = () => {
    if (!sesionId || !puedeEditar) return;
    setSaving(true);
    fetch(apiUrl(`/api/asesora/sesion/${sesionId}/alumno/${alumno.usuarioId}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ presente, avance, observaciones, enviadoRevision }),
    })
      .then((r) => r.ok ? onSave() : r.json())
      .then((data) => data?.error && alert(data.error))
      .finally(() => setSaving(false));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '60vw', height: '60vh', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}
      >
        <h3>Editar: {alumno.nombre} {alumno.apellidos}</h3>
        <div className="stats-note" style={{ marginBottom: '1rem' }}>
          <strong>Materia:</strong> {textoMateriasAlumno(alumno.funciones)}
        </div>
        {puedeEditar ? (
          <>
            <div className="form-group">
              <label>Presente / Falta</label>
              <select value={presente === true ? 'si' : presente === false ? 'no' : ''} onChange={(e) => setPresente(e.target.value === 'si' ? true : e.target.value === 'no' ? false : null)}>
                <option value="">Sin marcar</option>
                <option value="si">Presente</option>
                <option value="no">Falta</option>
              </select>
            </div>
            <div className="form-group">
              <label>Avance</label>
              <textarea value={avance} onChange={(e) => setAvance(e.target.value)} rows={3} />
            </div>
            <div className="form-group">
              <label>Observaciones</label>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
            </div>
            <div className="form-group">
              <label><input type="checkbox" checked={enviadoRevision} onChange={(e) => setEnviadoRevision(e.target.checked)} /> Enviar a revisión (admin)</label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              <button type="button" className="btn danger" onClick={onClose}>Cancelar</button>
            </div>
          </>
        ) : (
          <p style={{ color: '#6b7280' }}>Pasadas 24 h no se puede modificar.</p>
        )}
      </div>
    </div>
  );
}
