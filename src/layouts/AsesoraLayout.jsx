import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AsesoraLayout() {
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
            <NavLink to="/asesora/horarios" end>Horarios</NavLink>
            <NavLink to="/asesora/editar">Editar</NavLink>
            <NavLink to="/asesora/perfil">Editar perfil</NavLink>
            <NavLink to="/asesora/alumnos">Administrar alumnos</NavLink>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#6b7280' }}>Asesora</span>
          <button type="button" className="btn danger" onClick={handleLogout}>Salir</button>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
