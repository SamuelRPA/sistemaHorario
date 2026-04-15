import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FUNCIONES_OPCIONES, labelFuncion } from '../../constants/funciones';
import { labelModalidad } from '../../constants/modalidad';
import { apiUrl } from '../../apiUrl.js';

const TABS = [
  { id: 'asistencia', label: 'Asistencia alumnos' },
  { id: 'horas-asesoras', label: 'Horas asesoras' },
  { id: 'alumnos', label: 'Alumnos inscritos' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'auditoria', label: 'Auditoría' },
];

/** Sub-vistas de auditoría (filtran por tipo de actor / entidad). */
const AUDITORIA_ALCANCE = [
  { id: 'alumnos', label: 'Alumnos', hint: 'Eventos donde interviene un alumno (inscripciones, ediciones, cuotas, etc.)' },
  { id: 'asesoras', label: 'Asesoras', hint: 'Eventos donde interviene una asesora (altas de alumno a horario, etc.)' },
  { id: 'sistema', label: 'Sistema / cuentas', hint: 'Altas de cuenta, recuperación de contraseña sin actor alumno/asesora en el registro' },
];

const AUDITORIA_ACCIONES = [
  { id: '', label: '— Cualquier acción —' },
  { id: 'alumno_salida_horario', label: 'Alumno sale de horario' },
  { id: 'asesora_agrega_alumno_horario', label: 'Asesora agrega alumno a horario' },
  { id: 'asesora_quita_alumno_horario', label: 'Asesora quita alumno de horario' },
  { id: 'admin_sustitucion_semanal', label: 'Admin sustitución semanal' },
  { id: 'admin_edicion_alumno', label: 'Admin edita alumno' },
  { id: 'admin_pago_cuota', label: 'Admin registra pago de cuota' },
  { id: 'admin_consulta_reporte_horas_asesoras', label: 'Admin consulta horas asesoras' },
  { id: 'admin_registro_abono', label: 'Admin registra abono' },
  { id: 'admin_edicion_asesora', label: 'Admin edita asesora' },
  { id: 'admin_desactiva_asesora_libera_horarios', label: 'Admin inhabilita asesora (libera horarios)' },
  { id: 'admin_desactiva_alumno_libera_horarios', label: 'Admin inhabilita alumno (quita inscripciones)' },
  { id: 'admin_edita_perfil', label: 'Admin edita su perfil' },
  { id: 'auth_force_password_change_required', label: 'Forzar cambio de contraseña (alta cuenta)' },
  { id: 'auth_recuperacion_password', label: 'Recuperación de contraseña' },
  { id: 'auth_password_changed_first_login', label: 'Contraseña cambiada (primer ingreso)' },
  { id: 'asesora_confirma_horarios_disponibles', label: 'Asesora confirma horarios disponibles' },
  { id: 'asesora_edita_horario', label: 'Asesora edita un horario' },
  { id: 'asesora_edita_perfil', label: 'Asesora edita su perfil' },
  { id: 'asesora_sesion_creada_auto', label: 'Sistema crea sesión (auto)' },
  { id: 'asesora_marca_todos_presentes', label: 'Asesora marca todos presentes' },
  { id: 'asesora_registra_asistencia_alumno', label: 'Asesora registra asistencia de un alumno' },
  { id: 'alumno_inicio_sesion', label: 'Alumno inicia sesión' },
  { id: 'alumno_acceso_link_zoom', label: 'Alumno abre enlace Zoom' },
  { id: 'intento_login_fallido', label: 'Intento de login fallido' },
];

const AUDITORIA_ENTIDADES = [
  { id: '', label: '— Cualquier entidad —' },
  { id: 'usuario', label: 'Usuario' },
  { id: 'login', label: 'Inicio de sesión' },
  { id: 'cuenta', label: 'Cuenta' },
  { id: 'asesora', label: 'Asesora' },
  { id: 'horario', label: 'Horario' },
  { id: 'sesion', label: 'Sesión' },
  { id: 'asistencia_sesion', label: 'Asistencia en sesión' },
  { id: 'inscripcion_horario', label: 'Inscripción horario' },
  { id: 'mensualidad', label: 'Mensualidad' },
  { id: 'abono', label: 'Abono' },
];

const MESES_NOMBRE = [
  { id: '', label: 'Todo el año' },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({
    id: String(m),
    label: new Date(2000, m - 1, 1).toLocaleString('es', { month: 'long' }),
  })),
];

function safeDateEs(v) {
  if (v == null || v === '') return '–';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('es');
}

function safeDateTimeEs(v) {
  if (v == null || v === '') return '–';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleString('es');
}

/** Texto para filtro y listas: nombre de perfil + correo de la cuenta admin. */
function etiquetaAdminOpcion(adm) {
  if (!adm?.email) return '';
  const nom = [adm.nombre, adm.apellidos]
    .filter((x) => x != null && String(x).trim() !== '')
    .join(' ')
    .trim();
  if (nom) return `${nom} · ${adm.email}`;
  return adm.email;
}

export default function AdminEstadisticas() {
  const [tab, setTab] = useState('asistencia');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [dia, setDia] = useState(new Date().toISOString().slice(0, 10));
  const [paisFiltro, setPaisFiltro] = useState('');
  /** IDs de funciones seleccionadas; vacío = todas (sin filtrar por función) */
  const [funcionesFiltro, setFuncionesFiltro] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [asesoraExpandida, setAsesoraExpandida] = useState(null);
  const [pdfDescargandoId, setPdfDescargandoId] = useState(null);

  const descargarPdfHorasAsesora = async (asesoraId) => {
    if (!asesoraId) return;
    setPdfDescargandoId(asesoraId);
    try {
      const params = new URLSearchParams({ anio: String(anio), mes: String(mes), asesoraId });
      const res = await fetch(apiUrl(`/api/admin/reportes/horas-asesoras/pdf?${params}`), { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        window.alert(err.error || 'No se pudo generar el PDF');
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      let fname = `clases-asesora-${anio}-${mes}.pdf`;
      const m = cd && cd.match(/filename="([^"]+)"/);
      if (m) fname = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('No se pudo descargar el PDF');
    } finally {
      setPdfDescargandoId(null);
    }
  };

  const [auditAlcance, setAuditAlcance] = useState('alumnos');
  const [auditMes, setAuditMes] = useState('');
  const [auditFunciones, setAuditFunciones] = useState([]);
  const [auditAccion, setAuditAccion] = useState('');
  const [auditEntidad, setAuditEntidad] = useState('');
  const [auditQ, setAuditQ] = useState('');
  const [auditAdminId, setAuditAdminId] = useState('');
  const [listaAdmins, setListaAdmins] = useState([]);

  /** Evita que respuestas lentas de otra pestaña sobrescriban datos (pantalla en blanco / datos cruzados). */
  const fetchGenRef = useRef(0);

  const funcionesFiltroKey = useMemo(() => [...funcionesFiltro].sort().join(','), [funcionesFiltro]);
  const auditFiltrosKey = useMemo(
    () =>
      [auditAlcance, auditMes, auditAccion, auditEntidad, auditQ, auditAdminId, [...auditFunciones].sort().join(',')].join('|'),
    [auditAlcance, auditMes, auditAccion, auditEntidad, auditQ, auditAdminId, auditFunciones]
  );

  useEffect(() => {
    if (tab !== 'auditoria') return;
    fetch(apiUrl('/api/admin/administradores'), { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setListaAdmins(Array.isArray(d.administradores) ? d.administradores : []))
      .catch(() => setListaAdmins([]));
  }, [tab]);

  const load = () => {
    const gen = ++fetchGenRef.current;
    setLoading(true);
    const done = () => {
      if (gen === fetchGenRef.current) setLoading(false);
    };
    const apply = (json) => {
      if (gen !== fetchGenRef.current) return;
      setData(json);
    };

    if (tab === 'asistencia') {
      fetch(apiUrl(`/api/admin/reportes/asistencia?anio=${anio}&dia=${dia}`), { credentials: 'include' })
        .then((r) => r.json())
        .then(apply)
        .catch(() => apply({ reporte: [], _error: true }))
        .finally(done);
    } else if (tab === 'horas-asesoras') {
      fetch(apiUrl(`/api/admin/reportes/horas-asesoras?anio=${anio}&mes=${mes}`), { credentials: 'include' })
        .then((r) => r.json())
        .then(apply)
        .catch(() => apply({ reporte: [], _error: true }))
        .finally(done);
    } else if (tab === 'alumnos') {
      const params = new URLSearchParams();
      if (paisFiltro.trim()) params.set('pais', paisFiltro.trim());
      if (funcionesFiltro.length) params.set('funciones', funcionesFiltro.join(','));
      fetch(apiUrl(`/api/admin/reportes/alumnos?${params}`), { credentials: 'include' })
        .then((r) => r.json())
        .then(apply)
        .catch(() => apply({ reporte: [], total: 0, _error: true }))
        .finally(done);
    } else if (tab === 'pagos') {
      fetch(apiUrl(`/api/admin/reportes/pagos?mes=${mes}&anio=${anio}`), { credentials: 'include' })
        .then((r) => r.json())
        .then(apply)
        .catch(() => apply({ reporte: [], _error: true }))
        .finally(done);
    } else if (tab === 'actividad') {
      fetch(apiUrl(`/api/admin/reportes/actividad?anio=${anio}`), { credentials: 'include' })
        .then((r) => r.json())
        .then(apply)
        .catch(() => apply({ inscripciones: 0, porPlan: {}, porPais: {}, _error: true }))
        .finally(done);
    } else if (tab === 'auditoria') {
      const params = new URLSearchParams();
      params.set('anio', String(anio));
      if (auditMes !== '' && auditMes != null) params.set('mes', String(auditMes));
      params.set('alcance', auditAlcance);
      params.set('take', '400');
      if (auditFunciones.length && auditAlcance === 'alumnos') params.set('funciones', auditFunciones.join(','));
      if (auditAccion) params.set('accion', auditAccion);
      if (auditEntidad) params.set('entidad', auditEntidad);
      if (auditQ.trim()) params.set('q', auditQ.trim());
      if (auditAdminId) params.set('adminId', auditAdminId);
      fetch(apiUrl(`/api/admin/reportes/auditoria?${params}`), { credentials: 'include' })
        .then((r) => r.json())
        .then(apply)
        .catch(() => apply({ auditorias: [], _error: true }))
        .finally(done);
    } else {
      done();
    }
  };

  useEffect(() => {
    load();
  }, [tab, anio, mes, dia, paisFiltro, funcionesFiltroKey, auditFiltrosKey]);

  const toggleFuncionFiltro = (id) => {
    setFuncionesFiltro((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAuditFuncion = (id) => {
    setAuditFunciones((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  useEffect(() => {
    if (tab !== 'horas-asesoras') setAsesoraExpandida(null);
  }, [tab, anio, mes]);

  return (
    <div className="stats-page">
      <h2 style={{ marginBottom: '0.5rem' }}>Estadísticas</h2>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
        Reportes por asistencia, horas de asesoras, alumnos inscritos, pagos y actividad.
      </p>

      <div className="stats-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'asistencia' || tab === 'actividad') && (
        <div className="stats-filters">
          <div className="form-group">
            <label>Año</label>
            <input
              type="number"
              value={anio}
              onChange={(e) => setAnio(parseInt(e.target.value, 10) || new Date().getFullYear())}
              style={{ width: 90 }}
            />
          </div>
          {tab === 'asistencia' && (
            <div className="form-group">
              <label>Día</label>
              <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {tab === 'auditoria' && (
        <>
          <div className="stats-tabs" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {AUDITORIA_ALCANCE.map((a) => (
              <button
                key={a.id}
                type="button"
                className={auditAlcance === a.id ? 'active' : ''}
                title={a.hint}
                onClick={() => setAuditAlcance(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1rem 0', maxWidth: '52rem' }}>
            {AUDITORIA_ALCANCE.find((x) => x.id === auditAlcance)?.hint}
          </p>
          <div className="stats-filters" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: '1rem' }}>
            <div className="form-group">
              <label>Año</label>
              <input
                type="number"
                value={anio}
                onChange={(e) => setAnio(parseInt(e.target.value, 10) || new Date().getFullYear())}
                style={{ width: 90 }}
              />
            </div>
            <div className="form-group">
              <label>Mes</label>
              <select value={auditMes} onChange={(e) => setAuditMes(e.target.value)} style={{ minWidth: 140 }}>
                {MESES_NOMBRE.map((m) => (
                  <option key={m.id === '' ? 'all' : m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Acción</label>
              <select value={auditAccion} onChange={(e) => setAuditAccion(e.target.value)} style={{ minWidth: 220 }}>
                {AUDITORIA_ACCIONES.map((opt) => (
                  <option key={opt.id || 'any'} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Entidad</label>
              <select value={auditEntidad} onChange={(e) => setAuditEntidad(e.target.value)} style={{ minWidth: 180 }}>
                {AUDITORIA_ENTIDADES.map((opt) => (
                  <option key={opt.id || 'any-e'} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Administrador</label>
              <select
                value={auditAdminId}
                onChange={(e) => setAuditAdminId(e.target.value)}
                style={{ minWidth: 220 }}
                title="Filtrar por la cuenta de administración que registró la acción"
              >
                <option value="">— Todos los administradores —</option>
                {listaAdmins.map((adm) => (
                  <option key={adm.id} value={adm.id}>
                    {etiquetaAdminOpcion(adm)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: 200, flex: '1 1 200px' }}>
              <label>Buscar texto</label>
              <input
                type="search"
                value={auditQ}
                onChange={(e) => setAuditQ(e.target.value)}
                placeholder="Nombre, acción, detalles…"
                style={{ width: '100%' }}
              />
            </div>
          </div>
          {auditAlcance === 'alumnos' && (
            <div className="stats-filters" style={{ flexWrap: 'wrap', alignItems: 'flex-start', marginTop: '0.5rem' }}>
              <div className="form-group" style={{ minWidth: 280, flex: '1 1 320px' }}>
                <label>Materias del alumno (auditoría)</label>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                  Solo eventos de alumnos que tengan al menos una de estas materias en su ficha. Sin marcar = todos los alumnos.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                  {FUNCIONES_OPCIONES.map((f) => (
                    <label key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={auditFunciones.includes(f.id)} onChange={() => toggleAuditFuncion(f.id)} />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {(tab === 'horas-asesoras' || tab === 'pagos') && (
        <div className="stats-filters">
          <div className="form-group">
            <label>Año</label>
            <input
              type="number"
              value={anio}
              onChange={(e) => setAnio(parseInt(e.target.value, 10) || new Date().getFullYear())}
              style={{ width: 90 }}
            />
          </div>
          <div className="form-group">
            <label>Mes</label>
            <select value={mes} onChange={(e) => setMes(parseInt(e.target.value, 10))} style={{ minWidth: 100 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString('es', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {tab === 'alumnos' && (
        <div className="stats-filters" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="form-group">
            <label>País</label>
            <input
              type="text"
              value={paisFiltro}
              onChange={(e) => setPaisFiltro(e.target.value)}
              placeholder="Ej. Bolivia (vacío = todos)"
              style={{ minWidth: 160 }}
            />
          </div>
          <div className="form-group" style={{ minWidth: 220, flex: '1 1 280px' }}>
            <label>Funciones / materias</label>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              Marca una o varias para filtrar (alumnos que tengan al menos una). Sin marcar = todos.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
              {FUNCIONES_OPCIONES.map((f) => (
                <label key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={funcionesFiltro.includes(f.id)}
                    onChange={() => toggleFuncionFiltro(f.id)}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="stats-card">
          <p style={{ margin: 0, color: '#6b7280' }}>Cargando...</p>
        </div>
      )}

      {data && !loading && tab === 'asistencia' && (
        <div className="stats-card">
          <h3>Asistencia del alumno</h3>
          <p className="stats-note">
            Horas que pasó el alumno, cuándo se marcó la asistencia y por qué asesora. Solo sesiones con registro.
          </p>
          {data._error && (
            <p style={{ color: 'var(--danger-red)', marginBottom: '0.75rem' }}>No se pudo cargar el reporte. Reintenta.</p>
          )}
          {Array.isArray(data.reporte) && data.reporte.length > 0 ? (
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Fecha clase</th>
                  <th>Fecha marcado</th>
                  <th>Alumno</th>
                  <th>Plan</th>
                  <th>Asesora</th>
                  <th>Presente</th>
                  <th>Clase completada</th>
                </tr>
              </thead>
              <tbody>
                {data.reporte.map((r, i) => (
                  <tr key={r?.sesionId || r?.fecha || i}>
                    <td>{safeDateEs(r?.fecha)}</td>
                    <td>{r?.fechaMarcado ? safeDateTimeEs(r.fechaMarcado) : '–'}</td>
                    <td>{r?.alumno ?? '–'}</td>
                    <td>{r?.plan || '–'}</td>
                    <td>{r?.asesora || '–'}</td>
                    <td>
                      <span className={`stats-badge ${r?.presente ? 'yes' : 'no'}`}>
                        {r?.presente ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`stats-badge ${r?.pasoClase ? 'yes' : 'no'}`}>
                        {r?.pasoClase ? 'Sí' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#6b7280', margin: 0 }}>No hay registros de asistencia para el día seleccionado.</p>
          )}
        </div>
      )}

      {data && !loading && tab === 'horas-asesoras' && (
        <div className="stats-card">
          <h3>Horas de asesoras</h3>
          <p className="stats-note">
            Solo se cuentan sesiones con <strong>al menos un alumno inscrito activo</strong> en ese horario, desde la <strong>fecha en que la asesora confirmó sus horarios disponibles</strong> (cada confirmación actualiza la fecha). Cada sesión cuenta 1 hora cuando la asesora marca la clase como pasada. Haz clic en una asesora para ver el detalle.
          </p>
          {data._error && (
            <p style={{ color: 'var(--danger-red)', marginBottom: '0.75rem' }}>No se pudo cargar el reporte. Reintenta.</p>
          )}
          {Array.isArray(data.reporte) && data.reporte.length > 0 ? (
            <>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Asesora</th>
                    <th>Conteo desde</th>
                    <th>Horas hechas</th>
                    <th>No hechas</th>
                    <th>Total sesiones</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.reporte.map((r, i) => {
                    const key = r.asesora?.id || String(i);
                    const abierta = asesoraExpandida === key;
                    return (
                      <tr key={key}>
                        <td>{r.asesora ? `${r.asesora.nombre} ${r.asesora.apellidos}` : '–'}</td>
                        <td style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                          {r.fechaConteoHorasDesde ? safeDateEs(r.fechaConteoHorasDesde) : '— (todas)'}
                        </td>
                        <td><span className="stats-badge yes">{r.horas ?? 0}</span></td>
                        <td><span className="stats-badge no">{r.horasNoHechas ?? 0}</span></td>
                        <td><strong>{r.totalSesiones ?? 0}</strong></td>
                        <td>
                          <button
                            type="button"
                            className="btn secondary"
                            onClick={() => setAsesoraExpandida(abierta ? null : key)}
                          >
                            {abierta ? 'Ocultar detalle' : 'Ver detalle'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(() => {
                const abierta = data.reporte.find((r, i) => (r.asesora?.id || String(i)) === asesoraExpandida);
                if (!abierta) return null;
                return (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: 0, flex: '1 1 auto' }}>
                        Detalle de {abierta.asesora ? `${abierta.asesora.nombre} ${abierta.asesora.apellidos}` : 'asesora'}
                      </h4>
                      {abierta.asesora?.id && (
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={pdfDescargandoId === abierta.asesora.id}
                          onClick={() => descargarPdfHorasAsesora(abierta.asesora.id)}
                        >
                          {pdfDescargandoId === abierta.asesora.id ? 'Generando PDF…' : 'Descargar PDF (desglose del mes)'}
                        </button>
                      )}
                    </div>
                    {Array.isArray(abierta.semanas) && abierta.semanas.length > 0 && (
                      <div style={{ margin: '0 0 1rem 0' }}>
                        <h5 style={{ margin: '0 0 0.5rem 0' }}>Resumen por semana</h5>
                        <table className="stats-table">
                          <thead>
                            <tr>
                              <th>Semana inicio</th>
                              <th>Horas hechas</th>
                              <th>No hechas</th>
                              <th>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {abierta.semanas.map((s) => (
                              <tr key={`${abierta.asesora?.id || 'x'}-${s.semanaInicio}`}>
                                <td>{safeDateEs(s.semanaInicio)}</td>
                                <td><span className="stats-badge yes">{s.horas ?? 0}</span></td>
                                <td><span className="stats-badge no">{s.horasNoHechas ?? 0}</span></td>
                                <td><strong>{s.totalSesiones ?? 0}</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Día</th>
                          <th>Materias / cursos</th>
                          <th>Hora</th>
                          <th>Modalidad</th>
                          <th>¿Pasó clase?</th>
                          <th>Alumnos en clase</th>
                          <th>Presentes/Faltas</th>
                          <th>Marcado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(abierta.sesiones || []).map((s) => (
                          <tr key={s.sesionId}>
                            <td>{safeDateEs(s.fecha)}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {s.diaSemana
                                ? s.diaSemana.charAt(0).toUpperCase() + s.diaSemana.slice(1)
                                : '—'}
                            </td>
                            <td style={{ maxWidth: '14rem', fontSize: '0.875rem' }}>{s.materias || '—'}</td>
                            <td>{s.horaInicio}–{s.horaFin}</td>
                            <td>{labelModalidad(s.modalidad)}</td>
                            <td>
                              <span className={`stats-badge ${s.pasoClase ? 'yes' : 'no'}`}>
                                {s.pasoClase ? 'Sí (1 hora)' : 'No'}
                              </span>
                            </td>
                            <td>{s.alumnosInscritos ?? '—'}</td>
                            <td>{s.presentes}/{s.faltas} (sin marcar: {s.sinMarcar})</td>
                            <td>{s.fechaMarcado ? safeDateTimeEs(s.fechaMarcado) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </>
          ) : (
            <p style={{ color: '#6b7280', margin: 0 }}>No hay horas registradas para el período.</p>
          )}
        </div>
      )}

      {data && !loading && tab === 'alumnos' && (
        <div className="stats-card">
          <h3>Alumnos inscritos</h3>
          <p className="stats-note">
            Filtro por país y por funciones (Lectura dinámica, Nivelación, etc.). Horas consumidas = sesiones en las que el alumno estuvo presente.
          </p>
          {data._error && (
            <p style={{ color: 'var(--danger-red)', marginBottom: '0.75rem' }}>No se pudo cargar el reporte. Reintenta.</p>
          )}
          {data.total !== undefined && (
            <p style={{ marginBottom: '1rem', fontWeight: 600, color: '#1d4ed8' }}>
              Total: {data.total} alumno{data.total !== 1 ? 's' : ''}
            </p>
          )}
          {Array.isArray(data.reporte) && data.reporte.length > 0 ? (
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>País</th>
                  <th>Funciones</th>
                  <th>Horas saldo</th>
                  <th>Horas consumidas</th>
                </tr>
              </thead>
              <tbody>
                {data.reporte.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nombre}</td>
                    <td>{r.pais || '–'}</td>
                    <td>
                      {Array.isArray(r.funciones) && r.funciones.length
                        ? r.funciones.map((id) => labelFuncion(id)).join(', ')
                        : '–'}
                    </td>
                    <td>{r.horasSaldo}</td>
                    <td>{r.horasConsumidas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#6b7280', margin: 0 }}>Ningún alumno coincide con el filtro.</p>
          )}
        </div>
      )}

      {data && !loading && tab === 'pagos' && (
        <div className="stats-card">
          <h3>Pagos (excl. pago contado)</h3>
          {data._error && (
            <p style={{ color: 'var(--danger-red)', marginBottom: '0.75rem' }}>No se pudo cargar el reporte. Reintenta.</p>
          )}
          {Array.isArray(data.reporte) && data.reporte.length > 0 ? (
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Cuotas totales</th>
                  <th>Pagadas</th>
                  <th>Restantes</th>
                  <th>Pagado este mes</th>
                </tr>
              </thead>
              <tbody>
                {data.reporte.map((r) => (
                  <tr key={r.usuarioId}>
                    <td>{r.nombre}</td>
                    <td>{r.cuotasTotales ?? '–'}</td>
                    <td>{r.cuotasPagadas}</td>
                    <td>{r.cuotasRestantes}</td>
                    <td>
                      <span className={`stats-badge ${r.pagadoEsteMes === true ? 'yes' : r.pagadoEsteMes === false ? 'no' : ''}`}>
                        {r.pagadoEsteMes === true ? 'Sí' : r.pagadoEsteMes === false ? 'No' : '–'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#6b7280', margin: 0 }}>No hay usuarios con cuotas (o todos son pago contado).</p>
          )}
        </div>
      )}

      {data && !loading && tab === 'actividad' && (
        <div className="stats-card">
          <h3>Actividad del año</h3>
          <p className="stats-note">
            Nuevos alumnos registrados en {anio}, por plan y por país.
          </p>
          <div className="stats-kpi">
            <div className="stats-kpi-item">
              <div className="value">{data.inscripciones ?? 0}</div>
              <div className="label">Inscripciones</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {data.porPlan && Object.keys(data.porPlan).length > 0 && (
              <div className="stats-activity-block">
                <h4>Por plan</h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {Object.entries(data.porPlan).map(([plan, count]) => (
                    <li key={plan} style={{ marginBottom: '0.35rem' }}>
                      <strong>{plan}</strong>: {count}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.porPais && Object.keys(data.porPais).length > 0 && (
              <div className="stats-activity-block" style={{ borderLeftColor: '#059669' }}>
                <h4>Por país</h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {Object.entries(data.porPais).map(([pais, count]) => (
                    <li key={pais} style={{ marginBottom: '0.35rem' }}>
                      <strong>{pais}</strong>: {count}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {(!data.porPlan || Object.keys(data.porPlan).length === 0) && (!data.porPais || Object.keys(data.porPais).length === 0) && data.inscripciones === 0 && (
            <p style={{ color: '#6b7280', margin: 0 }}>No hay inscripciones en el año seleccionado.</p>
          )}
        </div>
      )}

      {data && !loading && tab === 'auditoria' && (
        <div className="stats-card">
          <h3>
            Auditoría — {AUDITORIA_ALCANCE.find((x) => x.id === auditAlcance)?.label ?? '—'}
          </h3>
          <p className="stats-note">
            Cada fila indica qué administrador realizó la acción (nombre del perfil y correo). Puedes filtrar por administrador, mes, acción, entidad, texto o (en alumnos) por materias del alumno.
          </p>
          {data._error && (
            <p style={{ color: 'var(--danger-red)', marginBottom: '0.75rem' }}>No se pudo cargar el reporte. Reintenta.</p>
          )}
          {Array.isArray(data.auditorias) && data.auditorias.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Fecha/hora</th>
                    <th>Acción</th>
                    <th>Administrador</th>
                    <th>Otros actores</th>
                    <th>Alumno</th>
                    <th>Materias (alumno)</th>
                    <th>Asesora (actor)</th>
                    <th>Entidad</th>
                  </tr>
                </thead>
                <tbody>
                  {data.auditorias.map((a) => {
                    const adminTxt =
                      a.adminDisplay ??
                      a.detalles?.adminEtiqueta ??
                      a.adminEmail ??
                      a.detalles?.adminEmail ??
                      '—';
                    const partesOtros = [];
                    if (a.asesora) partesOtros.push(`Asesora: ${a.asesora.nombre} ${a.asesora.apellidos}`);
                    const otrosActores = partesOtros.length ? partesOtros.join(' · ') : '—';
                    const alumno = a.usuario ? `${a.usuario.nombre} ${a.usuario.apellidos}` : '—';
                    const funcs = Array.isArray(a.usuario?.funciones) ? a.usuario.funciones : [];
                    const materiasTxt =
                      funcs.length > 0 ? funcs.map((id) => labelFuncion(id)).join(', ') : '—';
                    const entidadShort = a.entidadId ? `${String(a.entidadId).slice(0, 8)}…` : '—';
                    const asesoraActor = a.asesora ? `${a.asesora.nombre} ${a.asesora.apellidos}` : '—';
                    return (
                      <tr key={a.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{a.createdAt ? safeDateTimeEs(a.createdAt) : '—'}</td>
                        <td>
                          <strong>{a.accionEtiqueta || a.accion}</strong>
                          {a.detalles?.descripcion ? (
                            <div style={{ fontWeight: 400, fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem' }}>
                              {a.detalles.descripcion}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}>{adminTxt}</td>
                        <td style={{ fontSize: '0.875rem' }}>{otrosActores}</td>
                        <td>{alumno}</td>
                        <td style={{ fontSize: '0.875rem', maxWidth: 220 }}>{materiasTxt}</td>
                        <td>{asesoraActor}</td>
                        <td>
                          {a.entidad} <span style={{ color: '#94a3b8' }}>({entidadShort})</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: '#6b7280', margin: 0 }}>No hay auditorías para el período y filtros elegidos.</p>
          )}
        </div>
      )}
    </div>
  );
}
