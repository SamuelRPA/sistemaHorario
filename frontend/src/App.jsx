import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import CambiarPasswordInicial from './pages/CambiarPasswordInicial';
import UsuarioLayout from './layouts/UsuarioLayout';
import AsesoraLayout from './layouts/AsesoraLayout';
import AdminLayout from './layouts/AdminLayout';
import UsuarioHorario from './pages/usuario/UsuarioHorario';
import UsuarioHorariosDisponibles from './pages/usuario/UsuarioHorariosDisponibles';
import UsuarioMiInformacion from './pages/usuario/UsuarioMiInformacion';
import UsuarioPerfil from './pages/usuario/UsuarioPerfil';
import AsesoraHorarios from './pages/asesora/AsesoraHorarios';
import AsesoraEditar from './pages/asesora/AsesoraEditar';
import AsesoraPerfil from './pages/asesora/AsesoraPerfil';
import AsesoraAlumnos from './pages/asesora/AsesoraAlumnos';
import AdminHorarios from './pages/admin/AdminHorarios';
import AdminAlumnos from './pages/admin/AdminAlumnos';
import AdminAsesoras from './pages/admin/AdminAsesoras';
import AdminEstadisticas from './pages/admin/AdminEstadisticas';
import AdminAnadir from './pages/admin/AdminAnadir';
import AdminCuotas from './pages/admin/AdminCuotas';
import AdminPerfil from './pages/admin/AdminPerfil';

function PrivateRoute({ children, roles, allowMustChange = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && !allowMustChange) return <Navigate to="/cambiar-password" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cambiar-password" element={<PrivateRoute roles={['usuario', 'asesora']} allowMustChange><CambiarPasswordInicial /></PrivateRoute>} />
      <Route path="/usuario" element={<PrivateRoute roles={['usuario']}><UsuarioLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="horario" replace />} />
        <Route path="horario" element={<UsuarioHorario />} />
        <Route path="horarios-disponibles" element={<UsuarioHorariosDisponibles />} />
        <Route path="mi-informacion" element={<UsuarioMiInformacion />} />
        <Route path="perfil" element={<UsuarioPerfil />} />
      </Route>
      <Route path="/asesora" element={<PrivateRoute roles={['asesora']}><AsesoraLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="horarios" replace />} />
        <Route path="horarios" element={<AsesoraHorarios />} />
        <Route path="editar" element={<AsesoraEditar />} />
        <Route path="perfil" element={<AsesoraPerfil />} />
        <Route path="alumnos" element={<AsesoraAlumnos />} />
      </Route>
      <Route path="/admin" element={<PrivateRoute roles={['administrador']}><AdminLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="horarios" replace />} />
        <Route path="horarios" element={<AdminHorarios />} />
        <Route path="alumnos" element={<AdminAlumnos />} />
        <Route path="asesoras" element={<AdminAsesoras />} />
        <Route path="estadisticas" element={<AdminEstadisticas />} />
        <Route path="cuotas" element={<AdminCuotas />} />
        <Route path="anadir" element={<AdminAnadir />} />
        <Route path="perfil" element={<AdminPerfil />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
