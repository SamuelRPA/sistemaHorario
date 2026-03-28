import React, { useState, useEffect } from 'react';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function UsuarioHorariosDisponibles() {
  const [horarios, setHorarios] = useState([]);
  const [inscripciones, setInscripciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [horarioSeleccionado, setHorarioSeleccionado] = useState(null);
  const [clasesPorSemana, setClasesPorSemana] = useState(null);
  const [modalClasesSemana, setModalClasesSemana] = useState(false);
  const [clasesPorSemanaInput, setClasesPorSemanaInput] = useState('');
  const [pendingHorarioId, setPendingHorarioId] = useState(null);
  const [popup, setPopup] = useState(null); // { type, message }

  const loadHorarios = () => {
    fetch('/api/usuario/horarios-disponibles', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setHorarios(data.horarios || []))
      .catch(() => setHorarios([]));
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/usuario/horarios-disponibles', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/usuario/horario', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/usuario/perfil', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([disp, miHorario, perfil]) => {
        setHorarios(disp.horarios || []);
        setInscripciones((miHorario.slots || []).map((s) => s.horarioId));
        setClasesPorSemana(perfil?.clasesPorSemana ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const inscribir = (horarioId, clasesPorSemanaOverride) => {
    setMensaje('');
    const body = { horarioId };
    if (clasesPorSemanaOverride !== undefined) body.clasesPorSemana = clasesPorSemanaOverride;
    fetch('/api/usuario/inscripcion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setMensaje(data.error);
          setPopup({ type: 'error', message: data.error });
        } else {
          setMensaje('Inscripción realizada.');
          setPopup({ type: 'success', message: 'Inscripción realizada correctamente.' });
          setInscripciones((prev) => [...prev, horarioId]);
          setHorarioSeleccionado(null);
          if (clasesPorSemanaOverride !== undefined) setClasesPorSemana(clasesPorSemanaOverride);
          loadHorarios();
        }
      })
      .catch((err) => {
        setMensaje('Error de conexión');
        setPopup({ type: 'error', message: err?.message || 'Error de conexión' });
      });
  };

  const elegirHorario = (horarioId) => {
    if (clasesPorSemana == null) {
      setPendingHorarioId(horarioId);
      setClasesPorSemanaInput('');
      setModalClasesSemana(true);
      return;
    }
    inscribir(horarioId);
  };

  const salirHorario = (horarioId) => {
    if (!window.confirm('¿Salir de este horario? Quedará registrado.')) return;
    setMensaje('');
    fetch(`/api/usuario/inscripcion/${horarioId}`, { method: 'DELETE', credentials: 'include' })
      .then((r) => r.ok ? r.json() : r.json().then((d) => Promise.reject(d)))
      .then(() => {
        setMensaje('Has salido del horario. Quedó registrado.');
        setInscripciones((prev) => prev.filter((id) => id !== horarioId));
        setHorarioSeleccionado(null);
        loadHorarios();
      })
      .catch((err) => setMensaje(err?.error || 'Error al salir'));
  };

  if (loading) return <div className="card">Cargando...</div>;

  return (
    <div>
      <h2>Horas disponibles</h2>
      <p style={{ color: '#6b7280' }}>Horarios según tu plan y modalidad. Puedes cambiar de horario si hay cupo.</p>
      {mensaje && <div className="card" style={{ background: mensaje.startsWith('Inscripción') ? 'rgba(106, 198, 50, 0.15)' : 'rgba(211, 46, 46, 0.15)' }}>{mensaje}</div>}
      <div className="card">
        {horarios.length === 0 ? (
          <p style={{ color: '#6b7280', margin: 0 }}>No hay horarios disponibles para tu plan/modalidad.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
            {horarios.map((h) => {
              const inscrito = inscripciones.includes(h.id);
              const sinCupo = !inscrito && h.cupo <= 0;
              return (
                <button
                  key={h.id}
                  type="button"
                  className={`choice-card ${inscrito ? 'is-selected' : ''} ${sinCupo ? 'is-disabled' : ''}`}
                  onClick={() => setHorarioSeleccionado(h)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {DIAS[h.diaSemana - 1]} {h.horaInicio}–{h.horaFin}
                      </div>
                      <div className="choice-meta">
                        {h.modalidad} {h.asesora ? `— ${h.asesora.nombre} ${h.asesora.apellidos}` : ''}
                      </div>
                    </div>
                    <div className="choice-right" style={{ color: sinCupo ? 'rgba(30,41,59,0.45)' : 'var(--success-green)' }}>
                      {inscrito ? 'Inscrito' : `Cupo: ${h.cupo}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {horarioSeleccionado && (
        <div className="modal-overlay" onClick={() => setHorarioSeleccionado(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '70vw', maxWidth: '95vw' }}>
            <h3 style={{ marginTop: 0 }}>
              {DIAS[horarioSeleccionado.diaSemana - 1]} {horarioSeleccionado.horaInicio}–{horarioSeleccionado.horaFin}
            </h3>
            <p style={{ color: '#6b7280', marginTop: -8 }}>
              {horarioSeleccionado.modalidad} — {horarioSeleccionado.asesora ? `${horarioSeleccionado.asesora.nombre} ${horarioSeleccionado.asesora.apellidos}` : '-'}
            </p>
            <p style={{ color: '#6b7280' }}>
              Cupo disponible: <strong style={{ color: '#111827' }}>{horarioSeleccionado.cupo}</strong>
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              {inscripciones.includes(horarioSeleccionado.id) ? (
                <>
                  <button type="button" className="btn danger" onClick={() => salirHorario(horarioSeleccionado.id)}>
                    Salir de este horario
                  </button>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Quedará registro de la baja.</span>
                </>
              ) : horarioSeleccionado.cupo > 0 ? (
                <button type="button" className="btn" onClick={() => elegirHorario(horarioSeleccionado.id)}>
                  Elegir
                </button>
              ) : (
                <button type="button" className="btn secondary" disabled>
                  Sin cupo
                </button>
              )}
              <button type="button" className="btn secondary" onClick={() => setHorarioSeleccionado(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalClasesSemana && (
        <div className="modal-overlay" onClick={() => setModalClasesSemana(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '520px', maxWidth: '95vw' }}>
            <h3 style={{ marginTop: 0 }}>Clases por semana</h3>
            <p style={{ color: '#6b7280', marginTop: -8, marginBottom: '1rem' }}>
              Te servirá para estimar una fecha aproximada de finalización.
            </p>
            <div className="form-group">
              <label>Número de clases por semana</label>
              <input
                type="number"
                min={1}
                max={10}
                value={clasesPorSemanaInput}
                onChange={(e) => setClasesPorSemanaInput(e.target.value)}
                placeholder="Ej: 2"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const num = Number(clasesPorSemanaInput);
                  if (!Number.isFinite(num) || num <= 0) {
                    setMensaje('Ingresa un número válido de clases por semana.');
                    return;
                  }
                  const id = pendingHorarioId;
                  setModalClasesSemana(false);
                  setPendingHorarioId(null);
                  setClasesPorSemanaInput('');
                  inscribir(id, Math.floor(num));
                }}
              >
                Confirmar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  setModalClasesSemana(false);
                  setPendingHorarioId(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
