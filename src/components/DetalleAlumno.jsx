import React from 'react';
import { labelFuncion } from '../constants/funciones';
import { labelModalidad } from '../constants/modalidad';

/** Muestra la información de un alumno de forma legible (sin JSON). mostrarId: mostrar campo ID. acciones: solo se muestra si se pasa (ej. en Alumnos > Editar). */
export default function DetalleAlumno({ usuario, ultimoRegistro, historialAuditoria, acciones, mostrarId = true }) {
  if (!usuario) return null;
  const funciones = usuario.funciones && Array.isArray(usuario.funciones) ? usuario.funciones : [];
  return (
    <div className="detalle-alumno">
      <section className="card">
        <h4>Datos personales</h4>
        <dl className="detalle-alumno-dl">
          {mostrarId && (
            <>
              <dt className="detalle-alumno-dt">ID</dt>
              <dd className="detalle-alumno-dd">{usuario.id}</dd>
            </>
          )}
          <dt className="detalle-alumno-dt">Nombre</dt>
          <dd className="detalle-alumno-dd">{usuario.nombre} {usuario.apellidos}</dd>
          <dt className="detalle-alumno-dt">Planes</dt>
          <dd className="detalle-alumno-dd">{funciones.length ? funciones.map(labelFuncion).join(', ') : '-'}</dd>
          <dt className="detalle-alumno-dt">Plan</dt>
          <dd className="detalle-alumno-dd">{usuario.plan?.nombre ?? '-'}</dd>
          <dt className="detalle-alumno-dt">Correo</dt>
          <dd className="detalle-alumno-dd">{usuario.email ?? '-'}</dd>
          <dt className="detalle-alumno-dt">Celular</dt>
          <dd className="detalle-alumno-dd">{usuario.celular ?? '-'}</dd>
          <dt className="detalle-alumno-dt">País</dt>
          <dd className="detalle-alumno-dd">{usuario.pais}</dd>
          <dt className="detalle-alumno-dt">Departamento</dt>
          <dd className="detalle-alumno-dd">{usuario.departamento ?? '-'}</dd>
          <dt className="detalle-alumno-dt">Modalidad</dt>
          <dd className="detalle-alumno-dd">{labelModalidad(usuario.modalidad)}</dd>
          <dt className="detalle-alumno-dt">Horas (saldo)</dt>
          <dd className="detalle-alumno-dd">{usuario.horasSaldo}</dd>
          <dt className="detalle-alumno-dt">Tutor legal</dt>
          <dd className="detalle-alumno-dd">{usuario.tutorLegal ?? '-'}</dd>
          <dt className="detalle-alumno-dt">Observaciones</dt>
          <dd className="detalle-alumno-dd">{usuario.observaciones ?? '-'}</dd>
          <dt className="detalle-alumno-dt">Fecha registro</dt>
          <dd className="detalle-alumno-dd">{usuario.fechaRegistro ? new Date(usuario.fechaRegistro).toLocaleDateString() : '-'}</dd>
          <dt className="detalle-alumno-dt">Cuotas totales</dt>
          <dd className="detalle-alumno-dd">{usuario.cuotasTotales ?? '-'}</dd>
          <dt className="detalle-alumno-dt">Fecha primer vencimiento</dt>
          <dd className="detalle-alumno-dd">
            {usuario.fechaPrimerVencimiento
              ? new Date(String(usuario.fechaPrimerVencimiento).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-BO')
              : '-'}
          </dd>
          <dt className="detalle-alumno-dt">Monto total</dt>
          <dd className="detalle-alumno-dd">{usuario.montoTotal != null ? Number(usuario.montoTotal).toLocaleString('es-BO') : '-'}</dd>
          <dt className="detalle-alumno-dt">Enganche / inscripción</dt>
          <dd className="detalle-alumno-dd">
            {usuario.montoEnganche != null && Number(usuario.montoEnganche) > 0
              ? Number(usuario.montoEnganche).toLocaleString('es-BO')
              : '—'}
          </dd>
          <dt className="detalle-alumno-dt">Resto en cuotas (total − enganche)</dt>
          <dd className="detalle-alumno-dd">
            {usuario.montoTotal != null
              ? (() => {
                  const t = Number(usuario.montoTotal);
                  const e = usuario.montoEnganche != null ? Number(usuario.montoEnganche) : 0;
                  return Math.max(0, t - e).toLocaleString('es-BO');
                })()
              : '-'}
          </dd>
          <dt className="detalle-alumno-dt">Monto por cuota</dt>
          <dd className="detalle-alumno-dd">{usuario.montoPorCuota != null ? Number(usuario.montoPorCuota).toLocaleString('es-BO') : '-'}</dd>
          <dt className="detalle-alumno-dt">Pago contado</dt>
          <dd className="detalle-alumno-dd">{usuario.pagoContado ? 'Sí' : 'No'}</dd>
          <dt className="detalle-alumno-dt">Activo</dt>
          <dd className="detalle-alumno-dd">{usuario.activo ? 'Sí' : 'No'}</dd>
        </dl>
      </section>
      {ultimoRegistro && (
        <section className="card">
          <h4>Último registro</h4>
          <p style={{ margin: 0 }}>
            {ultimoRegistro.accionEtiqueta || ultimoRegistro.accion} — {new Date(ultimoRegistro.createdAt).toLocaleString()}
            {(ultimoRegistro.adminDisplay ||
              ultimoRegistro.adminEmail ||
              ultimoRegistro.detalles?.adminEtiqueta ||
              ultimoRegistro.detalles?.adminEmail) && (
              <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem', color: '#475569' }}>
                Administrador:{' '}
                {ultimoRegistro.adminDisplay ??
                  ultimoRegistro.detalles?.adminEtiqueta ??
                  ultimoRegistro.adminEmail ??
                  ultimoRegistro.detalles?.adminEmail}
              </span>
            )}
          </p>
        </section>
      )}
      {historialAuditoria && historialAuditoria.length > 0 && (
        <section className="card">
          <h4>Historial de modificaciones</h4>
          <ul className="detalle-alumno-list">
            {historialAuditoria.map((a) => (
              <li key={a.id}>
                {new Date(a.createdAt).toLocaleString()} — {a.accionEtiqueta || a.accion}
                {(a.adminDisplay ||
                  a.adminEmail ||
                  a.detalles?.adminEtiqueta ||
                  a.detalles?.adminEmail) && (
                  <span style={{ color: '#475569' }}>
                    {' · '}Admin:{' '}
                    {a.adminDisplay ??
                      a.detalles?.adminEtiqueta ??
                      a.adminEmail ??
                      a.detalles?.adminEmail}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {acciones ? <div style={{ marginTop: '1rem' }}>{acciones}</div> : null}
    </div>
  );
}
