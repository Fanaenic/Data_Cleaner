import React from 'react';
import { Navigate } from 'react-router-dom';
import { UserData } from '../types';

interface PrivateRouteProps {
  user: UserData | null;
  children: React.ReactNode;
}

/**
 * Приватный маршрут — перенаправляет неавторизованных пользователей на /login.
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({ user, children }) => {
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default PrivateRoute;
