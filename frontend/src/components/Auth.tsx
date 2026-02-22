// src/components/Auth.tsx
import React, { useState } from 'react';
import axios from 'axios';
import api from '../api';
import { AuthProps, LoginFormData, RegisterFormData, AuthResponse } from '../types';
import './Auth.css';

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [activeForm, setActiveForm] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  const [loginData, setLoginData] = useState<LoginFormData>({
    email: '',
    password: '',
  });

  const [registerData, setRegisterData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
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
      const response = await api.post<AuthResponse>('/auth/login', {
        email: loginData.email,
        password: loginData.password,
      });

      const { access_token, user } = response.data;
      setMessage('✅ Вход выполнен успешно!');
      onLogin({ token: access_token, user });
    } catch (error: unknown) {
      let errorMessage = '❌ Ошибка входа';

      if (axios.isAxiosError(error)) {
        if (error.response) {
          const detail = error.response.data?.detail || 'Неверный email или пароль';
          if (error.response.status >= 500) {
            errorMessage = '❌ Ошибка сервера. Попробуйте позже.';
          } else {
            errorMessage = `❌ ${detail}`;
          }
        } else if (error.request) {
          errorMessage = '❌ Нет соединения с сервером.';
        }
      }

      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (registerData.password !== registerData.confirmPassword) {
      setMessage('❌ Пароли не совпадают!');
      return;
    }
    if (registerData.password.length < 6) {
      setMessage('❌ Пароль должен содержать не менее 6 символов!');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await api.post<AuthResponse>('/auth/register', {
        name: registerData.name,
        email: registerData.email,
        username: registerData.email,
        password: registerData.password,
      });

      const { access_token, user } = response.data;
      setMessage('✅ Регистрация завершена! Вход выполнен.');
      onLogin({ token: access_token, user });
    } catch (error: unknown) {
      let errorMessage = '❌ Ошибка регистрации';

      if (axios.isAxiosError(error)) {
        if (error.response) {
          const detail = error.response.data?.detail || 'Ошибка сервера';
          if (error.response.status === 400) {
            if (detail === 'Email already registered') {
              errorMessage = '❌ Пользователь с таким email уже зарегистрирован';
            } else if (detail === 'Username already taken') {
              errorMessage = '❌ Пользователь с таким именем уже существует';
            } else {
              errorMessage = `❌ ${detail}`;
            }
          } else if (error.response.status >= 500) {
            errorMessage = '❌ Ошибка сервера. Попробуйте позже.';
          } else {
            errorMessage = `❌ ${detail}`;
          }
        } else if (error.request) {
          errorMessage = '❌ Нет соединения с сервером.';
        }
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
            <label htmlFor="agree-terms">Я согласен с условиями использования</label>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>

          <div className="form-footer">
            Уже есть аккаунт?{' '}
            <button type="button" className="switch-to-login" onClick={() => switchForm('login')}>
              Войти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Auth;
