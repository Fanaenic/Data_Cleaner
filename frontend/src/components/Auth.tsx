// src/components/Auth.tsx
import React, { useState } from 'react';
import axios from 'axios'; // Импортируем только axios
import { AuthProps, LoginFormData, RegisterFormData, AuthResponse, UserData } from '../types';
import './Auth.css';

const API_BASE = 'http://localhost:8000';

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [activeForm, setActiveForm] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  const [loginData, setLoginData] = useState<LoginFormData>({
    email: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState<RegisterFormData>({
    name: '', // username
    email: '',
    password: '',
    confirmPassword: ''
  });

  const switchForm = (formName: 'login' | 'register'): void => {
    setActiveForm(formName);
    setMessage('');
  };

  const handleLoginSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Указываем тип AuthResponse для данных ответа
      const response = await axios.post<AuthResponse>(`${API_BASE}/login`, {
        email: loginData.email,
        password: loginData.password
      });

      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      setMessage('✅ Вход выполнен успешно!');

      const userData: UserData = {
        token: access_token,
        user: user
      };

      onLogin(userData);

    } catch (error: unknown) { // Используем 'unknown' для безопасности
      console.error("Login error:", error);
      let errorMessage = '❌ Ошибка входа: Неизвестная ошибка';

      // Проверяем, является ли ошибка ошибкой Axios
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Сервер ответил с кодом, отличным от 2xx
          const status = error.response.status;
          const detail = error.response.data.detail || 'Неверный email или пароль';

          if (status === 401) {
            errorMessage = `❌ Ошибка входа: ${detail}`;
          } else if (status >= 500) {
            errorMessage = '❌ Ошибка сервера. Попробуйте позже.';
          } else {
            errorMessage = `❌ Ошибка входа: ${detail}`;
          }
        } else if (error.request) {
          // Запрос был сделан, но ответ не получен (например, нет соединения)
          errorMessage = '❌ Нет соединения с сервером. Проверьте подключение.';
        } else {
          // Произошло что-то при настройке запроса
          errorMessage = `❌ Ошибка сети: ${error.message}`;
        }
      } else {
        // Это не ошибка Axios, возможно, ошибка JavaScript
        errorMessage = `❌ Ошибка: ${String(error)}`;
      }

      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (registerData.password !== registerData.confirmPassword) {
      setMessage('❌ Пароли не совпадают!');
      setLoading(false);
      return;
    }

    if (registerData.password.length < 6) {
      setMessage('❌ Пароль должен содержать не менее 6 символов!');
      setLoading(false);
      return;
    }

    try {
      // Указываем тип AuthResponse для данных ответа
      const response = await axios.post<AuthResponse>(`${API_BASE}/register`, {
        email: registerData.email,
        password: registerData.password,
        name: registerData.name, // Передаем name как username
      });

      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      setMessage('✅ Регистрация завершена! Вход выполнен.');

      const userData: UserData = {
        token: access_token,
        user: user
      };

      onLogin(userData);

    } catch (error: unknown) { // Используем 'unknown' для безопасности
      console.error("Registration error:", error);
      let errorMessage = '❌ Ошибка регистрации: Неизвестная ошибка';

      // Проверяем, является ли ошибка ошибкой Axios
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Сервер ответил с кодом, отличным от 2xx
          const status = error.response.status;
          const detail = error.response.data.detail || 'Ошибка сервера';

          if (status === 400) {
            if (detail === "Email already registered") {
              errorMessage = '❌ Пользователь с таким email уже зарегистрирован';
            } else if (detail === "Username already taken") {
               errorMessage = '❌ Пользователь с таким именем уже зарегистрирован';
            } else {
              errorMessage = `❌ Ошибка регистрации: ${detail}`;
            }
          } else if (status >= 500) {
            errorMessage = '❌ Ошибка сервера. Попробуйте позже.';
          } else {
            errorMessage = `❌ Ошибка регистрации: ${detail}`;
          }
        } else if (error.request) {
          // Запрос был сделан, но ответ не получен
          errorMessage = '❌ Нет соединения с сервером. Проверьте подключение.';
        } else {
          // Произошло что-то при настройке запроса
          errorMessage = `❌ Ошибка сети: ${error.message}`;
        }
      } else {
        // Это не ошибка Axios, возможно, ошибка JavaScript
        errorMessage = `❌ Ошибка: ${String(error)}`;
      }

      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="logo">DataCleaner</div>

        <div className="form-toggle">
          <button
            className={`toggle-btn ${activeForm === 'login' ? 'active' : ''}`}
            onClick={() => switchForm('login')}
            type="button"
          >
            Вход
          </button>
          <button
            className={`toggle-btn ${activeForm === 'register' ? 'active' : ''}`}
            onClick={() => switchForm('register')}
            type="button"
          >
            Регистрация
          </button>
        </div>

        {message && (
          <div className={`auth-message ${message.startsWith('❌') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <form
          className={`auth-form ${activeForm === 'login' ? 'active' : ''}`}
          onSubmit={handleLoginSubmit}
        >
          <h2>Вход в аккаунт</h2>

          <div className="input-group">
            <label htmlFor="login-email">Email</label>
            <input
              type="email"
              id="login-email"
              placeholder="example@mail.com"
              required
              value={loginData.email}
              onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div className="input-group">
            <label htmlFor="login-password">Пароль</label>
            <input
              type="password"
              id="login-password"
              placeholder="Введите пароль"
              required
              value={loginData.password}
              onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Загрузка...' : 'Войти'}
          </button>


        </form>

        <form
          className={`auth-form ${activeForm === 'register' ? 'active' : ''}`}
          onSubmit={handleRegisterSubmit}
        >
          <h2>Создание аккаунта</h2>

          <div className="input-group">
            <label htmlFor="register-name">Имя пользователя</label>
            <input
              type="text"
              id="register-name"
              placeholder="Ваше имя"
              required
              value={registerData.name}
              onChange={(e) => setRegisterData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="input-group">
            <label htmlFor="register-email">Email</label>
            <input
              type="email"
              id="register-email"
              placeholder="example@mail.com"
              required
              value={registerData.email}
              onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div className="input-group">
            <label htmlFor="register-password">Пароль</label>
            <input
              type="password"
              id="register-password"
              placeholder="Не менее 6 символов"
              required
              value={registerData.password}
              onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
            />
          </div>

          <div className="input-group">
            <label htmlFor="register-confirm-password">Подтвердите пароль</label>
            <input
              type="password"
              id="register-confirm-password"
              placeholder="Повторите пароль"
              required
              value={registerData.confirmPassword}
              onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            />
          </div>

          <div className="checkbox-group">
            <input type="checkbox" id="agree-terms" required />
            <label htmlFor="agree-terms">
              Я согласен с условиями использования
            </label>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>

          <div className="form-footer">
            Уже есть аккаунт?{' '}
            <button
              type="button"
              className="switch-to-login"
              onClick={() => switchForm('login')}
            >
              Войти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Auth;
