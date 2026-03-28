// frontend/src/components/MainApp.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import api, { API_BASE } from '../api';
import { MainAppProps, ImageData, PaginatedImageResponse, ImageFilters } from '../types';
import AdminPanel from './AdminPanel';
import './MainApp.css';

const FREE_USER_LIMIT = 3;

const DEFAULT_FILTERS: ImageFilters = {
  search: '',
  processed: 'all',
  date_from: '',
  date_to: '',
  sort_by: 'created_at',
  sort_order: 'desc',
  page: 1,
  limit: 10,
};

const MainApp: React.FC<MainAppProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdmin = user.user.role === 'admin';
  const isFreeUser = user.user.role === 'free_user';

  const activeTab: 'upload' | 'history' | 'admin' =
    location.pathname === '/history' ? 'history' :
    location.pathname === '/admin' ? 'admin' :
    'upload';

  const [uploadCount, setUploadCount] = useState<number>(user.user.upload_count ?? 0);
  const isLimitReached = isFreeUser && uploadCount >= FREE_USER_LIMIT;

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [processingType, setProcessingType] = useState<'blur' | 'pixelate' | 'none'>('blur');

  // History state
  const [history, setHistory] = useState<ImageData[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Filters — инициализируем из URL query params
  const [filters, setFilters] = useState<ImageFilters>(() => ({
    search: searchParams.get('search') || '',
    processed: searchParams.get('processed') || 'all',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    sort_by: searchParams.get('sort_by') || 'created_at',
    sort_order: searchParams.get('sort_order') || 'desc',
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: parseInt(searchParams.get('limit') || '10', 10),
  }));

  // Синхронизируем фильтры с URL query params
  const updateFiltersInUrl = useCallback((f: ImageFilters) => {
    const params: Record<string, string> = {};
    if (f.search) params.search = f.search;
    if (f.processed !== 'all') params.processed = f.processed;
    if (f.date_from) params.date_from = f.date_from;
    if (f.date_to) params.date_to = f.date_to;
    if (f.sort_by !== 'created_at') params.sort_by = f.sort_by;
    if (f.sort_order !== 'desc') params.sort_order = f.sort_order;
    if (f.page !== 1) params.page = String(f.page);
    if (f.limit !== 10) params.limit = String(f.limit);
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const fetchHistory = useCallback(async (f: ImageFilters) => {
    setHistoryLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        page: f.page,
        limit: f.limit,
        sort_by: f.sort_by,
        sort_order: f.sort_order,
      };
      if (f.search) params.search = f.search;
      if (f.processed !== 'all') params.processed = f.processed === 'true';
      if (f.date_from) params.date_from = f.date_from;
      if (f.date_to) params.date_to = f.date_to;

      const response = await api.get<PaginatedImageResponse>('/image/', { params });
      setHistory(response.data.items);
      setPagination({
        total: response.data.total,
        page: response.data.page,
        limit: response.data.limit,
        pages: response.data.pages,
      });
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory(filters);
      updateFiltersInUrl(filters);
    }
  }, [activeTab, filters, fetchHistory, updateFiltersInUrl]);

  const handleFilterChange = (key: keyof ImageFilters, value: string | number) => {
    const newFilters = { ...filters, [key]: value, page: key === 'page' ? value as number : 1 };
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setUploadMessage(null);
    setProcessedUrl(null);
    setUploadProgress(0);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadMessage('❌ Выберите файл перед загрузкой');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setUploading(true);
    setUploadMessage(null);
    setUploadProgress(0);

    try {
      const response = await api.post<ImageData>(
        `/image/?process_type=${processingType}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (evt) => {
            if (evt.total) {
              setUploadProgress(Math.round((evt.loaded * 100) / evt.total));
            }
          },
        }
      );

      const data = response.data;

      let detectionText = '';
      if (data.detected_count > 0) {
        detectionText = `✅ Обнаружено объектов: ${data.detected_count}`;
        if (data.detected_objects?.length) {
          detectionText += `: ${data.detected_objects.map(o =>
            `${o.class} (${(o.confidence * 100).toFixed(1)}%)`
          ).join(', ')}`;
        }
      } else {
        detectionText = 'ℹ️ Объекты для анонимизации не обнаружены';
      }

      setUploadMessage(`✅ Изображение успешно обработано! ${detectionText}`);

      if (isFreeUser) {
        setUploadCount(prev => prev + 1);
      }

      if (data.url) {
        setProcessedUrl(data.url.startsWith('http') ? data.url : `${API_BASE}${data.url}`);
      }
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

  const handleDelete = async (imageId: number) => {
    try {
      await api.delete(`/image/${imageId}`);
      fetchHistory(filters);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  const handleDownload = (img: ImageData) => {
    const url = img.url.startsWith('http') ? img.url : `${API_BASE}${img.url}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = img.original_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="main-app">
      <header className="app-header">
        <div className="header-content">
          <h1>🤖 DataCleaner AI</h1>
          <div className="user-info">
            <span>Добро пожаловать, {user.user.name}!</span>
            <span className={`role-tag role-${user.user.role}`}>{user.user.role}</span>
            <button
              onClick={async () => {
                const refreshToken = localStorage.getItem('refreshToken');
                if (refreshToken) {
                  try {
                    await api.post('/auth/logout', { refresh_token: refreshToken });
                  } catch {
                    // игнорируем
                  }
                }
                onLogout();
              }}
              className="logout-btn"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => navigate('/upload')}
        >
          📤 Загрузить изображение
        </button>
        <button
          className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => navigate('/history')}
        >
          📋 История изображений
        </button>
        {isAdmin && (
          <button
            className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => navigate('/admin')}
          >
            Управление пользователями
          </button>
        )}
      </nav>

      <main className="app-content">
        {/* ========== UPLOAD TAB ========== */}
        {activeTab === 'upload' && (
          <div className="upload-section">
            <h2>🤖 AI Анонимизация изображений</h2>
            <p>Загрузите фото для автоматического размытия лиц</p>

            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>Метод обработки:</h3>
              <div className="demo-buttons" style={{ marginBottom: '15px' }}>
                {(['blur', 'none'] as const).map(type => (
                  <button
                    key={type}
                    className="demo-btn"
                    onClick={() => setProcessingType(type)}
                    style={{
                      backgroundColor: processingType === type ? '#28a745' : 'white',
                      color: processingType === type ? 'white' : '#333',
                    }}
                  >
                    {type === 'blur' ? '🔍 Размытие' : '📷 Без обработки'}
                  </button>
                ))}
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
              <label
                className="demo-btn primary"
                style={{ cursor: isLimitReached ? 'not-allowed' : 'pointer', opacity: isLimitReached ? 0.5 : 1 }}
              >
                📁 Выбрать файл
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/tiff"
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

            {selectedFile && (
              <div style={{ textAlign: 'center', fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} КБ)
              </div>
            )}

            {uploading && (
              <div className="upload-progress-wrap">
                <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                <span className="upload-progress-label">{uploadProgress}%</span>
              </div>
            )}

            {uploadMessage && (
              <div
                className={`auth-message ${uploadMessage.startsWith('❌') ? 'error' : 'success'}`}
                style={{ marginTop: '15px' }}
              >
                {uploadMessage}
              </div>
            )}

            <div className="demo-placeholder">
              {previewUrl ? (
                <div className="placeholder-image" style={{ position: 'relative' }}>
                  <img src={previewUrl} alt="Превью" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  <div style={{ position: 'absolute', bottom: '5px', left: '5px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    Исходное
                  </div>
                </div>
              ) : (
                <div className="placeholder-image">🖼️ Исходное изображение</div>
              )}

              {processedUrl ? (
                <div className="placeholder-image" style={{ position: 'relative' }}>
                  <img src={processedUrl} alt="Обработанное" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  <div style={{ position: 'absolute', bottom: '5px', left: '5px', backgroundColor: 'rgba(0,123,255,0.7)', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    Обработанное
                  </div>
                </div>
              ) : (
                <div className="placeholder-image">✅ Обработанное AI</div>
              )}
            </div>
          </div>
        )}

        {/* ========== ADMIN TAB ========== */}
        {activeTab === 'admin' && <AdminPanel />}

        {/* ========== HISTORY TAB ========== */}
        {activeTab === 'history' && (
          <div className="history-section">
            <h2>📋 История обработки</h2>
            <p>
              {isAdmin ? 'Все изображения всех пользователей' : 'Ваши загруженные и обработанные изображения'}
            </p>

            {/* Форма фильтров */}
            <div className="filters-panel">
              <div className="filters-row">
                <div className="filter-group">
                  <label>Поиск по имени</label>
                  <input
                    type="text"
                    placeholder="Введите имя файла..."
                    value={filters.search}
                    onChange={e => handleFilterChange('search', e.target.value)}
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label>Статус обработки</label>
                  <select
                    value={filters.processed}
                    onChange={e => handleFilterChange('processed', e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">Все</option>
                    <option value="true">Обработано AI</option>
                    <option value="false">Без обработки</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Дата от</label>
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={e => handleFilterChange('date_from', e.target.value)}
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label>Дата до</label>
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={e => handleFilterChange('date_to', e.target.value)}
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label>Сортировка</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      value={filters.sort_by}
                      onChange={e => handleFilterChange('sort_by', e.target.value)}
                      className="filter-select"
                    >
                      <option value="created_at">По дате</option>
                      <option value="original_name">По имени</option>
                      <option value="detected_count">По объектам</option>
                    </select>
                    <button
                      className="sort-order-btn"
                      onClick={() => handleFilterChange('sort_order', filters.sort_order === 'desc' ? 'asc' : 'desc')}
                      title={filters.sort_order === 'desc' ? 'По убыванию' : 'По возрастанию'}
                    >
                      {filters.sort_order === 'desc' ? '↓' : '↑'}
                    </button>
                  </div>
                </div>

                <div className="filter-group">
                  <label>На странице</label>
                  <select
                    value={filters.limit}
                    onChange={e => handleFilterChange('limit', parseInt(e.target.value, 10))}
                    className="filter-select"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="filters-actions">
                <button className="filter-reset-btn" onClick={handleResetFilters}>
                  Сбросить фильтры
                </button>
                <span className="filters-total">
                  Найдено: {pagination.total} записей
                </span>
              </div>
            </div>

            {/* Список изображений */}
            {historyLoading ? (
              <div className="history-loading">⏳ Загрузка...</div>
            ) : history.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666', padding: '30px 0' }}>
                Нет изображений, удовлетворяющих условиям поиска
              </p>
            ) : (
              <div className="history-list">
                {history.map(img => (
                  <div key={img.id} className="history-item">
                    <div className="item-preview">
                      <img
                        src={img.url.startsWith('http') ? img.url : `${API_BASE}${img.url}`}
                        alt={img.original_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                        onError={e => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="item-info">
                      <h3 title={img.original_name}>{img.original_name}</h3>
                      <p>Загружено: {new Date(img.created_at).toLocaleString('ru-RU')}</p>
                      {img.processed && (
                        <p style={{ color: '#28a745', margin: '2px 0', fontWeight: '500' }}>
                          ✅ Обработано AI
                        </p>
                      )}
                      {img.detected_count > 0 && (
                        <p style={{ color: '#666', margin: '2px 0', fontSize: '11px' }}>
                          Объектов: {img.detected_count}
                        </p>
                      )}
                      {img.s3_key && (
                        <p style={{ color: '#17a2b8', margin: '2px 0', fontSize: '11px' }}>
                          ☁️ S3
                        </p>
                      )}
                    </div>
                    <div className="item-actions">
                      <button
                        className="action-btn"
                        style={{ backgroundColor: '#28a745' }}
                        onClick={() => handleDownload(img)}
                        title="Скачать"
                      >
                        📥 Скачать
                      </button>
                      {deleteConfirm === img.id ? (
                        <>
                          <button
                            className="action-btn"
                            style={{ backgroundColor: '#dc3545' }}
                            onClick={() => handleDelete(img.id)}
                          >
                            Удалить?
                          </button>
                          <button
                            className="action-btn"
                            style={{ backgroundColor: '#6c757d' }}
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Отмена
                          </button>
                        </>
                      ) : (
                        <button
                          className="action-btn"
                          style={{ backgroundColor: '#dc3545' }}
                          onClick={() => setDeleteConfirm(img.id)}
                          title="Удалить"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Пагинация */}
            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  className="page-btn"
                  disabled={filters.page <= 1}
                  onClick={() => handleFilterChange('page', 1)}
                >
                  «
                </button>
                <button
                  className="page-btn"
                  disabled={filters.page <= 1}
                  onClick={() => handleFilterChange('page', filters.page - 1)}
                >
                  ‹
                </button>

                {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - filters.page) <= 2)
                  .map(p => (
                    <button
                      key={p}
                      className={`page-btn ${p === filters.page ? 'active' : ''}`}
                      onClick={() => handleFilterChange('page', p)}
                    >
                      {p}
                    </button>
                  ))}

                <button
                  className="page-btn"
                  disabled={filters.page >= pagination.pages}
                  onClick={() => handleFilterChange('page', filters.page + 1)}
                >
                  ›
                </button>
                <button
                  className="page-btn"
                  disabled={filters.page >= pagination.pages}
                  onClick={() => handleFilterChange('page', pagination.pages)}
                >
                  »
                </button>

                <span className="pagination-info">
                  Стр. {pagination.page} из {pagination.pages}
                </span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default MainApp;
