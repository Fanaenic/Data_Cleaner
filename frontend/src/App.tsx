// src/App.tsx
/**
 * SEO-доработки (Лаб. 4):
 *   - Маршруты /upload, /history, /admin — noindex (закрытые, задание 1.2)
 *   - /login — индексируемая публичная страница (задание 1.1)
 *   - Страница 404 (NotFound) вместо редиректа на неизвестных путях (задание 3.3)
 *   - Canonical и мета-теги управляются через SEOHead внутри каждого компонента
 */
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import MainApp from './components/MainApp';
import PrivateRoute from './components/PrivateRoute';
import ProtectedRoute from './components/ProtectedRoute';
import NotFound from './components/NotFound';
import api from './api';
import { UserData } from './types';
import './App.css';

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    if (!token || !refreshToken) {
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
        }>('/auth/me');
        setUser({
          token,
          refreshToken,
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
        localStorage.removeItem('refreshToken');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogin = (userData: UserData): void => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('refreshToken', userData.refreshToken);
    setUser(userData);
  };

  const handleLogout = (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-container" role="status" aria-label="Загрузка приложения">
        <div className="loading-spinner" aria-hidden="true">⏳</div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Публичный маршрут — индексируется поисковиками (задание 1.1) ── */}
        <Route
          path="/login"
          element={user ? <Navigate to="/upload" replace /> : <Auth onLogin={handleLogin} />}
        />

        {/* ── Приватные маршруты — noindex через SEOHead (задание 1.2) ──── */}
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

        {/* ── Ролевой маршрут — только для admin, noindex ──────────────── */}
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

        {/* ── Редирект с корня ─────────────────────────────────────────── */}
        <Route path="/" element={<Navigate to={user ? '/upload' : '/login'} replace />} />

        {/* ── 404 — показываем страницу ошибки (задание 3.3) ───────────── */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
