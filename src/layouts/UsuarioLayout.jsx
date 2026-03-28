import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function UsuarioLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <div className="menu" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src="/logos/logo1.jpg"
            alt="Tk&Te"
            style={{ width: 48, height: 48, objectFit: 'contain' }}
          />
          <nav style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <NavLink to="/usuario/horario" end>Horario</NavLink>
            <NavLink to="/usuario/horarios-disponibles">Horas disponibles</NavLink>
            <NavLink to="/usuario/mi-informacion">Mi información</NavLink>
            <NavLink to="/usuario/perfil">Editar perfil</NavLink>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#6b7280' }}>Usuario</span>
          <button type="button" className="btn danger" onClick={handleLogout}>Salir</button>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
