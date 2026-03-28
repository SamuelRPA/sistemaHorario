import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trimStr } from '../utils/inputFilters';

function maskEmail(email) {
  const e = String(email || '');
  const at = e.indexOf('@');
  if (at < 1) return 'tu correo';
  const user = e.slice(0, at);
  const domain = e.slice(at);
  return `${user.slice(0, 2)}•••${domain}`;
}

const RECOVERY_STEPS = [
  { id: 'email', label: 'Correo' },
  { id: 'code', label: 'Código' },
  { id: 'password', label: 'Nueva clave' },
];

export default function Login() {
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /** null = pantalla login; si no null, flujo recuperación */
  const [recoverySub, setRecoverySub] = useState(null);
  const [recuperarEmail, setRecuperarEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const [loadingRec, setLoadingRec] = useState(false);

  const { login, refresh } = useAuth();
  const navigate = useNavigate();

  const codigoCompleto = otp.join('');

  const resetRecovery = () => {
    setRecoverySub(null);
    setRecuperarEmail('');
    setOtp(['', '', '', '', '', '']);
    setNuevaPassword('');
    setConfirmarPassword('');
    setMsg('');
    setMsgOk(false);
  };

  const goRecoveryEmail = () => {
    setRecoverySub('email');
    setMsg('');
    setMsgOk(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(trimStr(identificador), password);
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      await refresh();
      if (data.rol === 'usuario') navigate('/usuario');
      else if (data.rol === 'asesora') navigate('/asesora');
      else if (data.rol === 'administrador') navigate('/admin');
      else navigate('/');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarCodigo = async (e) => {
    e.preventDefault();
    const email = trimStr(recuperarEmail);
    if (!email) {
      setMsg('Indica tu correo.');
      setMsgOk(false);
      return;
    }
    setMsg('');
    setLoadingRec(true);
    try {
      const res = await fetch('/api/auth/recuperar-password/enviar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el código');
      setOtp(['', '', '', '', '', '']);
      setRecoverySub('code');
      setMsg('Revisa tu bandeja y escribe el código de 6 dígitos.');
      setMsgOk(true);
    } catch (err) {
      setMsg(err.message || 'No se pudo enviar el código');
      setMsgOk(false);
    } finally {
      setLoadingRec(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const arr = Array.from({ length: 6 }, (_, i) => text[i] || '');
    setOtp(arr);
    const focusIdx = Math.min(text.length, 5);
    setTimeout(() => otpRefs.current[focusIdx]?.focus(), 0);
  };

  const handleVerificarCodigo = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setMsg('Escribe los 6 dígitos del correo.');
      setMsgOk(false);
      return;
    }
    setMsg('');
    setLoadingRec(true);
    try {
      const res = await fetch('/api/auth/recuperar-password/verificar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: trimStr(recuperarEmail), codigo: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Código incorrecto');
      setRecoverySub('password');
      setMsg('');
      setMsgOk(false);
    } catch (err) {
      setMsg(err.message || 'Código incorrecto o vencido');
      setMsgOk(false);
    } finally {
      setLoadingRec(false);
    }
  };

  const handleConfirmarNuevaPassword = async (e) => {
    e.preventDefault();
    if (nuevaPassword !== confirmarPassword) {
      setMsg('Las contraseñas no coinciden.');
      setMsgOk(false);
      return;
    }
    if (nuevaPassword.length < 6) {
      setMsg('La contraseña debe tener al menos 6 caracteres.');
      setMsgOk(false);
      return;
    }
    setMsg('');
    setLoadingRec(true);
    try {
      const res = await fetch('/api/auth/recuperar-password/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: trimStr(recuperarEmail),
          codigo: codigoCompleto,
          nuevaPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar la contraseña');
      setRecoverySub('success');
      setMsg('');
      setMsgOk(true);
      setPassword('');
    } catch (err) {
      setMsg(err.message || 'No se pudo actualizar la contraseña');
      setMsgOk(false);
    } finally {
      setLoadingRec(false);
    }
  };

  const recoveryStepIndex = recoverySub === 'email' ? 0 : recoverySub === 'code' ? 1 : recoverySub === 'password' ? 2 : recoverySub === 'success' ? 3 : -1;

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-brand">
          <img src="/logos/logo1.jpg" alt="Tk&Te Bolivia" />
        </div>

        {!recoverySub && (
          <>
            <h1 className="login-title">Bienvenido a TK&TE</h1>
            <p className="login-subtitle">Inicia sesión con tu cuenta</p>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Email o celular</label>
                <input
                  type="text"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  onBlur={(e) => setIdentificador(e.target.value.trim())}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && <p className="login-msg login-msg--error">{error}</p>}
              <button type="submit" className="btn" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
            <div className="login-recovery-link-wrap">
              <button type="button" className="login-link-btn" onClick={goRecoveryEmail}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </>
        )}

        {recoverySub && recoverySub !== 'success' && (
          <div className="recovery-flow">
            <button type="button" className="recovery-back" onClick={() => (recoverySub === 'email' ? resetRecovery() : setRecoverySub(recoverySub === 'code' ? 'email' : 'code'))}>
              ← {recoverySub === 'email' ? 'Volver al inicio de sesión' : 'Atrás'}
            </button>
            <h1 className="login-title recovery-title">Recuperar contraseña</h1>
            <p className="login-subtitle recovery-subtitle">Paso a paso, de forma segura</p>

            <div className="recovery-steps" aria-hidden="true">
              {RECOVERY_STEPS.map((s, i) => (
                <div
                  key={s.id}
                  className={`recovery-step ${i <= recoveryStepIndex ? 'recovery-step--active' : ''} ${i < recoveryStepIndex ? 'recovery-step--done' : ''}`}
                >
                  <span className="recovery-step-num">{i + 1}</span>
                  <span className="recovery-step-label">{s.label}</span>
                </div>
              ))}
            </div>

            {recoverySub === 'email' && (
              <form onSubmit={handleEnviarCodigo} className="recovery-form">
                <div className="form-group">
                  <label>Correo Gmail registrado</label>
                  <input
                    type="email"
                    value={recuperarEmail}
                    onChange={(e) => setRecuperarEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="tu@correo.com"
                  />
                </div>
                <p className="recovery-hint">Te enviaremos un código de 6 dígitos. Revisa también spam.</p>
                {msg && <p className={`login-msg ${msgOk ? 'login-msg--ok' : 'login-msg--error'}`}>{msg}</p>}
                <button type="submit" className="btn" disabled={loadingRec} style={{ width: '100%' }}>
                  {loadingRec ? 'Enviando…' : 'Continuar'}
                </button>
              </form>
            )}

            {recoverySub === 'code' && (
              <form onSubmit={handleVerificarCodigo} className="recovery-form">
                <p className="recovery-email-mask">
                  Código enviado a <strong>{maskEmail(recuperarEmail)}</strong>
                </p>
                <label className="otp-label">Código de 6 dígitos</label>
                <div className="otp-row" onPaste={handleOtpPaste}>
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className="otp-digit"
                      value={d}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoComplete="one-time-code"
                      aria-label={`Dígito ${i + 1}`}
                    />
                  ))}
                </div>
                {msg && <p className={`login-msg ${msgOk ? 'login-msg--ok' : 'login-msg--error'}`}>{msg}</p>}
                <button type="submit" className="btn" disabled={loadingRec} style={{ width: '100%' }}>
                  {loadingRec ? 'Comprobando…' : 'Continuar'}
                </button>
              </form>
            )}

            {recoverySub === 'password' && (
              <form onSubmit={handleConfirmarNuevaPassword} className="recovery-form">
                <div className="form-group">
                  <label>Nueva contraseña</label>
                  <input
                    type="password"
                    value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    minLength={6}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label>Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirmarPassword}
                    onChange={(e) => setConfirmarPassword(e.target.value)}
                    minLength={6}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {msg && <p className={`login-msg ${msgOk ? 'login-msg--ok' : 'login-msg--error'}`}>{msg}</p>}
                <button type="submit" className="btn" disabled={loadingRec} style={{ width: '100%' }}>
                  {loadingRec ? 'Guardando…' : 'Guardar y continuar'}
                </button>
              </form>
            )}
          </div>
        )}

        {recoverySub === 'success' && (
          <div className="recovery-success">
            <div className="recovery-success-icon" aria-hidden="true">✓</div>
            <h1 className="login-title">Contraseña actualizada</h1>
            <p className="login-subtitle recovery-success-text">
              Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
            <button
              type="button"
              className="btn"
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={() => {
                resetRecovery();
              }}
            >
              Ir al inicio de sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
