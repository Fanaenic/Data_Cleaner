import React from 'react';
import { Role } from '../types';

interface ProtectedRouteProps {
  role: Role;
  allowedRoles: Role[];
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ role, allowedRoles, children }) => {
  if (!allowedRoles.includes(role)) return null;
  return <>{children}</>;
};

export default ProtectedRoute;
