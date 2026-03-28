import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CambiarPasswordInicial() {
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setMensaje('');
    if (nuevaPassword.length < 6) {
      setMensaje('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmar) {
      setMensaje('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/cambiar-password-inicial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nuevaPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo cambiar la contraseña');
      const me = await refresh();
      if ((me?.rol || user?.rol) === 'usuario') navigate('/usuario');
      else if ((me?.rol || user?.rol) === 'asesora') navigate('/asesora');
      else navigate('/admin');
    } catch (err) {
      setMensaje(err.message || 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h2 style={{ marginTop: 0 }}>Cambia tu contraseña</h2>
        <p className="login-subtitle">Es obligatorio cambiar la contraseña en tu primer ingreso.</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Nueva contraseña</label>
            <input type="password" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} minLength={6} required />
          </div>
          <div className="form-group">
            <label>Confirmar contraseña</label>
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} minLength={6} required />
          </div>
          {mensaje && <p style={{ color: 'var(--danger-red)' }}>{mensaje}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
