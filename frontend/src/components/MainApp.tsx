// src/components/MainApp.tsx
import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { MainAppProps, UserData, ImageData } from '../types';
import './MainApp.css';

const API_BASE = 'http://localhost:8000';

const MainApp: React.FC<MainAppProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get<ImageData[]>(`${API_BASE}/image/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(response.data);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setUploadMessage(null);
    setProcessedUrl(null);

    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadMessage('❌ Выберите файл перед загрузкой');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setUploadMessage('❌ Токен отсутствует. Войдите заново.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setUploading(true);
    setUploadMessage(null);

    try {
      await axios.post(`${API_BASE}/image/`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadMessage('✅ Изображение успешно загружено!');
      setProcessedUrl(previewUrl);

      fetchHistory();
    } catch (error) {
      let msg = '❌ Ошибка загрузки';
      if (axios.isAxiosError(error)) {
        const err = error as AxiosError<{ detail?: string }>;
        if (err.response?.status === 401) {
          msg = '❌ Сессия истекла. Войдите снова.';
          localStorage.removeItem('token');
          onLogout();
        } else if (err.response?.status === 400) {
          msg = `❌ ${err.response.data?.detail || 'Неверный формат файла'}`;
        } else {
          msg = `❌ Сервер вернул ошибку: ${err.response?.status}`;
        }
      }
      setUploadMessage(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="main-app">
      <header className="app-header">
        <div className="header-content">
          <h1>DataCleaner</h1>
          <div className="user-info">
            <span>Добро пожаловать, {user.user.name}!</span>
            <button onClick={onLogout} className="logout-btn">Выйти</button>
          </div>
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📤 Загрузить изображение
        </button>
        <button
          className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📋 История изображений
        </button>
      </nav>

      <main className="app-content">
        {activeTab === 'upload' && (
          <div className="upload-section">
            <h2>Загрузка изображения</h2>
            <p>Выберите изображение для отправки на сервер</p>

            <div className="demo-buttons">
              <label className="demo-btn primary" style={{ cursor: 'pointer' }}>
                📁 Выбрать файл
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                className="demo-btn secondary"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
              >
                {uploading ? '🚀 Загрузка...' : '🚀 Обработать изображение'}
              </button>
            </div>

            {uploadMessage && (
              <div
                className={`auth-message ${uploadMessage.startsWith('❌') ? 'error' : 'success'}`}
                style={{ marginTop: '15px' }}
              >
                {uploadMessage}
              </div>
            )}

            <div className="demo-placeholder">
              {previewUrl && (
                <div className="placeholder-image">
                  <img
                    src={previewUrl}
                    alt="Превью"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}
              {processedUrl && (
                <div className="placeholder-image">
                  <img
                    src={processedUrl}
                    alt="Обработанное"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}
              {!previewUrl && !processedUrl && (
                <>
                  <div className="placeholder-image">🖼️ Превью изображения</div>
                  <div className="placeholder-image">✅ Обработанное изображение</div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            <h2>История обработки</h2>
            <p>Ваши загруженные изображения</p>

            {history.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666' }}>Нет загруженных изображений</p>
            ) : (
              <div className="history-list">
                {history.map((img) => (
                  <div key={img.id} className="history-item">
                    <div className="item-preview">
                      <img
                        src={`${API_BASE}/uploads/${img.filename}`}
                        alt={img.original_name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24"><text x="12" y="12" font-size="10" text-anchor="middle" fill="lightgray">🖼️</text></svg>';
                        }}
                      />
                    </div>
                    <div className="item-info">
                      <h3>{img.original_name}</h3>
                      <p>Загружено: {new Date(img.created_at).toLocaleString('ru-RU')}</p>
                    </div>
                    <button
                      className="action-btn"
                      onClick={() => {
                        const imageUrl = `${API_BASE}/uploads/${img.filename}`;
                        const link = document.createElement('a');
                        link.href = imageUrl;
                        link.download = img.original_name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      📥 Скачать
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default MainApp;