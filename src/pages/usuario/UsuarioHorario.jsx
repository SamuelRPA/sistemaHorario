import React, { useMemo, useState, useEffect } from 'react';
import { labelModalidad } from '../../constants/modalidad';
import { apiUrl } from '../../apiUrl.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SLOTS_HORARIOS = Array.from({ length: 15 }, (_, i) => {
  const h = 7 + i;
  return `${String(h).padStart(2, '0')}:00`;
});

export default function UsuarioHorario() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    fetch(apiUrl('/api/usuario/horario'), { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setSlots(data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, []);

  const grid = useMemo(() => {
    const g = {};
    SLOTS_HORARIOS.forEach((hora) => {
      DIAS.forEach((_, idx) => {
        const dia = idx + 1;
        const key = `${dia}-${hora}`;
        g[key] = slots.filter((s) => s.diaSemana === dia && s.horaInicio === hora);
      });
    });
    return g;
  }, [slots]);

  const openCelda = (diaIndex, hora) => {
    const key = `${diaIndex + 1}-${hora}`;
    const celdas = grid[key] || [];
    if (celdas.length === 1) setDetalle(celdas[0]);
    if (celdas.length > 1) setDetalle(celdas[0]); // mismo horario, mismo slot; mostrar el primero
  };

  const abrirZoom = async (e, url, horarioId) => {
    e.preventDefault();
    try {
      await fetch(apiUrl('/api/usuario/zoom-intento'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ horarioId }),
      });
    } catch (_) {
      /* aun así abrir el enlace */
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <div className="card">Cargando horario...</div>;

  return (
    <div>
      <h2>Mi horario (Lunes a Sábado)</h2>
      <p style={{ color: '#6b7280' }}>
        Toca una celda marcada para ver asesora y, si la clase es virtual, el enlace de Zoom. Las clases presenciales no muestran enlace de videollamada.
      </p>
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
                  const celdas = grid[key] || [];
                  const tieneClase = celdas.length > 0;
                  return (
                    <td
                      key={key}
                      className={`schedule-cell ${tieneClase ? 'schedule-cell--has-class' : 'schedule-cell--empty'}`}
                      onClick={() => openCelda(diaIndex, hora)}
                    >
                      {celdas.length === 0 && '-'}
                      {celdas.length >= 1 && (
                        <span className="schedule-cell-label">
                          {labelModalidad(celdas[0].modalidad)}
                          {celdas[0].asesora && ` — ${celdas[0].asesora.nombre} ${celdas[0].asesora.apellidos}`}
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

      {detalle && (
        <div className="modal-overlay" onClick={() => setDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Detalle del horario</h3>
            <p><strong>Asesora:</strong> {detalle.asesora ? `${detalle.asesora.nombre} ${detalle.asesora.apellidos}` : '-'}</p>
            <p><strong>Modalidad:</strong> {labelModalidad(detalle.modalidad)}</p>
            {detalle.modalidad === 'presencial' && (
              <p style={{ color: '#64748b', fontSize: '0.9375rem' }}>
                Clase presencial: no aplica enlace de Zoom.
              </p>
            )}
            {detalle.linkZoom && detalle.modalidad !== 'presencial' && detalle.horarioId && (
              <p>
                <strong>Link Zoom:</strong>{' '}
                <a
                  href={detalle.linkZoom}
                  onClick={(e) => abrirZoom(e, detalle.linkZoom, detalle.horarioId)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {detalle.linkZoom}
                </a>
              </p>
            )}
            <button type="button" className="btn" onClick={() => setDetalle(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
