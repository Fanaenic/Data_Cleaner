/**
 * Тесты компонента NotFound — страница 404.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '../components/NotFound';

// Мокируем SEOHead чтобы не трогать document.head в тестах
jest.mock('../components/SEOHead', () => () => null);

describe('NotFound', () => {
  const renderNotFound = () =>
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );

  test('отображает код 404', () => {
    renderNotFound();
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  test('отображает заголовок страницы не найдена', () => {
    renderNotFound();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Страница не найдена'
    );
  });

  test('отображает описательный текст', () => {
    renderNotFound();
    expect(screen.getByText(/не существует/i)).toBeInTheDocument();
  });

  test('содержит ссылку на главную страницу', () => {
    renderNotFound();
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  test('ссылка содержит текст возврата', () => {
    renderNotFound();
    const link = screen.getByRole('link');
    expect(link.textContent).toMatch(/главную/i);
  });

  test('содержит семантический тег main', () => {
    renderNotFound();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
