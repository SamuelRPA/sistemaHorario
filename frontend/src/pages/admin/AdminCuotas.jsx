import React, { useState, useEffect } from 'react';
import { FUNCIONES_OPCIONES, labelFuncion } from '../../constants/funciones';

const FILTRO_PAGO = { todos: 'todos', morosos: 'morosos', alDia: 'alDia' };

export default function AdminCuotas() {
  const [busqueda, setBusqueda] = useState('');
  const [funcionesFiltro, setFuncionesFiltro] = useState([]);
  const [filtroPago, setFiltroPago] = useState(FILTRO_PAGO.todos);
  const [alumnos, setAlumnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (busqueda.trim()) params.set('busqueda', busqueda.trim());
    if (funcionesFiltro.length) params.set('funciones', funcionesFiltro.join(','));
    params.set('incluirMora', '1');
    fetch(`/api/admin/alumnos?${params}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setAlumnos(data.alumnos || []))
      .catch(() => setAlumnos([]))
      .finally(() => setLoading(false));
  }, [busqueda, funcionesFiltro.join(',')]);

  const alumnosFiltrados = alumnos.filter((u) => {
    if (filtroPago === FILTRO_PAGO.morosos) return u.enMora === true;
    if (filtroPago === FILTRO_PAGO.alDia) return u.enMora !== true;
    return true;
  });

  const toggleFuncion = (id) => {
    setFuncionesFiltro((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const abrirCuotas = (usuarioId) => {
    setLoadingDetalle(true);
    setDetalle(null);
    fetch(`/api/admin/usuarios/${usuarioId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setDetalle)
      .catch(() => setDetalle(null))
      .finally(() => setLoadingDetalle(false));
  };

  return (
    <div>
      <h2>Cuotas y pagos</h2>
      <p style={{ color: '#6b7280' }}>
        Cada cuota vence cada mes desde la <strong>fecha del primer vencimiento</strong>. Si esa fecha ya pasó y no hay pago registrado para ese periodo, el alumno aparece como moroso.
        Abonos reducen el saldo en dinero; registrar el pago de una cuota marca la mensualidad y actualiza el estado.
      </p>
      <div className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label>Buscar (nombre o apellidos)</label>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej. Juan Pérez"
          />
        </div>
      </div>
      <div className="card">
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Filtrar por función / materia</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {FUNCIONES_OPCIONES.map((f) => (
            <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <input
                type="checkbox"
                checked={funcionesFiltro.includes(f.id)}
                onChange={() => toggleFuncion(f.id)}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>
      <div className="card">
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Filtrar por estado de pago</label>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <input
              type="radio"
              name="filtroPago"
              checked={filtroPago === FILTRO_PAGO.todos}
              onChange={() => setFiltroPago(FILTRO_PAGO.todos)}
            />
            Todos
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <input
              type="radio"
              name="filtroPago"
              checked={filtroPago === FILTRO_PAGO.morosos}
              onChange={() => setFiltroPago(FILTRO_PAGO.morosos)}
            />
            Solo morosos (no pagaron en fecha)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <input
              type="radio"
              name="filtroPago"
              checked={filtroPago === FILTRO_PAGO.alDia}
              onChange={() => setFiltroPago(FILTRO_PAGO.alDia)}
            />
            Solo al día
          </label>
        </div>
      </div>
      <div className="card">
        {loading && <p>Cargando...</p>}
        {!loading && (
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Nombre</th>
                <th>Apellidos</th>
                <th>Planes</th>
                <th>Cuotas totales</th>
                <th>Monto total</th>
                <th>Estado cuota</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alumnosFiltrados.map((u) => {
                const mt = u.montoTotal != null ? Number(u.montoTotal) : null;
                const moroso = u.enMora === true;
                const sinCuotas = u.pagoContado || (u.cuotasTotales == null && u.montoTotal == null);
                const alDia = sinCuotas || !moroso;
                return (
                  <tr
                    key={u.id}
                    style={moroso ? { background: 'rgba(220, 38, 38, 0.12)' } : undefined}
                  >
                    <td>
                      {moroso ? (
                        <span style={{ color: '#b91c1c', fontWeight: 600 }}>Moroso</span>
                      ) : (
                        <span style={{ color: '#15803d' }}>Al día</span>
                      )}
                    </td>
                    <td>{u.nombre}</td>
                    <td>{u.apellidos}</td>
                    <td>{(u.funciones || []).map(labelFuncion).join(', ') || '-'}</td>
                    <td>{u.cuotasTotales ?? '-'}</td>
                    <td>{mt != null ? mt.toLocaleString('es-BO') : '-'}</td>
                    <td>
                      {sinCuotas ? (
                        <span style={{ color: '#6b7280' }}>–</span>
                      ) : (
                        <span className={`stats-badge ${alDia ? 'yes' : 'no'}`}>
                          {alDia ? 'Al día' : 'Atrasado'}
                        </span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn" onClick={() => abrirCuotas(u.id)}>
                        Ver cuotas
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && alumnosFiltrados.length === 0 && (
          <p style={{ color: '#6b7280' }}>
            {alumnos.length === 0
              ? 'No hay alumnos que coincidan con el filtro.'
              : 'Ningún alumno coincide con el filtro de estado de pago.'}
          </p>
        )}
      </div>
      {loadingDetalle && <p>Cargando detalle...</p>}
      {detalle && !loadingDetalle && (
        <div className="modal-overlay" onClick={() => setDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '60vw', maxWidth: '95vw', overflow: 'auto' }}>
            <h3>Cuotas — {detalle.usuario?.nombre} {detalle.usuario?.apellidos}</h3>
            <FechaPrimerVencimientoEditor usuario={detalle.usuario} onDone={() => abrirCuotas(detalle.usuario?.id)} />
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h4 style={{ marginTop: 0 }}>Cuotas totales (ajuste manual)</h4>
              <AccionesRapidasCuotas usuario={detalle.usuario} onDone={() => abrirCuotas(detalle.usuario?.id)} />
            </div>
            <PanelPeriodosCuotas
              usuario={detalle.usuario}
              resumenCuotas={detalle.resumenCuotas}
              onDone={() => abrirCuotas(detalle.usuario?.id)}
            />
            <PanelCuotasAbonos usuario={detalle.usuario} onDone={() => abrirCuotas(detalle.usuario?.id)} />
            <button type="button" className="btn" style={{ marginTop: '1rem' }} onClick={() => setDetalle(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FechaPrimerVencimientoEditor({ usuario, onDone }) {
  const usuarioId = usuario?.id;
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setValor(usuario?.fechaPrimerVencimiento ? String(usuario.fechaPrimerVencimiento).slice(0, 10) : '');
  }, [usuario?.id, usuario?.fechaPrimerVencimiento]);

  const guardar = () => {
    if (!usuarioId) return;
    setGuardando(true);
    fetch(`/api/admin/usuarios/${usuarioId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ fechaPrimerVencimiento: valor || null }),
    })
      .then((r) => (r.ok ? onDone() : r.json()))
      .then((data) => data?.error && alert(data.error))
      .finally(() => setGuardando(false));
  };

  if (!usuarioId) return null;
  const sinPlanCuotas = usuario.pagoContado || !(usuario.cuotasTotales > 0);
  if (sinPlanCuotas) return null;

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h4 style={{ marginTop: 0 }}>Fecha del primer vencimiento</h4>
      <p style={{ color: '#6b7280', marginTop: 0, fontSize: '0.9rem' }}>
        Día acordado del <strong>primer</strong> pago. La cuota 2 vence 1 mes después, y así sucesivamente (zona horaria Bolivia).
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <input type="date" value={valor} onChange={(e) => setValor(e.target.value)} />
        <button type="button" className="btn" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar fecha'}
        </button>
      </div>
    </div>
  );
}

function PanelPeriodosCuotas({ usuario, resumenCuotas, onDone }) {
  const usuarioId = usuario?.id;
  const [busy, setBusy] = useState(false);
  if (!usuarioId || !resumenCuotas) return null;
  if (usuario.pagoContado || !(Number(usuario.cuotasTotales) > 0)) return null;

  const periodos = resumenCuotas.periodos || [];
  const modo = resumenCuotas.modo;

  const togglePago = (mes, anio, pagado) => {
    setBusy(true);
    fetch(`/api/admin/usuarios/${usuarioId}/mensualidades`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mes, anio, pagado }),
    })
      .then((r) => (r.ok ? onDone() : r.json()))
      .then((data) => data?.error && alert(data.error))
      .finally(() => setBusy(false));
  };

  if (modo === 'legacy' || (modo === 'por_fecha' && periodos.length === 0)) {
    return (
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h4 style={{ marginTop: 0 }}>Cuotas por periodo</h4>
        <p style={{ color: '#b45309', margin: 0 }}>
          {modo === 'legacy'
            ? 'Este alumno no tiene fecha de primer vencimiento. Configúrala arriba para calcular mora por fecha acordada.'
            : 'Sin periodos (revisa cuotas totales y fecha).'}
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h4 style={{ marginTop: 0 }}>Pago de cuotas (por vencimiento)</h4>
      <p style={{ color: '#6b7280', marginTop: 0, fontSize: '0.9rem' }}>
        Próximo vencimiento pendiente:{' '}
        <strong>{resumenCuotas.proximoVencimiento || '—'}</strong>
        {resumenCuotas.montoProximaCuota != null && (
          <> · Monto cuota: <strong>{Number(resumenCuotas.montoProximaCuota).toLocaleString('es-BO')}</strong></>
        )}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="stats-table" style={{ minWidth: 520 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Vencimiento</th>
              <th>Mes / año</th>
              <th>Monto</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={`${p.mes}-${p.anio}`}>
                <td>{p.indice}</td>
                <td>{p.vencimiento ? new Date(p.vencimiento + 'T12:00:00').toLocaleDateString('es-BO') : '—'}</td>
                <td>
                  {p.mes}/{p.anio}
                </td>
                <td>{p.monto != null ? Number(p.monto).toLocaleString('es-BO') : '—'}</td>
                <td>
                  {p.pagado ? (
                    <span className="stats-badge yes">Pagado</span>
                  ) : p.vencido ? (
                    <span className="stats-badge no">Vencido</span>
                  ) : p.pendienteHoy ? (
                    <span style={{ color: '#b45309', fontWeight: 600 }}>Vence hoy</span>
                  ) : (
                    <span style={{ color: '#6b7280' }}>Pendiente</span>
                  )}
                </td>
                <td>
                  {p.pagado ? (
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => togglePago(p.mes, p.anio, false)}>
                      Anular pago
                    </button>
                  ) : (
                    <button type="button" className="btn" disabled={busy} onClick={() => togglePago(p.mes, p.anio, true)}>
                      Registrar pago
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccionesRapidasCuotas({ usuario, onDone }) {
  const usuarioId = usuario?.id;
  const currentCuotas = Math.max(0, Number(usuario?.cuotasTotales) || 0);
  const [cuotasTotales, setCuotasTotales] = useState('');

  const patch = (body, reset) => {
    if (!usuarioId) return;
    fetch(`/api/admin/usuarios/${usuarioId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then((r) => r.ok ? (onDone(), reset?.()) : r.json())
      .then((data) => data?.error && alert(data.error));
  };

  const bajarCuotas = () => patch({ cuotasTotales: Math.max(0, currentCuotas - 1) });
  const subirCuotas = () => patch({ cuotasTotales: currentCuotas + 1 });

  const aplicar = () => {
    if (cuotasTotales === '') return;
    const n = Math.max(0, parseInt(cuotasTotales, 10) || 0);
    patch({ cuotasTotales: n }, () => setCuotasTotales(''));
  };

  if (!usuarioId) return null;

  return (
    <>
      <div className="form-group">
        <label>Cuotas de pago (totales)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn secondary" onClick={bajarCuotas} disabled={currentCuotas <= 0}>Bajar</button>
          <span style={{ minWidth: '2rem' }}>{currentCuotas}</span>
          <button type="button" className="btn secondary" onClick={subirCuotas}>Subir</button>
          <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>o poner valor:</span>
          <input type="number" min={0} value={cuotasTotales} onChange={(e) => setCuotasTotales(e.target.value)} placeholder="Opcional" style={{ width: '5rem' }} />
        </div>
      </div>
      <button type="button" className="btn" onClick={aplicar}>Aplicar</button>
    </>
  );
}

function PanelCuotasAbonos({ usuario, onDone }) {
  const usuarioId = usuario?.id;
  const montoTotal = usuario?.montoTotal != null ? Number(usuario.montoTotal) : null;
  const montoEnganche = usuario?.montoEnganche != null ? Number(usuario.montoEnganche) : 0;
  const montoPorCuota = usuario?.montoPorCuota != null ? Number(usuario.montoPorCuota) : null;
  const abonos = (usuario?.abonos && Array.isArray(usuario.abonos)) ? usuario.abonos : [];
  const totalAbonado = abonos.reduce((s, a) => s + Number(a.monto || 0), 0);
  const mensualidadesPagadas = (usuario?.mensualidades && Array.isArray(usuario.mensualidades))
    ? usuario.mensualidades.filter((m) => m.pagado).reduce((s, m) => s + Number(m.monto || 0), 0)
    : 0;
  const totalPagado = montoEnganche + totalAbonado + mensualidadesPagadas;
  const saldoPendiente = (montoTotal != null && montoTotal > 0) ? Math.max(0, montoTotal - totalPagado) : null;
  const cuotasRestantes = (saldoPendiente != null && montoPorCuota != null && montoPorCuota > 0)
    ? saldoPendiente / montoPorCuota
    : null;

  const [nuevoAbono, setNuevoAbono] = useState('');
  const [enviando, setEnviando] = useState(false);

  const añadirAbono = () => {
    const monto = parseFloat(nuevoAbono.replace(',', '.'), 10);
    if (!Number.isFinite(monto) || monto <= 0) {
      alert('Ingresa un monto válido y positivo.');
      return;
    }
    setEnviando(true);
    fetch(`/api/admin/usuarios/${usuarioId}/abonos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ monto }),
    })
      .then((r) => r.ok ? (setNuevoAbono(''), onDone()) : r.json())
      .then((data) => data?.error && alert(data.error))
      .finally(() => setEnviando(false));
  };

  if (!usuarioId) return null;

  return (
    <div className="card">
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 1rem', margin: '0 0 1rem 0' }}>
        <dt style={{ color: '#6b7280' }}>Monto total</dt>
        <dd>{montoTotal != null ? montoTotal.toLocaleString('es-BO') : '-'}</dd>
        <dt style={{ color: '#6b7280' }}>Enganche / inscripción</dt>
        <dd>{montoEnganche > 0 ? montoEnganche.toLocaleString('es-BO') : '—'}</dd>
        <dt style={{ color: '#6b7280' }}>Resto a cubrir en cuotas (total − enganche)</dt>
        <dd>
          {montoTotal != null
            ? Math.max(0, montoTotal - montoEnganche).toLocaleString('es-BO')
            : '-'}
        </dd>
        <dt style={{ color: '#6b7280' }}>Monto por cuota</dt>
        <dd>{montoPorCuota != null ? montoPorCuota.toLocaleString('es-BO') : '-'}</dd>
        <dt style={{ color: '#6b7280' }}>Total pagado (enganche + abonos + cuotas)</dt>
        <dd>{totalPagado.toLocaleString('es-BO')}</dd>
        <dt style={{ color: '#6b7280' }}>Saldo pendiente</dt>
        <dd>{saldoPendiente != null ? saldoPendiente.toLocaleString('es-BO') : '-'}</dd>
        <dt style={{ color: '#6b7280' }}>Cuotas restantes (equivalente)</dt>
        <dd>{cuotasRestantes != null ? cuotasRestantes.toFixed(2) : '-'}</dd>
      </dl>
      {abonos.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <strong>Abonos:</strong>
          <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
            {abonos.map((a) => (
              <li key={a.id}>
                {Number(a.monto).toLocaleString('es-BO')} — {new Date(a.fecha).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 100%' }}>Añadir abono (monto)</label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={nuevoAbono}
          onChange={(e) => setNuevoAbono(e.target.value)}
          placeholder="Ej. 1500"
          style={{ width: '8rem' }}
        />
        <button
          type="button"
          className="btn"
          onClick={añadirAbono}
          disabled={enviando || !nuevoAbono.trim()}
        >
          {enviando ? 'Guardando...' : 'Añadir abono'}
        </button>
      </div>
    </div>
  );
}
