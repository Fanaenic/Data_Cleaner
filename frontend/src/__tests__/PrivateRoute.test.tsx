/**
 * Тесты компонента PrivateRoute — защита приватных маршрутов.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from '../components/PrivateRoute';
import { UserData } from '../types';

const mockUser: UserData = {
  token: 'test-access-token',
  refreshToken: 'test-refresh-token',
  user: {
    id: 1,
    name: 'Test User',
    email: 'test@test.local',
    role: 'free_user',
    upload_count: 0,
  },
};

const renderWithRouter = (user: UserData | null, initialPath = '/protected') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <PrivateRoute user={user}>
              <div data-testid="protected-content">Защищённый контент</div>
            </PrivateRoute>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">Страница входа</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('PrivateRoute', () => {
  test('перенаправляет на /login если пользователь не авторизован', () => {
    renderWithRouter(null);
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  test('отображает дочерний компонент для авторизованного пользователя', () => {
    renderWithRouter(mockUser);
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  test('отображает контент для admin пользователя', () => {
    const adminUser: UserData = {
      ...mockUser,
      user: { ...mockUser.user, role: 'admin' },
    };
    renderWithRouter(adminUser);
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
