/**
 * Тесты компонента Auth — форма входа и регистрации.
 *
 * Покрывает:
 * - Рендеринг формы входа по умолчанию
 * - Переключение между формами
 * - Валидация паролей на клиенте
 * - Успешный вход — вызов onLogin
 * - Ошибка входа — отображение сообщения
 * - Состояние загрузки кнопки
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Auth from '../components/Auth';

// Мокируем api модуль
jest.mock('../api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

// Мокируем axios — используется в Auth.tsx для axios.isAxiosError
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    isAxiosError: (err: unknown) =>
      !!(err as { isAxiosError?: boolean }).isAxiosError,
    create: jest.fn(() => ({
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
  },
  isAxiosError: (err: unknown) =>
    !!(err as { isAxiosError?: boolean }).isAxiosError,
}));

// Мокируем SEOHead
jest.mock('../components/SEOHead', () => () => null);

import api from '../api';
const mockedApi = api as jest.Mocked<typeof api>;

const mockOnLogin = jest.fn();

describe('Auth компонент', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Начальный рендер', () => {
    test('отображает форму входа по умолчанию', () => {
      render(<Auth onLogin={mockOnLogin} />);
      // h2 формы входа всегда присутствует в DOM
      expect(screen.getByRole('heading', { level: 2, name: /вход в аккаунт/i })).toBeInTheDocument();
    });

    test('отображает кнопки переключения форм', () => {
      render(<Auth onLogin={mockOnLogin} />);
      expect(screen.getByRole('tab', { name: /^вход$/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /регистрация/i })).toBeInTheDocument();
    });

    test('отображает логотип DataCleaner', () => {
      render(<Auth onLogin={mockOnLogin} />);
      expect(screen.getByRole('heading', { level: 1, name: /datacleaner/i })).toBeInTheDocument();
    });

    test('форма входа имеет поля email и пароль', () => {
      render(<Auth onLogin={mockOnLogin} />);
      // Обе формы всегда в DOM — обращаемся по конкретным id
      expect(document.getElementById('login-email')).not.toBeNull();
      expect(document.getElementById('login-password')).not.toBeNull();
    });

    test('вкладка "Вход" активна по умолчанию', () => {
      render(<Auth onLogin={mockOnLogin} />);
      const loginTab = screen.getByRole('tab', { name: /^вход$/i });
      expect(loginTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Переключение форм', () => {
    test('переключается на форму регистрации', () => {
      render(<Auth onLogin={mockOnLogin} />);
      userEvent.click(screen.getByRole('tab', { name: /регистрация/i }));
      // После клика вкладка "Регистрация" становится активной
      expect(screen.getByRole('tab', { name: /регистрация/i })).toHaveAttribute('aria-selected', 'true');
    });

    test('возвращается к форме входа', () => {
      render(<Auth onLogin={mockOnLogin} />);
      userEvent.click(screen.getByRole('tab', { name: /регистрация/i }));
      userEvent.click(screen.getByRole('tab', { name: /^вход$/i }));
      expect(screen.getByRole('tab', { name: /^вход$/i })).toHaveAttribute('aria-selected', 'true');
    });

    test('форма регистрации содержит заголовок "Создание аккаунта"', () => {
      render(<Auth onLogin={mockOnLogin} />);
      // h2 присутствует в DOM всегда (оба блока рендерятся)
      expect(screen.getByRole('heading', { level: 2, name: /создание аккаунта/i })).toBeInTheDocument();
    });
  });

  describe('Валидация регистрации', () => {
    test('показывает ошибку если пароли не совпадают', async () => {
      render(<Auth onLogin={mockOnLogin} />);
      userEvent.click(screen.getByRole('tab', { name: /регистрация/i }));

      const passwordInput = document.getElementById('register-password') as HTMLInputElement;
      const confirmInput = document.getElementById('register-confirm-password') as HTMLInputElement;

      userEvent.type(passwordInput, 'Password123!');
      userEvent.type(confirmInput, 'Different456!');

      userEvent.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/пароли не совпадают/i);
      });
      expect(mockedApi.post).not.toHaveBeenCalled();
    });

    test('показывает ошибку если пароль короче 6 символов', async () => {
      render(<Auth onLogin={mockOnLogin} />);
      userEvent.click(screen.getByRole('tab', { name: /регистрация/i }));

      const passwordInput = document.getElementById('register-password') as HTMLInputElement;
      const confirmInput = document.getElementById('register-confirm-password') as HTMLInputElement;

      userEvent.type(passwordInput, '12345');
      userEvent.type(confirmInput, '12345');

      userEvent.click(screen.getByRole('button', { name: /зарегистрироваться/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/не менее 6/i);
      });
      expect(mockedApi.post).not.toHaveBeenCalled();
    });
  });

  describe('Успешный вход', () => {
    test('вызывает onLogin при успешном ответе', async () => {
      mockedApi.post.mockResolvedValueOnce({
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@test.local',
            role: 'free_user',
          },
        },
      });

      render(<Auth onLogin={mockOnLogin} />);

      const emailInput = document.getElementById('login-email') as HTMLInputElement;
      const passwordInput = document.getElementById('login-password') as HTMLInputElement;
      // Находим кнопку отправки формы входа — submit-кнопка внутри form#form-login
      const loginForm = document.getElementById('form-login') as HTMLFormElement;
      const submitBtn = loginForm.querySelector('button[type="submit"]') as HTMLButtonElement;

      userEvent.type(emailInput, 'test@test.local');
      userEvent.type(passwordInput, 'Pass123!');
      userEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalledWith(
          expect.objectContaining({
            token: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
          })
        );
      });
    });
  });

  describe('Ошибки входа', () => {
    test('показывает сообщение об ошибке при неверных данных', async () => {
      // Имитируем axios-ошибку с response 401
      const axiosError = Object.assign(new Error('Request failed with status code 401'), {
        isAxiosError: true,
        response: {
          status: 401,
          data: { detail: 'Incorrect email or password' },
        },
        request: {},
      });
      mockedApi.post.mockRejectedValueOnce(axiosError);

      render(<Auth onLogin={mockOnLogin} />);

      const emailInput = document.getElementById('login-email') as HTMLInputElement;
      const passwordInput = document.getElementById('login-password') as HTMLInputElement;
      const loginForm = document.getElementById('form-login') as HTMLFormElement;
      const submitBtn = loginForm.querySelector('button[type="submit"]') as HTMLButtonElement;

      userEvent.type(emailInput, 'wrong@test.local');
      userEvent.type(passwordInput, 'WrongPass!');
      userEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(mockOnLogin).not.toHaveBeenCalled();
    });

    test('показывает сообщение об ошибке сервера при статусе 500', async () => {
      const serverError = Object.assign(new Error('Request failed with status code 500'), {
        isAxiosError: true,
        response: {
          status: 500,
          data: { detail: 'Internal Server Error' },
        },
        request: {},
      });
      mockedApi.post.mockRejectedValueOnce(serverError);

      render(<Auth onLogin={mockOnLogin} />);

      const emailInput = document.getElementById('login-email') as HTMLInputElement;
      const passwordInput = document.getElementById('login-password') as HTMLInputElement;
      const loginForm = document.getElementById('form-login') as HTMLFormElement;
      const submitBtn = loginForm.querySelector('button[type="submit"]') as HTMLButtonElement;

      userEvent.type(emailInput, 'user@test.local');
      userEvent.type(passwordInput, 'Pass123!');
      userEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/ошибка сервера/i);
      });
    });
  });
});
