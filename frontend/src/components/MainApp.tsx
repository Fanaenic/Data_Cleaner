// frontend/src/components/MainApp.tsx
import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { MainAppProps, ImageData } from '../types';
import AdminPanel from './AdminPanel';
import ProtectedRoute from './ProtectedRoute';
import './MainApp.css';

const API_BASE = 'http://localhost:8000';

// Расширяем типы
interface ProcessedImageData extends ImageData {
  url: string;
  processed: boolean;
  detected_count: number;
  detected_objects?: Array<{
    class: string;
    confidence: number;
    bbox: number[];
  }>;
}

const FREE_USER_LIMIT = 3;

const MainApp: React.FC<MainAppProps> = ({ user, onLogout }) => {
  const isAdmin = user.user.role === 'admin';
  const isFreeUser = user.user.role === 'free_user';
  const [uploadCount, setUploadCount] = useState<number>(user.user.upload_count ?? 0);
  const isLimitReached = isFreeUser && uploadCount >= FREE_USER_LIMIT;
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'admin'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<ProcessedImageData[]>([]);
  const [processingType, setProcessingType] = useState<'blur' | 'pixelate' | 'none'>('blur');

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get<ProcessedImageData[]>(`${API_BASE}/image/`, {
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
      setPreviewUrl(URL.createObjectURL(file));
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

    const url = `${API_BASE}/image/?process_type=${processingType}`;

    setUploading(true);
    setUploadMessage(null);

    try {
      const response = await axios.post<ProcessedImageData>(url, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const data = response.data;

      // Формируем информацию о детекции
      let detectionText = '';
      if (data.detected_count > 0) {
        detectionText = `✅ Обнаружено объектов: ${data.detected_count}`;
        if (data.detected_objects && data.detected_objects.length > 0) {
          const objectsList = data.detected_objects.map(obj =>
            `${obj.class} (${(obj.confidence * 100).toFixed(1)}%)`
          ).join(', ');
          detectionText += `: ${objectsList}`;
        }
      } else {
        detectionText = 'ℹ️ Объекты для анонимизации не обнаружены';
      }

      setUploadMessage(`✅ Изображение успешно обработано! ${detectionText}`);

      if (isFreeUser) {
        setUploadCount(prev => prev + 1);
      }

      // Показываем обработанное изображение
      if (data.url) {
        setProcessedUrl(`${API_BASE}${data.url}`);
      }

      fetchHistory();
    } catch (error) {
      let msg = '❌ Ошибка загрузки';
      if (axios.isAxiosError(error)) {
        const err = error as AxiosError<{ detail?: string }>;
        if (err.response?.status === 401) {
          msg = '❌ Сессия истекла. Войдите снова.';
          localStorage.removeItem('token');
          onLogout();
        } else if (err.response?.status === 403) {
          msg = `❌ ${err.response.data?.detail || 'Лимит загрузок исчерпан. Обновите тариф.'}`;
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
          <h1>🤖 DataCleaner AI</h1>
          <div className="user-info">
            <span>Добро пожаловать, {user.user.name}!</span>
            <span className={`role-tag role-${user.user.role}`}>{user.user.role}</span>
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
        {isAdmin && (
          <button
            className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Управление пользователями
          </button>
        )}
      </nav>

      <main className="app-content">
        {activeTab === 'upload' && (
          <div className="upload-section">
            <h2>🤖 AI Анонимизация изображений</h2>
            <p>Загрузите фото для автоматического размытия лиц</p>

            {/* Выбор типа обработки */}
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>Метод обработки:</h3>
              <div className="demo-buttons" style={{ marginBottom: '15px' }}>
                <button
                  className={`demo-btn ${processingType === 'blur' ? 'primary' : ''}`}
                  onClick={() => setProcessingType('blur')}
                  style={{
                    backgroundColor: processingType === 'blur' ? '#28a745' : 'white',
                    color: processingType === 'blur' ? 'white' : '#333'
                  }}
                >
                  🔍 Размытие
                </button>
                <button
                  className={`demo-btn ${processingType === 'none' ? 'primary' : ''}`}
                  onClick={() => setProcessingType('none')}
                  style={{
                    backgroundColor: processingType === 'none' ? '#28a745' : 'white',
                    color: processingType === 'none' ? 'white' : '#333'
                  }}
                >
                  📷 Без обработки
                </button>
              </div>
            </div>

            {isFreeUser && (
              <div className={`upload-limit-info ${isLimitReached ? 'limit-reached' : ''}`}>
                {isLimitReached
                  ? '❌ Лимит загрузок исчерпан. Обновитесь до Pro.'
                  : `📊 Осталось загрузок: ${FREE_USER_LIMIT - uploadCount} / ${FREE_USER_LIMIT}`}
              </div>
            )}

            <div className="demo-buttons">
              <label className="demo-btn primary" style={{ cursor: isLimitReached ? 'not-allowed' : 'pointer', opacity: isLimitReached ? 0.5 : 1 }}>
                📁 Выбрать файл
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isLimitReached}
                  style={{ display: 'none' }}
                />
              </label>
              <button
                className="demo-btn secondary"
                onClick={handleUpload}
                disabled={!selectedFile || uploading || isLimitReached}
              >
                {uploading ? '🤖 Обработка AI...' : '🚀 Обработать изображение'}
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
                <div className="placeholder-image" style={{ position: 'relative' }}>
                  <img
                    src={previewUrl}
                    alt="Превью"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '5px',
                    left: '5px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    Исходное
                  </div>
                </div>
              )}
              {processedUrl && (
                <div className="placeholder-image" style={{ position: 'relative' }}>
                  <img
                    src={processedUrl}
                    alt="Обработанное"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '5px',
                    left: '5px',
                    backgroundColor: 'rgba(0,123,255,0.7)',
                    color: 'white',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    Обработанное
                  </div>
                </div>
              )}
              {!previewUrl && !processedUrl && (
                <>
                  <div className="placeholder-image">
                    🖼️ Исходное изображение
                  </div>
                  <div className="placeholder-image">
                    ✅ Обработанное AI
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <ProtectedRoute role={user.user.role} allowedRoles={['admin']}>
            <AdminPanel token={user.token} />
          </ProtectedRoute>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            <h2>📋 История обработки</h2>
            <p>{isAdmin ? 'Все изображения всех пользователей' : 'Ваши загруженные и обработанные изображения'}</p>

            {history.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666' }}>Нет загруженных изображений</p>
            ) : (
              <div className="history-list">
                {history.map((img) => (
                  <div key={img.id} className="history-item">
                    <div className="item-preview">
                      <img
                        src={`${API_BASE}${img.url}`}
                        alt={img.original_name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '4px'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24"><text x="12" y="12" font-size="10" text-anchor="middle" fill="lightgray">🖼️</text></svg>';
                        }}
                      />
                    </div>
                    <div className="item-info">
                      <h3>{img.original_name}</h3>
                      <p>Загружено: {new Date(img.created_at).toLocaleString('ru-RU')}</p>
                      {img.processed && (
                        <p style={{ color: '#28a745', margin: '2px 0', fontWeight: '500' }}>
                          ✅ Обработано AI
                        </p>
                      )}
                    </div>
                    <button
                      className="action-btn"
                      onClick={() => {
                        const imageUrl = `${API_BASE}${img.url}`;
                        const link = document.createElement('a');
                        link.href = imageUrl;
                        link.download = img.original_name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      style={{ backgroundColor: '#28a745' }}
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