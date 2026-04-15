import React, { useState, useEffect } from 'react';
import { FUNCIONES_OPCIONES } from '../../constants/funciones';
import { soloTextoNombre, soloCelular, trimFormStrings, normalizeEnteroHorasSaldo } from '../../utils/inputFilters';
import { apiUrl } from '../../apiUrl.js';

/** Mensajes tipo "Usuario creado..." / "Asesora creada..." */
function esExitoAlta(msg) {
  return /cread[oa]\b/i.test(String(msg || ''));
}

export default function AdminAnadir() {
  const [planes, setPlanes] = useState([]);
  const [tab, setTab] = useState('usuario');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    fetch(apiUrl('/api/admin/planes'), { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setPlanes(d.planes || []))
      .catch(() => setPlanes([]));
  }, []);

  return (
    <div className="anadir-page">
      <h2 style={{ marginBottom: '0.5rem' }}>Añadir usuarios y asesoras</h2>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
        Elige el tipo de alta y completa los datos. Los campos con * son obligatorios.
      </p>

      <div className="anadir-tabs">
        <button
          type="button"
          className={tab === 'usuario' ? 'active' : ''}
          onClick={() => { setTab('usuario'); setMensaje(''); }}
        >
          Alta alumno
        </button>
        <button
          type="button"
          className={tab === 'asesora' ? 'active' : ''}
          onClick={() => { setTab('asesora'); setMensaje(''); }}
        >
          Alta asesora
        </button>
      </div>

      {tab === 'usuario' && (
        <FormUsuario
          planes={planes}
          mensaje={mensaje}
          onSuccess={() => setMensaje('Usuario creado correctamente.')}
          onError={(e) => setMensaje(e)}
        />
      )}
      {tab === 'asesora' && (
        <FormAsesora
          planes={planes}
          mensaje={mensaje}
          onSuccess={() => setMensaje('Asesora creada correctamente.')}
          onError={(e) => setMensaje(e)}
        />
      )}
    </div>
  );
}

function FormUsuario({ planes, mensaje, onSuccess, onError }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    apellidos: '',
    celular: '',
    planId: '',
    funciones: [],
    pais: 'Bolivia',
    departamento: '',
    modalidad: 'online',
    tutorLegal: '',
    horasSaldo: '',
    clasesPorSemana: '',
    observaciones: '',
    cuotasTotales: '',
    montoTotal: '',
    montoEnganche: '',
    fechaPrimerVencimiento: '',
    pagoContado: false,
  });
  const [saving, setSaving] = useState(false);
  const cuotasNum = parseInt(form.cuotasTotales, 10) || 0;
  const montoNum = parseFloat(String(form.montoTotal).replace(',', '.'), 10);
  const engancheNum = parseFloat(String(form.montoEnganche || '').replace(',', '.'), 10);
  const engancheOk = Number.isFinite(engancheNum) && engancheNum >= 0 ? engancheNum : 0;
  const restoCuotas =
    Number.isFinite(montoNum) && montoNum > 0 ? Math.max(0, montoNum - engancheOk) : null;

  const horasSaldoNum =
    form.horasSaldo === '' || form.horasSaldo == null ? 0 : Math.max(0, parseInt(String(form.horasSaldo), 10) || 0);
  const clasesPorSemanaNum =
    form.clasesPorSemana !== '' && form.clasesPorSemana != null ? Math.max(1, parseInt(form.clasesPorSemana, 10) || 0) : 0;
  const fechaEstimadaFinAprox = (() => {
    if (!horasSaldoNum || !clasesPorSemanaNum) return null;
    const semanas = Math.ceil(horasSaldoNum / clasesPorSemanaNum);
    const d = new Date(Date.now() + semanas * 7 * 24 * 60 * 60 * 1000);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  })();

  const montoPorCuotaCalculado =
    cuotasNum > 0 && restoCuotas != null && restoCuotas > 0
      ? (restoCuotas / cuotasNum).toFixed(2)
      : null;
  const nombreValido = (v) => /^[\p{L}\s'-.]+$/u.test(String(v || '').trim());
  const celularValido = (v) => !v || /^[0-9+\s-]{7,20}$/.test(String(v).trim());

  const submit = (e) => {
    e.preventDefault();
    if (!String(form.email || '').trim() && !String(form.celular || '').trim()) {
      onError('Debes ingresar al menos email o celular.');
      return;
    }
    if (!nombreValido(form.nombre)) {
      onError('El nombre no puede contener números ni símbolos inválidos.');
      return;
    }
    if (!nombreValido(form.apellidos)) {
      onError('Los apellidos no pueden contener números ni símbolos inválidos.');
      return;
    }
    if (form.tutorLegal && !nombreValido(form.tutorLegal)) {
      onError('El tutor legal no puede contener números ni símbolos inválidos.');
      return;
    }
    if (!celularValido(form.celular)) {
      onError('El celular solo puede tener números y caracteres válidos (+, espacios, guiones).');
      return;
    }
    if (String(form.password || '').length < 6) {
      onError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (form.clasesPorSemana !== '' && (Number(form.clasesPorSemana) < 1 || Number(form.clasesPorSemana) > 10)) {
      onError('Días por semana debe estar entre 1 y 10.');
      return;
    }
    if (cuotasNum > 0 && !form.pagoContado && !String(form.fechaPrimerVencimiento || '').trim()) {
      onError('Indica la fecha del primer vencimiento de cuota (día acordado del primer pago).');
      return;
    }
    if (Number.isFinite(montoNum) && montoNum > 0 && engancheOk > montoNum) {
      onError('El enganche (inscripción) no puede ser mayor al monto total.');
      return;
    }
    setSaving(true);
    const body = trimFormStrings(
      {
        ...form,
        horasSaldo: horasSaldoNum,
        planId: form.planId || undefined,
        funciones: form.funciones.length ? form.funciones : undefined,
        clasesPorSemana:
          form.clasesPorSemana !== undefined && form.clasesPorSemana !== '' ? Math.max(1, parseInt(form.clasesPorSemana, 10) || 0) : undefined,
        cuotasTotales: form.cuotasTotales ? Math.max(0, parseInt(form.cuotasTotales, 10)) : undefined,
        montoTotal:
          form.montoTotal && !isNaN(parseFloat(String(form.montoTotal).replace(',', '.')))
            ? parseFloat(String(form.montoTotal).replace(',', '.'))
            : undefined,
        montoEnganche:
          form.montoEnganche !== '' && form.montoEnganche != null && !Number.isNaN(engancheOk)
            ? engancheOk
            : undefined,
        fechaPrimerVencimiento:
          cuotasNum > 0 && !form.pagoContado && String(form.fechaPrimerVencimiento || '').trim()
            ? String(form.fechaPrimerVencimiento).trim()
            : undefined,
      },
      ['email', 'nombre', 'apellidos', 'celular', 'tutorLegal', 'pais', 'departamento', 'observaciones']
    );
    fetch(apiUrl('/api/admin/usuarios'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then((r) => (r.ok ? onSuccess() : r.json()))
      .then((data) => data?.error && onError(data.error))
      .catch(() => onError('Error de conexión'))
      .finally(() => setSaving(false));
  };

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="anadir-form">
      <form onSubmit={submit}>
        <div className="anadir-section">
          <div className="anadir-section-title">Datos de acceso</div>
          <div className="anadir-form-grid">
            <div className="form-group">
              <label>Email (opcional si tienes celular)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                onBlur={(e) => update('email', e.target.value.trim())}
                placeholder="ejemplo@correo.com"
              />
            </div>
            <div className="form-group">
              <label>Contraseña *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
                placeholder="Mín. 6 caracteres"
              />
            </div>
          </div>
        </div>

        <div className="anadir-section">
          <div className="anadir-section-title">Datos personales</div>
          <div className="anadir-form-grid">
            <div className="form-group">
              <label>Nombre *</label>
              <input
                value={form.nombre}
                onChange={(e) => update('nombre', soloTextoNombre(e.target.value))}
                onBlur={(e) => update('nombre', soloTextoNombre(e.target.value.trim()))}
                inputMode="text"
                autoComplete="given-name"
                required
              />
            </div>
            <div className="form-group">
              <label>Apellidos *</label>
              <input
                value={form.apellidos}
                onChange={(e) => update('apellidos', soloTextoNombre(e.target.value))}
                onBlur={(e) => update('apellidos', soloTextoNombre(e.target.value.trim()))}
                inputMode="text"
                autoComplete="family-name"
                required
              />
            </div>
            <div className="form-group">
              <label>Celular</label>
              <input
                value={form.celular}
                onChange={(e) => update('celular', soloCelular(e.target.value))}
                onBlur={(e) => update('celular', soloCelular(e.target.value.trim()))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="Opcional"
              />
            </div>
            <div className="form-group">
              <label>Tutor legal</label>
              <input
                value={form.tutorLegal}
                onChange={(e) => update('tutorLegal', soloTextoNombre(e.target.value))}
                onBlur={(e) => update('tutorLegal', soloTextoNombre(e.target.value.trim()))}
                inputMode="text"
                placeholder="Opcional"
              />
            </div>
          </div>
        </div>

        <div className="anadir-section">
          <div className="anadir-section-title">Planes y ubicación</div>
          <div className="anadir-form-grid">
            <div className="form-group full-width">
              <label>Planes (materias)</label>
              <div className="anadir-checkgroup" style={{ marginTop: '0.35rem' }}>
                {FUNCIONES_OPCIONES.map((f) => (
                  <label key={f.id}>
                    <input
                      type="checkbox"
                      checked={form.funciones.includes(f.id)}
                      onChange={(e) =>
                        update(
                          'funciones',
                          e.target.checked ? [...form.funciones, f.id] : form.funciones.filter((id) => id !== f.id)
                        )
                      }
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Plan (paquete)</label>
              <select value={form.planId} onChange={(e) => update('planId', e.target.value)}>
                <option value="">Sin plan</option>
                {planes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>País</label>
              <input
                value={form.pais}
                onChange={(e) => update('pais', e.target.value)}
                onBlur={(e) => update('pais', e.target.value.trim())}
              />
            </div>
            <div className="form-group">
              <label>Departamento</label>
              <input
                value={form.departamento}
                onChange={(e) => update('departamento', e.target.value)}
                onBlur={(e) => update('departamento', e.target.value.trim())}
                placeholder="Opcional"
              />
            </div>
            <div className="form-group">
              <label>Modalidad</label>
              <select value={form.modalidad} onChange={(e) => update('modalidad', e.target.value)}>
                <option value="presencial">Presencial</option>
                <option value="online">Virtual</option>
                <option value="ambos">Presencial y virtual (ambos)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="anadir-section">
          <div className="anadir-section-title">Horas y pagos</div>
          <div className="anadir-form-grid">
            <div className="form-group">
              <label>Horas saldo</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={form.horasSaldo}
                onChange={(e) => update('horasSaldo', normalizeEnteroHorasSaldo(e.target.value))}
                placeholder="Ej. 32"
              />
            </div>
                <div className="form-group">
                  <label>Días por semana (clases) para fecha estimada</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.clasesPorSemana}
                    onChange={(e) => update('clasesPorSemana', e.target.value)}
                    placeholder="Ej. 2"
                  />
                  {fechaEstimadaFinAprox && (
                    <div className="anadir-calc" style={{ marginTop: '0.35rem' }}>
                      Fecha estimada fin (aprox.): <strong>{fechaEstimadaFinAprox}</strong>
                    </div>
                  )}
                </div>
            <div className="form-group">
              <label>Cuotas totales</label>
              <input
                type="number"
                min={0}
                value={form.cuotasTotales}
                onChange={(e) => update('cuotasTotales', e.target.value)}
                placeholder="Ej. 12"
              />
            </div>
            <div className="form-group">
              <label>Monto total (contrato)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.montoTotal}
                onChange={(e) => update('montoTotal', e.target.value)}
                placeholder="Ej. 3000"
              />
            </div>
            <div className="form-group">
              <label>Enganche / inscripción</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.montoEnganche}
                onChange={(e) => update('montoEnganche', e.target.value)}
                placeholder="0 — se resta del total"
              />
              <div className="anadir-calc" style={{ marginTop: '0.35rem' }}>
                Pago inicial al inscribirse; el <strong>resto</strong> se divide en las cuotas mensuales.
              </div>
            </div>
            {restoCuotas != null && Number.isFinite(montoNum) && montoNum > 0 && (
              <div className="form-group full-width">
                <div className="anadir-calc">
                  Resto a financiar en cuotas:{' '}
                  <strong>{restoCuotas.toFixed(2)}</strong>
                  {cuotasNum > 0 && montoPorCuotaCalculado != null && (
                    <>
                      {' '}
                      → Monto por cuota: <strong>{montoPorCuotaCalculado}</strong>
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="check-left">
                <input
                  type="checkbox"
                  checked={form.pagoContado}
                  onChange={(e) => update('pagoContado', e.target.checked)}
                />
                Pago al contado
              </label>
            </div>
            <div className="form-group full-width">
              <label>
                Fecha del primer vencimiento
                {cuotasNum > 0 && !form.pagoContado ? ' *' : ''}
              </label>
              <input
                type="date"
                value={form.fechaPrimerVencimiento}
                onChange={(e) => update('fechaPrimerVencimiento', e.target.value)}
                disabled={form.pagoContado}
                required={cuotasNum > 0 && !form.pagoContado}
              />
              <div className="anadir-calc" style={{ marginTop: '0.35rem' }}>
                {form.pagoContado ? (
                  <>No aplica con pago al contado.</>
                ) : cuotasNum <= 0 ? (
                  <>Indica <strong>cuotas totales</strong> (mayor que 0) para que esta fecha sea obligatoria: es el día acordado del primer pago; cada cuota siguiente vence un mes después.</>
                ) : (
                  <>Día acordado del primer pago; cada cuota siguiente vence un mes después (Bolivia).</>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="anadir-section">
          <div className="anadir-section-title">Observaciones</div>
          <div className="form-group">
            <label>Notas internas</label>
            <textarea
              value={form.observaciones}
              onChange={(e) => update('observaciones', e.target.value)}
              onBlur={(e) => update('observaciones', e.target.value.trim())}
              placeholder="Opcional"
              rows={2}
            />
          </div>
        </div>

        <div className="anadir-form-actions">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Creando...' : 'Crear alumno'}
          </button>
        </div>
        {mensaje ? (
          <div className={`anadir-mensaje anadir-mensaje--below ${esExitoAlta(mensaje) ? 'success' : 'error'}`}>
            {esExitoAlta(mensaje) ? '✓' : '✕'} {mensaje}
          </div>
        ) : null}
      </form>
    </div>
  );
}

function FormAsesora({ planes, mensaje, onSuccess, onError }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    apellidos: '',
    celular: '',
    planIds: [],
    funciones: [],
  });
  const [saving, setSaving] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!String(form.email || '').trim() && !String(form.celular || '').trim()) {
      onError('Debes ingresar al menos email o celular.');
      return;
    }
    setSaving(true);
    const bodyAsesora = trimFormStrings(
      { ...form, funciones: form.funciones.length ? form.funciones : undefined },
      ['email', 'nombre', 'apellidos', 'celular']
    );
    fetch(apiUrl('/api/admin/asesoras'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(bodyAsesora),
    })
      .then((r) => (r.ok ? onSuccess() : r.json()))
      .then((data) => data?.error && onError(data.error))
      .catch(() => onError('Error de conexión'))
      .finally(() => setSaving(false));
  };

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="anadir-form">
      <form onSubmit={submit}>
        <div className="anadir-section">
          <div className="anadir-section-title">Datos de acceso</div>
          <div className="anadir-form-grid">
            <div className="form-group">
              <label>Email (opcional si tienes celular)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                onBlur={(e) => update('email', e.target.value.trim())}
                placeholder="ejemplo@correo.com"
              />
            </div>
            <div className="form-group">
              <label>Contraseña *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
                placeholder="Mín. 6 caracteres"
              />
            </div>
          </div>
        </div>

        <div className="anadir-section">
          <div className="anadir-section-title">Datos personales</div>
          <div className="anadir-form-grid">
            <div className="form-group">
              <label>Nombre *</label>
              <input
                value={form.nombre}
                onChange={(e) => update('nombre', soloTextoNombre(e.target.value))}
                onBlur={(e) => update('nombre', soloTextoNombre(e.target.value.trim()))}
                inputMode="text"
                required
              />
            </div>
            <div className="form-group">
              <label>Apellidos *</label>
              <input
                value={form.apellidos}
                onChange={(e) => update('apellidos', soloTextoNombre(e.target.value))}
                onBlur={(e) => update('apellidos', soloTextoNombre(e.target.value.trim()))}
                inputMode="text"
                required
              />
            </div>
            <div className="form-group full-width">
              <label>Celular</label>
              <input
                value={form.celular}
                onChange={(e) => update('celular', soloCelular(e.target.value))}
                onBlur={(e) => update('celular', soloCelular(e.target.value.trim()))}
                inputMode="tel"
                placeholder="Opcional"
              />
            </div>
          </div>
        </div>

        <div className="anadir-section">
          <div className="anadir-section-title">Planes que imparte</div>
          <div className="form-group">
            <label>Materias / funciones</label>
            <div className="anadir-checkgroup" style={{ marginTop: '0.35rem' }}>
              {FUNCIONES_OPCIONES.map((f) => (
                <label key={f.id}>
                  <input
                    type="checkbox"
                    checked={form.funciones.includes(f.id)}
                    onChange={(e) =>
                      update(
                        'funciones',
                        e.target.checked ? [...form.funciones, f.id] : form.funciones.filter((id) => id !== f.id)
                      )
                    }
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="anadir-section">
          <div className="anadir-section-title">Planes asignados (paquetes)</div>
          <div className="form-group">
            <label>Selecciona los planes que puede dar</label>
            <div className="anadir-checkgroup" style={{ marginTop: '0.35rem' }}>
              {planes.map((p) => (
                <label key={p.id}>
                  <input
                    type="checkbox"
                    checked={form.planIds.includes(p.id)}
                    onChange={(e) =>
                      update(
                        'planIds',
                        e.target.checked ? [...form.planIds, p.id] : form.planIds.filter((id) => id !== p.id)
                      )
                    }
                  />
                  <span>{p.nombre}</span>
                </label>
              ))}
            </div>
            {planes.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>No hay planes creados.</p>}
          </div>
        </div>

        <div className="anadir-form-actions">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Creando...' : 'Crear asesora'}
          </button>
        </div>
        {mensaje ? (
          <div className={`anadir-mensaje anadir-mensaje--below ${esExitoAlta(mensaje) ? 'success' : 'error'}`}>
            {esExitoAlta(mensaje) ? '✓' : '✕'} {mensaje}
          </div>
        ) : null}
      </form>
    </div>
  );
}
