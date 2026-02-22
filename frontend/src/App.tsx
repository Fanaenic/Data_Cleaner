// src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import MainApp from './components/MainApp';
import PrivateRoute from './components/PrivateRoute';
import ProtectedRoute from './components/ProtectedRoute';
import api from './api';
import { UserData } from './types';
import './App.css';

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await api.get<{
          name: string;
          email: string;
          id?: number;
          role: string;
          upload_count?: number;
        }>('/profile');
        setUser({
          token,
          user: {
            name: response.data.name,
            email: response.data.email,
            id: response.data.id,
            role: response.data.role as import('./types').Role,
            upload_count: response.data.upload_count ?? 0,
          },
        });
      } catch {
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogin = (userData: UserData): void => {
    localStorage.setItem('token', userData.token);
    setUser(userData);
  };

  const handleLogout = (): void => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">⏳</div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Публичный маршрут — недоступен авторизованным */}
        <Route
          path="/login"
          element={user ? <Navigate to="/upload" replace /> : <Auth onLogin={handleLogin} />}
        />

        {/* Приватные маршруты — только для авторизованных */}
        <Route
          path="/upload"
          element={
            <PrivateRoute user={user}>
              <MainApp user={user!} onLogout={handleLogout} />
            </PrivateRoute>
          }
        />
        <Route
          path="/history"
          element={
            <PrivateRoute user={user}>
              <MainApp user={user!} onLogout={handleLogout} />
            </PrivateRoute>
          }
        />

        {/* Ролевой маршрут — только для admin */}
        <Route
          path="/admin"
          element={
            <PrivateRoute user={user}>
              <ProtectedRoute
                role={user?.user.role ?? 'guest'}
                allowedRoles={['admin']}
              >
                <MainApp user={user!} onLogout={handleLogout} />
              </ProtectedRoute>
            </PrivateRoute>
          }
        />

        {/* Редиректы */}
        <Route path="/" element={<Navigate to={user ? '/upload' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={user ? '/upload' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
