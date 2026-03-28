import React, { useState, useEffect } from 'react';
import { labelFuncion } from '../../constants/funciones';
import { labelModalidad } from '../../constants/modalidad';

export default function UsuarioMiInformacion() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/usuario/mi-informacion', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card">Cargando...</div>;
  if (!data) return <div className="card">No se pudo cargar la información.</div>;

  const { usuario, horasPlaneadas, mensualidades, cuotasRestantes, historialClases, resumenCuotas } = data;

  return (
    <div>
      <h2>Mi información</h2>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Datos personales</h3>
        <p><strong>Nombre:</strong> {usuario.nombre} {usuario.apellidos}</p>
        <p><strong>Planes:</strong> {(usuario.funciones && Array.isArray(usuario.funciones) ? usuario.funciones : []).map(labelFuncion).join(', ') || '-'}</p>
        <p><strong>Plan:</strong> {usuario.plan?.nombre ?? '-'}</p>
        <p><strong>Horas (saldo):</strong> {usuario.horasSaldo}</p>
        <p><strong>Observaciones:</strong> {usuario.observaciones ?? '-'}</p>
        <p><strong>Tutor legal:</strong> {usuario.tutorLegal ?? '-'}</p>
        <p><strong>País:</strong> {usuario.pais}</p>
        <p><strong>Departamento:</strong> {usuario.departamento ?? '-'}</p>
        <p><strong>Modalidad:</strong> {labelModalidad(usuario.modalidad)}</p>
        <p><strong>Celular:</strong> {usuario.celular ?? '-'}</p>
        <p><strong>Correo:</strong> {usuario.email ?? '-'}</p>
        <p><strong>Fecha registro:</strong> {usuario.fechaRegistro ? new Date(usuario.fechaRegistro).toLocaleDateString() : '-'}</p>
      </div>
      <div className="card">
        <h3>Horas planeadas (próximas sesiones)</h3>
        {horasPlaneadas?.length ? (
          <ul style={{ paddingLeft: '1.25rem' }}>
            {horasPlaneadas.map((h, i) => (
              <li key={i}>{new Date(h.fecha).toLocaleDateString()} {h.horaInicio}-{h.horaFin} — {h.asesora ?? '-'}</li>
            ))}
          </ul>
        ) : <p style={{ color: '#6b7280' }}>No hay próximas sesiones.</p>}
      </div>
      <div className="card">
        <h3>Costos / mensualidades</h3>
        <p><strong>Horas restantes:</strong> {usuario.horasSaldo ?? 0}</p>
        {usuario.pagoContado ? <p><strong>Pago:</strong> Al contado.</p> : (
          <>
            {usuario.fechaPrimerVencimiento && (
              <p>
                <strong>Primer vencimiento:</strong>{' '}
                {new Date(String(usuario.fechaPrimerVencimiento).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-BO')}
              </p>
            )}
            {resumenCuotas?.modo === 'por_fecha' && resumenCuotas.montoProximaCuota != null && resumenCuotas.proximoVencimiento && (
              <p>
                <strong>Próximo pago:</strong> {Number(resumenCuotas.montoProximaCuota).toLocaleString('es-BO')} — vence{' '}
                {new Date(resumenCuotas.proximoVencimiento + 'T12:00:00').toLocaleDateString('es-BO')}
              </p>
            )}
            {resumenCuotas?.enMora && (
              <p style={{ color: '#b91c1c', fontWeight: 600 }}>Hay cuotas vencidas sin registrar pago. Contacta administración.</p>
            )}
            {usuario.montoTotal != null && (
              <>
                <p><strong>Monto total:</strong> {Number(usuario.montoTotal).toLocaleString('es-BO')}</p>
                {usuario.montoEnganche != null && Number(usuario.montoEnganche) > 0 && (
                  <p><strong>Enganche (inscripción):</strong> {Number(usuario.montoEnganche).toLocaleString('es-BO')}</p>
                )}
                <p>
                  <strong>Resto en cuotas:</strong>{' '}
                  {Math.max(0, Number(usuario.montoTotal) - (usuario.montoEnganche != null ? Number(usuario.montoEnganche) : 0)).toLocaleString('es-BO')}
                </p>
              </>
            )}
            <p><strong>Cuotas:</strong> {cuotasRestantes != null ? `${cuotasRestantes} restantes` : '-'} {usuario.cuotasTotales != null ? ` de ${usuario.cuotasTotales} totales` : ''}</p>
            {usuario.montoPorCuota != null && (
              <p><strong>Monto por cuota:</strong> {Number(usuario.montoPorCuota).toLocaleString('es-BO')}</p>
            )}
            {mensualidades?.length > 0 && (
              <table>
                <thead>
                  <tr><th>Mes/Año</th><th>Pagado</th><th>Fecha pago</th></tr>
                </thead>
                <tbody>
                  {mensualidades.slice(0, 12).map((m) => (
                    <tr key={m.id}>
                      <td>{m.mes}/{m.anio}</td>
                      <td>{m.pagado ? 'Sí' : 'No'}</td>
                      <td>{m.fechaPago ? new Date(m.fechaPago).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
      <div className="card">
        <h3>Historial de clases</h3>
        {historialClases?.length ? (
          <table>
            <thead>
              <tr><th>Fecha</th><th>Asesora</th><th>Presente</th><th>Avance</th><th>Observaciones</th></tr>
            </thead>
            <tbody>
              {historialClases.map((c, i) => (
                <tr key={i}>
                  <td>{new Date(c.fecha).toLocaleDateString()}</td>
                  <td>{c.asesora ?? '-'}</td>
                  <td>{c.presente === true ? 'Sí' : c.presente === false ? 'No' : '-'}</td>
                  <td>{c.avance ?? '-'}</td>
                  <td>{c.observaciones ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{ color: '#6b7280' }}>Aún no hay historial.</p>}
      </div>
    </div>
  );
}
