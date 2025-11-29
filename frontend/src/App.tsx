// src/App.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Импортируем axios
import Auth from './components/Auth';
import MainApp from './components/MainApp';
import { UserData } from './types';
import './App.css';

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Состояние загрузки при инициализации

  useEffect(() => {
    // Проверяем есть ли токен при загрузке приложения
    const token = localStorage.getItem('token');
    if (token) {
      // В реальном приложении здесь можно сделать запрос к /profile для проверки токена
      // и получения полных данных пользователя.
      // Пока просто используем токен из localStorage.
      // Для примера, можно попытаться получить данные профиля.
      const fetchProfile = async () => {
        try {
            // Устанавливаем заголовок Authorization для проверки
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Указываем тип ожидаемого ответа от /profile
            const response = await axios.get<{ name: string; email: string; id?: number }>('http://localhost:8000/profile'); // Используйте URL вашего бэкенда
            // Если запрос успешен, обновляем состояние пользователя
            setUser({
                token,
                user: { name: response.data.name, email: response.data.email, id: response.data.id } // Предполагаем, что бэкенд возвращает id
            });
        } catch (error) {
            console.error("Failed to fetch profile, token might be invalid:", error);
            // Если токен недействителен, удаляем его
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
        } finally {
            // Важно сбросить состояние загрузки в любом случае (успешно или с ошибкой)
            setLoading(false);
        }
      };

      fetchProfile();
      // ВАЖНО: Не используем await fetchProfile() здесь, так как useEffect не может быть async
      // Мы вызываем асинхронную функцию fetchProfile() внутри useEffect
    } else {
      // Если токена нет, сразу сбрасываем загрузку
      setLoading(false);
    }
  }, []); // Пустой массив зависимостей означает, что useEffect выполнится только при монтировании

  const handleLogin = (userData: UserData): void => {
    // Сохраняем токен в localStorage
    localStorage.setItem('token', userData.token);
    // Устанавливаем заголовок Authorization для всех последующих запросов
    axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    // Обновляем состояние пользователя
    setUser(userData);
  };

  const handleLogout = (): void => {
    // Удаляем токен из localStorage
    localStorage.removeItem('token');
    // Удаляем заголовок Authorization
    delete axios.defaults.headers.common['Authorization'];
    // Сбрасываем состояние пользователя
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
    <div className="App">
      {!user ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <MainApp user={user} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;
