// src/App.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Auth from './components/Auth';
import MainApp from './components/MainApp';
import { UserData } from './types';
import './App.css';

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const fetchProfile = async () => {
        try {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            const response = await axios.get<{ name: string; email: string; id?: number; role: string; upload_count?: number }>(
              'http://localhost:8000/profile'
            );
            setUser({
                token,
                user: {
                  name: response.data.name,
                  email: response.data.email,
                  id: response.data.id,
                  role: response.data.role as import('./types').Role,
                  upload_count: response.data.upload_count ?? 0
                }
            });
        } catch (error) {
            console.error("Failed to fetch profile, token might be invalid:", error);
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
        } finally {
            setLoading(false);
        }
      };

      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData: UserData): void => {
    localStorage.setItem('token', userData.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    setUser(userData);
  };

  const handleLogout = (): void => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
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
