import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const { logout, user } = useAuth();
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
            <NavLink to="/admin/horarios" end>Horarios</NavLink>
            <NavLink to="/admin/alumnos">Alumnos</NavLink>
            <NavLink to="/admin/asesoras">Asesoras</NavLink>
            <NavLink to="/admin/estadisticas">Estadísticas</NavLink>
            <NavLink to="/admin/cuotas">Cuotas</NavLink>
            <NavLink to="/admin/anadir">Añadir</NavLink>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#6b7280', textAlign: 'right' }}>
            <span style={{ display: 'block', fontWeight: 600, color: '#374151' }}>Administración</span>
            {user?.email ? (
              <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 400 }}>{user.email}</span>
            ) : null}
          </span>
          <button type="button" className="btn danger" onClick={handleLogout}>Salir</button>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
