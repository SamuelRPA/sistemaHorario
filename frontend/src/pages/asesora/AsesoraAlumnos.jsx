import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { textoMateriasAlumno } from '../../utils/materiasAlumno';
import { lunesISODeFecha, ordenarHorariosPorDiaHora } from '../../utils/semana';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function cuentaAlumnosSlot(h) {
  if (h.alumnosEfectivosSemana != null) return h.alumnosEfectivosSemana;
  return h._count?.inscripciones ?? 0;
}

export default function AsesoraAlumnos() {
  const [horarios, setHorarios] = useState([]);
  const [loadingHorarios, setLoadingHorarios] = useState(true);
  const [diaReferenciaSemana, setDiaReferenciaSemana] = useState(() => new Date().toISOString().slice(0, 10));

  const lunesSemana = useMemo(() => lunesISODeFecha(diaReferenciaSemana), [diaReferenciaSemana]);

  const [horarioAlumnosId, setHorarioAlumnosId] = useState(null);
  const [alumnosEnHorario, setAlumnosEnHorario] = useState([]);

  const [vistaAlumnos, setVistaAlumnos] = useState('remove'); // 'add' | 'remove'

  const [popupOpen, setPopupOpen] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [alumnosBusqueda, setAlumnosBusqueda] = useState([]);
  const [buscando, setBuscando] = useState(false);

  const [actualizandoAlumnos, setActualizandoAlumnos] = useState(false);
  const [cupoMax, setCupoMax] = useState('');
  const [guardandoCupo, setGuardandoCupo] = useState(false);

  const reloadHorarios = useCallback(() => {
    const lunes = lunesISODeFecha(diaReferenciaSemana);
    return fetch(`/api/asesora/horarios?lunesSemana=${lunes}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setHorarios(ordenarHorariosPorDiaHora(data.horarios || [])))
      .catch(() => {});
  }, [diaReferenciaSemana]);

  useEffect(() => {
    setLoadingHorarios(true);
    const lunes = lunesISODeFecha(diaReferenciaSemana);
    fetch(`/api/asesora/horarios?lunesSemana=${lunes}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const list = ordenarHorariosPorDiaHora(data.horarios || []);
        setHorarios(list);
        const confirmados = list.filter((h) => !h.cerrado);
        setHorarioAlumnosId((prev) => {
          if (prev && confirmados.some((h) => h.id === prev)) return prev;
          return confirmados[0]?.id ?? null;
        });
      })
      .catch(() => setHorarios([]))
      .finally(() => setLoadingHorarios(false));
  }, [diaReferenciaSemana]);

  const horariosConfirmados = useMemo(
    () => ordenarHorariosPorDiaHora(horarios.filter((h) => !h.cerrado)),
    [horarios]
  );
  const horarioActual = useMemo(() => horarios.find((h) => h.id === horarioAlumnosId) || null, [horarios, horarioAlumnosId]);

  useEffect(() => {
    if (!popupOpen || !horarioAlumnosId) {
      setAlumnosEnHorario([]);
      return;
    }
    fetch(`/api/asesora/horario/${horarioAlumnosId}/alumnos?lunesSemana=${lunesSemana}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setAlumnosEnHorario(data.alumnos || []))
      .catch(() => setAlumnosEnHorario([]));
  }, [horarioAlumnosId, popupOpen, lunesSemana]);

  useEffect(() => {
    if (!popupOpen) return;
    if (vistaAlumnos !== 'add') return;
    setAlumnosBusqueda([]);
    setBuscando(false);
  }, [vistaAlumnos, popupOpen]);

  useEffect(() => {
    const term = busqueda.trim();
    if (!popupOpen) return;
    if (vistaAlumnos !== 'add') return;
    if (!term || term.length < 2) {
      setAlumnosBusqueda([]);
      setBuscando(false);
      return;
    }

    let cancelled = false;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/asesora/alumnos?busqueda=${encodeURIComponent(term)}`, { credentials: 'include' });
        const data = await r.json();
        if (!cancelled) setAlumnosBusqueda(data.alumnos || []);
      } catch (_e) {
        if (!cancelled) setAlumnosBusqueda([]);
      } finally {
        if (!cancelled) setBuscando(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [busqueda, vistaAlumnos, popupOpen]);

  const idsEnHorario = new Set(alumnosEnHorario.map((a) => a.usuarioId));

  const colorPorCantidad = (n) => {
    const num = Number(n) || 0;
    // Verde si es poco, luego naranja, luego rojo.
    if (num <= 3) return { bg: 'rgba(106, 198, 50, 0.18)', border: 'rgba(106,198,50,0.65)', text: 'var(--success-green)' };
    if (num <= 7) return { bg: 'rgba(249, 161, 33, 0.18)', border: 'rgba(249,161,33,0.85)', text: 'var(--orange)' };
    return { bg: 'rgba(211, 46, 46, 0.18)', border: 'rgba(211,46,46,0.85)', text: 'var(--danger-red)' };
  };

  useEffect(() => {
    if (!popupOpen) return;
    if (horarioActual?.capacidadMax != null) setCupoMax(String(horarioActual.capacidadMax));
  }, [popupOpen, horarioAlumnosId, alumnosEnHorario.length]);

  const agregarAlumno = async (usuarioId, alcance) => {
    if (!horarioAlumnosId) return;
    if (idsEnHorario.has(usuarioId)) return;
    setActualizandoAlumnos(true);
    try {
      const r = await fetch(`/api/asesora/horario/${horarioAlumnosId}/alumnos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          usuarioId,
          alcance: alcance === 'solo_semana' ? 'solo_semana' : 'permanente',
          ...(alcance === 'solo_semana' ? { lunesSemana } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Error al añadir alumno');

      const res = await fetch(`/api/asesora/horario/${horarioAlumnosId}/alumnos?lunesSemana=${lunesSemana}`, { credentials: 'include' });
      const resData = await res.json();
      setAlumnosEnHorario(resData.alumnos || []);
      reloadHorarios();
    } catch (e) {
      alert(e?.message || 'Error al añadir alumno');
    } finally {
      setActualizandoAlumnos(false);
    }
  };

  const quitarAlumno = async (usuarioId, alcance) => {
    if (!horarioAlumnosId) return;
    setActualizandoAlumnos(true);
    try {
      const q = alcance === 'solo_semana' ? `?lunesSemana=${lunesSemana}` : '';
      const r = await fetch(`/api/asesora/horario/${horarioAlumnosId}/alumnos/${usuarioId}${q}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Error al quitar alumno');

      const res = await fetch(`/api/asesora/horario/${horarioAlumnosId}/alumnos?lunesSemana=${lunesSemana}`, { credentials: 'include' });
      const resData = await res.json();
      setAlumnosEnHorario(resData.alumnos || []);
      reloadHorarios();
    } catch (e) {
      alert(e?.message || 'Error al quitar alumno');
    } finally {
      setActualizandoAlumnos(false);
    }
  };

  const guardarCupoMax = async () => {
    if (!horarioAlumnosId) return;
    const num = Number(cupoMax);
    if (!Number.isFinite(num) || num <= 0) {
      alert('Cupo máximo inválido');
      return;
    }
    setGuardandoCupo(true);
    try {
      const r = await fetch(`/api/asesora/horario/${horarioAlumnosId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ capacidadMax: Math.floor(num) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Error al guardar cupo');
      await reloadHorarios();
    } catch (e) {
      alert(e?.message || 'Error al guardar cupo');
    } finally {
      setGuardandoCupo(false);
    }
  };


  if (loadingHorarios) return <div className="card">Cargando horarios...</div>;

  return (
    <div className="anadir-page">
      <h2 style={{ marginBottom: '0.5rem' }}>Administrar alumnos</h2>
      <p style={{ color: '#6b7280', marginBottom: '1.25rem', fontSize: '0.9375rem' }}>
        Selecciona un horario confirmado para ver sus alumnos. Luego añade o quita.
      </p>

      {horariosConfirmados.length === 0 ? (
        <div className="card">
          <p style={{ color: '#6b7280', margin: 0 }}>
            No hay horarios confirmados. Ve a <strong>Editar horarios</strong>, marca y presiona <strong>Confirmar</strong>.
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label>Semana para cupo y alumnos (elige un día; se usa el lunes de esa semana)</label>
            <input type="date" value={diaReferenciaSemana} onChange={(e) => setDiaReferenciaSemana(e.target.value)} />
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 6, marginBottom: 0 }}>
              Lunes: <strong>{lunesSemana}</strong>. El número en cada botón es para <strong>esa semana</strong> (incluye inscripciones solo-semana). El orden de los botones es siempre Lunes→Sábado, por hora.
            </p>
          </div>
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label>Horarios confirmados (click para administrar)</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {horariosConfirmados.map((h) => {
                const diaNombre = DIAS[h.diaSemana - 1] ?? `Día ${h.diaSemana}`;
                const label = `${diaNombre} ${h.horaInicio}–${h.horaFin}`;
                const active = horarioAlumnosId === h.id && popupOpen;
                const count = cuentaAlumnosSlot(h);
                const styleCount = colorPorCantidad(count);
                return (
                  <button
                    key={h.id}
                    type="button"
                    className="btn"
                    style={{
                      background: active ? 'var(--brand-blue)' : 'rgba(44, 58, 141, 0.10)',
                      color: active ? '#fff' : 'var(--brand-blue)',
                      border: active ? '1px solid rgba(44, 58, 141, 0.35)' : '1px solid rgba(44, 58, 141, 0.20)',
                    }}
                    onClick={() => {
                      setHorarioAlumnosId(h.id);
                      setVistaAlumnos('remove');
                      setBuscando(false);
                      setAlumnosBusqueda([]);
                      setBusqueda('');
                      setPopupOpen(true);
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                      <span>{label}</span>
                      <span
                        style={{
                          padding: '0.18rem 0.55rem',
                          borderRadius: 9999,
                          background: styleCount.bg,
                          border: `1px solid ${styleCount.border}`,
                          color: styleCount.text,
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          lineHeight: 1.1,
                        }}
                      >
                        {count} alumnos
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {popupOpen && horarioActual && (
        <div
          className="modal-overlay"
          onClick={() => {
            setPopupOpen(false);
            setVistaAlumnos('remove');
            setAlumnosBusqueda([]);
            setBusqueda('');
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '70vw', maxWidth: '95vw', maxHeight: '90vh' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div className="anadir-section-title" style={{ marginBottom: '0.5rem' }}>Alumnos del horario</div>
                <div style={{ color: '#374151', fontWeight: 600 }}>
                  {DIAS[horarioActual.diaSemana - 1] ?? 'Día'} {horarioActual.horaInicio}–{horarioActual.horaFin}
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  {(() => {
                    const styleCount = colorPorCantidad(alumnosEnHorario.length);
                    return (
                      <span
                        style={{
                          padding: '0.22rem 0.65rem',
                          borderRadius: 9999,
                          background: styleCount.bg,
                          border: `1px solid ${styleCount.border}`,
                          color: styleCount.text,
                          fontSize: '0.85rem',
                          fontWeight: 800,
                        }}
                      >
                        {alumnosEnHorario.length} alumnos en este horario
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div style={{ flex: '1 1 260px', minWidth: 240 }}>
                <div className="anadir-section-title" style={{ marginBottom: '0.35rem' }}>
                  Cupo máximo
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ marginBottom: 0, flex: '1 1 140px' }}>
                    <label>Máximo</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={cupoMax}
                      onChange={(e) => setCupoMax(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn"
                    disabled={guardandoCupo}
                    onClick={guardarCupoMax}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {guardandoCupo ? 'Guardando...' : 'Guardar cupo'}
                  </button>
                </div>
              </div>

              <button type="button" className="btn secondary" onClick={() => setPopupOpen(false)}>
                Cerrar
              </button>
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '0.75rem' }}>
              Listado y cupo según la semana del <strong>{lunesSemana}</strong>. Puedes añadir a un alumno <strong>siempre</strong> al horario o <strong>solo esa semana</strong>.
            </p>

            <div className="anadir-tabs" style={{ marginTop: '1rem' }}>
              <button type="button" className={vistaAlumnos === 'add' ? 'active' : ''} onClick={() => setVistaAlumnos('add')}>
                Añadir
              </button>
              <button type="button" className={vistaAlumnos === 'remove' ? 'active' : ''} onClick={() => setVistaAlumnos('remove')}>
                Quitar
              </button>
            </div>

            {vistaAlumnos === 'add' ? (
              <div style={{ marginTop: '0.75rem' }}>
                <div className="form-group">
                  <label>Buscar alumno (nombre o apellidos)</label>
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Ej: Juan Perez"
                  />
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: -8 }}>Solo alumnos activos.</p>

                {buscando ? (
                  <div style={{ color: '#6b7280' }}>Buscando...</div>
                ) : alumnosBusqueda.length > 0 ? (
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>Alumno</th>
                        <th>Materia</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {alumnosBusqueda.map((a) => (
                        <tr key={a.usuarioId}>
                          <td>{a.nombre} {a.apellidos}</td>
                          <td>{textoMateriasAlumno(a.funciones)}</td>
                          <td>
                            {idsEnHorario.has(a.usuarioId) ? (
                              <span style={{ color: '#6b7280' }}>Ya en esta semana</span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={actualizandoAlumnos}
                                  onClick={() => agregarAlumno(a.usuarioId, 'permanente')}
                                >
                                  Siempre (fijo)
                                </button>
                                <button
                                  type="button"
                                  className="btn secondary"
                                  disabled={actualizandoAlumnos}
                                  onClick={() => agregarAlumno(a.usuarioId, 'solo_semana')}
                                >
                                  Solo esta semana
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : busqueda.trim().length >= 2 ? (
                  <p style={{ color: '#6b7280' }}>No se encontraron alumnos activos con ese nombre.</p>
                ) : (
                  <p style={{ color: '#6b7280' }}>Escribe al menos 2 caracteres para buscar.</p>
                )}
              </div>
            ) : (
              <div style={{ marginTop: '0.75rem' }}>
                {actualizandoAlumnos && alumnosEnHorario.length === 0 ? (
                  <div style={{ color: '#6b7280' }}>Actualizando...</div>
                ) : alumnosEnHorario.length > 0 ? (
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>Alumno</th>
                        <th>Materia</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {alumnosEnHorario.map((a) => (
                        <tr key={`${a.usuarioId}-${a.alcance || 'permanente'}`}>
                          <td>
                            {a.nombre} {a.apellidos}
                            {a.alcance === 'solo_semana' && (
                              <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748b' }}>Solo esta semana</span>
                            )}
                          </td>
                          <td>{textoMateriasAlumno(a.funciones)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn secondary"
                              disabled={actualizandoAlumnos}
                              onClick={() => quitarAlumno(a.usuarioId, a.alcance || 'permanente')}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: '#6b7280' }}>Todavía no hay alumnos inscritos.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

