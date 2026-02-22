import React from 'react';
import { Navigate } from 'react-router-dom';
import { Role } from '../types';

interface ProtectedRouteProps {
  role: Role;
  allowedRoles: Role[];
  children: React.ReactNode;
}

/**
 * Ролевой маршрут — перенаправляет пользователей без нужной роли на /upload.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ role, allowedRoles, children }) => {
  if (!allowedRoles.includes(role)) return <Navigate to="/upload" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
