import axios from 'axios';

// В Docker задаётся через REACT_APP_API_URL в docker-compose environment
export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Централизованный axios-клиент
const api = axios.create({ baseURL: API_BASE });

// Автоматически добавляем токен ко всем запросам
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
