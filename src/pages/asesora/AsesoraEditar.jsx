import React, { useEffect, useMemo, useState } from 'react';
import { FUNCIONES_OPCIONES } from '../../constants/funciones';
import { ordenarHorariosPorDiaHora } from '../../utils/semana';
import { apiUrl } from '../../apiUrl.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
// Franjas horarias de 07:00 a 21:00 (cada hora)
const SLOTS_HORARIOS = Array.from({ length: 15 }, (_, i) => {
  const h = 7 + i;
  return `${String(h).padStart(2, '0')}:00`;
});

export default function AsesoraEditar() {
  const [horarios, setHorarios] = useState([]);
  const [asesoraFunciones, setAsesoraFunciones] = useState([]); // ids: ['lectura_dinamica', 'aprende_a_leer', ...]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  /** Modalidad por celda `diaSemana-horaInicio` (cada horario puede ser virtual o presencial). */
  const [modalidadPorSlot, setModalidadPorSlot] = useState({});
  /** Valor del desplegable: se aplica solo a celdas nuevas que marques. */
  const [modalidadPredeterminada, setModalidadPredeterminada] = useState('online');
  const [funciones, setFunciones] = useState([]);
  const [popup, setPopup] = useState(null); // { type, message }

  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/api/asesora/horarios'), { credentials: 'include' }).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(apiUrl('/api/asesora/perfil'), { credentials: 'include' }).then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([dataHorarios, dataPerfil]) => {
        const list = ordenarHorariosPorDiaHora(dataHorarios.horarios || []);
        setHorarios(list);
        const initial = new Set();
        const mod = {};
        list.filter((h) => !h.cerrado).forEach((h) => {
          const k = `${h.diaSemana}-${h.horaInicio}`;
          initial.add(k);
          mod[k] = h.modalidad === 'presencial' ? 'presencial' : 'online';
        });
        setSelected(initial);
        setModalidadPorSlot(mod);
        const func = Array.isArray(dataPerfil.funciones) ? dataPerfil.funciones : [];
        setAsesoraFunciones(func);
        if (func.length && funciones.length === 0) setFunciones([...func]);
      })
      .catch(() => setHorarios([]))
      .finally(() => setLoading(false));
  }, []);

  const confirmar = () => {
    if (funciones.length === 0) {
      setPopup({ type: 'error', message: 'Elige al menos una función (materia) para estos horarios.' });
      return;
    }
    setSaving(true);
    const slots = Array.from(selected).map((key) => {
      const [diaSemana, horaInicio] = key.split('-');
      const m = modalidadPorSlot[key] || modalidadPredeterminada || 'online';
      return {
        diaSemana: parseInt(diaSemana, 10),
        horaInicio,
        modalidad: m === 'presencial' ? 'presencial' : 'online',
      };
    });

    fetch(apiUrl('/api/asesora/horarios/slots'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slots, modalidad: modalidadPredeterminada, funciones }),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d))))
      .then(() => fetch(apiUrl('/api/asesora/horarios'), { credentials: 'include' }).then((res) => res.json()))
      .then((data) => {
        const list = ordenarHorariosPorDiaHora(data.horarios || []);
        setHorarios(list);
        const initial = new Set();
        const mod = {};
        list.filter((h) => !h.cerrado).forEach((h) => {
          const k = `${h.diaSemana}-${h.horaInicio}`;
          initial.add(k);
          mod[k] = h.modalidad === 'presencial' ? 'presencial' : 'online';
        });
        setSelected(initial);
        setModalidadPorSlot(mod);
        setSaving(false);
        setPopup({ type: 'success', message: 'Horarios confirmados correctamente.' });
      })
      .catch((err) => {
        setSaving(false);
        setPopup({ type: 'error', message: err?.error || 'Error al guardar' });
      });
  };

  const grid = useMemo(() => {
    // Para la grilla solo necesitamos el estado confirmado (cerrado=false)
    const confirmed = new Set(horarios.filter((h) => !h.cerrado).map((h) => `${h.diaSemana}-${h.horaInicio}`));
    return confirmed;
  }, [horarios]);

  const toggleSlot = (diaSemana, horaInicio) => {
    const key = `${diaSemana}-${horaInicio}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setModalidadPorSlot((m) => {
          const copy = { ...m };
          delete copy[key];
          return copy;
        });
      } else {
        next.add(key);
        setModalidadPorSlot((m) => ({ ...m, [key]: modalidadPredeterminada }));
      }
      return next;
    });
  };

  const alternarModalidadCelda = (key, e) => {
    e.stopPropagation();
    setModalidadPorSlot((m) => ({
      ...m,
      [key]: m[key] === 'presencial' ? 'online' : 'presencial',
    }));
  };

  if (loading) return <div className="card">Cargando...</div>;

  return (
    <div className="anadir-page">
      <h2 style={{ marginBottom: '0.5rem' }}>Editar horarios</h2>
      <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.9375rem' }}>
        Marca las celdas y elige <strong>funciones (materias)</strong>. Cada celda puede ser <strong>virtual u presencial</strong> de forma independiente (mismo día, distintas horas). El desplegable de modalidad solo aplica a <strong>celdas nuevas</strong> que marques; en una celda ya marcada, pulsa el enlace «Virtual» / «Presencial» para cambiarla.
      </p>

      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div className="anadir-section-title">Para los horarios que marques</div>
        <div className="anadir-form-grid" style={{ marginTop: '0.5rem' }}>
          <div className="form-group">
            <label>Modalidad por defecto (solo celdas nuevas)</label>
            <select value={modalidadPredeterminada} onChange={(e) => setModalidadPredeterminada(e.target.value)}>
              <option value="online">Online (virtual)</option>
              <option value="presencial">Presencial</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Funciones / materias (solo alumnos con estas materias verán estos slots)</label>
            <div className="anadir-checkgroup" style={{ marginTop: '0.35rem' }}>
              {FUNCIONES_OPCIONES.filter((f) => asesoraFunciones.includes(f.id)).map((f) => (
                <label key={f.id}>
                  <input
                    type="checkbox"
                    checked={funciones.includes(f.id)}
                    onChange={(e) => {
                      if (e.target.checked) setFunciones((prev) => [...prev, f.id]);
                      else setFunciones((prev) => prev.filter((id) => id !== f.id));
                    }}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
            {asesoraFunciones.length === 0 && <p style={{ color: '#6b7280', margin: 0 }}>Asigna funciones (materias) en tu perfil primero.</p>}
          </div>
        </div>
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
                  const diaSemana = diaIndex + 1;
                  const key = `${diaSemana}-${hora}`;
                  const isSelected = selected.has(key);
                  const isConfirmed = grid.has(key);
                  const mod = modalidadPorSlot[key] || modalidadPredeterminada || 'online';
                  const modLabel = mod === 'presencial' ? 'Presencial' : 'Virtual';
                  return (
                    <td
                      key={key}
                      role="button"
                      tabIndex={0}
                      className={`schedule-cell schedule-cell--editable ${isSelected ? 'schedule-cell--selected' : ''}`}
                      onClick={() => toggleSlot(diaSemana, hora)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleSlot(diaSemana, hora))}
                      aria-pressed={isSelected}
                      title={isConfirmed ? 'Confirmado' : 'Marcado en edición'}
                    >
                      {isSelected ? (
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', lineHeight: 1.2 }}>
                          <span>Disponible</span>
                          <button
                            type="button"
                            className="btn secondary"
                            style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', borderRadius: 6 }}
                            onClick={(e) => alternarModalidadCelda(key, e)}
                          >
                            {modLabel}
                          </button>
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <button type="button" className="btn" onClick={confirmar} disabled={saving}>
          {saving ? 'Guardando...' : 'Confirmar horarios disponibles'}
        </button>
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

