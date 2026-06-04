/**
 * Тесты компонента ProtectedRoute — ролевая защита маршрутов.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { Role } from '../types';

const renderWithRouter = (role: Role, allowedRoles: Role[]) =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute role={role} allowedRoles={allowedRoles}>
              <div data-testid="admin-content">Панель администратора</div>
            </ProtectedRoute>
          }
        />
        <Route path="/upload" element={<div data-testid="upload-page">Загрузка</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  test('отображает контент для разрешённой роли admin', () => {
    renderWithRouter('admin', ['admin']);
    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
  });

  test('перенаправляет free_user с admin-маршрута', () => {
    renderWithRouter('free_user', ['admin']);
    expect(screen.getByTestId('upload-page')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  test('перенаправляет pro_user если не в allowedRoles', () => {
    renderWithRouter('pro_user', ['admin']);
    expect(screen.getByTestId('upload-page')).toBeInTheDocument();
  });

  test('отображает контент если несколько ролей разрешено', () => {
    renderWithRouter('pro_user', ['admin', 'pro_user']);
    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
  });

  test('перенаправляет guest пользователя', () => {
    renderWithRouter('guest', ['admin', 'pro_user', 'free_user']);
    expect(screen.getByTestId('upload-page')).toBeInTheDocument();
  });
});
