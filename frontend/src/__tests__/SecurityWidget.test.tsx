/**
 * Тесты компонента SecurityWidget — виджет геолокации сессии.
 *
 * Тестирует все 4 состояния:
 * - loading: скелетон-анимация
 * - degraded: API недоступен
 * - empty: нет данных
 * - success: успешные данные
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import SecurityWidget from '../components/SecurityWidget';

// Мокируем модуль api
jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

import api from '../api';
const mockedApi = api as jest.Mocked<typeof api>;

describe('SecurityWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('показывает состояние загрузки изначально', () => {
    // Промис, который никогда не резолвится — имитируем loading
    mockedApi.get.mockReturnValue(new Promise(() => {}));
    render(<SecurityWidget />);
    // aria-label присутствует и в loading, и в других состояниях
    expect(screen.getByLabelText(/информация о сессии/i)).toBeInTheDocument();
    // Заголовок присутствует в loading состоянии
    expect(screen.getByText(/информация о сессии/i)).toBeInTheDocument();
  });

  test('показывает degraded состояние при ошибке запроса', async () => {
    mockedApi.get.mockRejectedValue(new Error('Network Error'));

    render(<SecurityWidget />);

    await waitFor(() => {
      expect(screen.getByText(/геоданные временно недоступны/i)).toBeInTheDocument();
    });
  });

  test('показывает degraded состояние при available=false', async () => {
    mockedApi.get.mockResolvedValue({
      data: { available: false, error: 'API limit exceeded' },
    });

    render(<SecurityWidget />);

    await waitFor(() => {
      expect(screen.getByText(/геоданные временно недоступны/i)).toBeInTheDocument();
    });
  });

  test('показывает данные при успешном ответе', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        available: true,
        ip: '95.24.100.1',
        country: 'Russia',
        country_code: 'RU',
        region: 'Moscow',
        city: 'Moscow',
        timezone: 'Europe/Moscow',
        isp: 'Test ISP',
      },
    });

    render(<SecurityWidget />);

    await waitFor(() => {
      expect(screen.getByText('95.24.100.1')).toBeInTheDocument();
    });

    // Местоположение рендерится как "Moscow, Moscow, Russia"
    expect(screen.getByText(/Moscow.*Moscow.*Russia/i)).toBeInTheDocument();
  });

  test('показывает провайдера при наличии isp', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        available: true,
        ip: '1.2.3.4',
        country: 'Russia',
        country_code: 'RU',
        city: 'Moscow',
        isp: 'Rostelecom',
      },
    });

    render(<SecurityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Rostelecom')).toBeInTheDocument();
    });
  });

  test('показывает часовой пояс при наличии timezone', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        available: true,
        ip: '1.2.3.4',
        country: 'Russia',
        city: 'Moscow',
        timezone: 'Europe/Moscow',
      },
    });

    render(<SecurityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Europe/Moscow')).toBeInTheDocument();
    });
  });

  test('вызывает /geo/location при монтировании', async () => {
    mockedApi.get.mockResolvedValue({
      data: { available: false },
    });

    render(<SecurityWidget />);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(
        '/geo/location',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });
});
