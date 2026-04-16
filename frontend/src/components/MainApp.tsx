// frontend/src/components/MainApp.tsx
/**
 * SEO-доработки (Лаб. 4):
 *   2.1 — семантическая разметка: <header>, <nav>, <main>, <section>, <article>, <h1>-<h3>
 *   2.3 — динамические мета-теги через SEOHead (noindex для всех вкладок)
 *   4.1 — lazy loading для изображений в истории (loading="lazy")
 *   4.2 — минимизация запросов: запрос истории только при активной вкладке
 *   4.4 — скелетон-загрузчик вместо CLS-провокатора ⏳
 *   6.1 — SecurityWidget отображает данные стороннего API
 *   6.2 — состояния загрузки/ошибки/пустого результата в SecurityWidget
 */
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import api, { API_BASE } from '../api';
import { MainAppProps, ImageData, PaginatedImageResponse, ImageFilters } from '../types';
import SEOHead from './SEOHead';
import SecurityWidget from './SecurityWidget';
import './MainApp.css';

// Lazy loading тяжёлого компонента AdminPanel (задание 4.1)
const AdminPanel = lazy(() => import('./AdminPanel'));

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

/** Мета-данные для каждой вкладки */
const TAB_SEO = {
  upload: {
    title: 'Загрузить изображение',
    description:
      'Загрузите изображение для автоматической анонимизации лиц с помощью AI. ' +
      'Поддерживаются форматы JPEG, PNG, WebP.',
  },
  history: {
    title: 'История обработки',
    description:
      'Просмотр истории загруженных и обработанных изображений. ' +
      'Фильтрация, сортировка и управление файлами.',
  },
  admin: {
    title: 'Управление пользователями',
    description: 'Панель администратора: управление ролями и учётными записями пользователей.',
  },
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

  // Синхронизируем фильтры с URL (SEO-дружелюбные URL, задание 2.2)
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

  // Загружаем историю только при активной вкладке (задание 4.2 — минимизация запросов)
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

  const tabSeo = TAB_SEO[activeTab];

  return (
    <div className="main-app">
      {/* SEO: noindex для всех приватных страниц (задание 1.2, 2.3) */}
      <SEOHead
        title={tabSeo.title}
        description={tabSeo.description}
        noIndex={true}
      />

      {/* ── Шапка (семантический <header>, задание 2.1) ──────────────────── */}
      <header className="app-header" role="banner">
        <div className="header-content">
          {/* h1 — главный заголовок страницы (задание 2.1) */}
          <h1>DataCleaner AI</h1>
          <div className="user-info">
            <span>Добро пожаловать, <strong>{user.user.name}</strong>!</span>
            <span
              className={`role-tag role-${user.user.role}`}
              aria-label={`Роль: ${user.user.role}`}
            >
              {user.user.role}
            </span>
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
              aria-label="Выйти из аккаунта"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* ── Навигация (семантический <nav>, задание 2.1) ─────────────────── */}
      <nav className="app-nav" aria-label="Основная навигация">
        <button
          className={`nav-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => navigate('/upload')}
          aria-current={activeTab === 'upload' ? 'page' : undefined}
        >
          Загрузить изображение
        </button>
        <button
          className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => navigate('/history')}
          aria-current={activeTab === 'history' ? 'page' : undefined}
        >
          История изображений
        </button>
        {isAdmin && (
          <button
            className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => navigate('/admin')}
            aria-current={activeTab === 'admin' ? 'page' : undefined}
          >
            Управление пользователями
          </button>
        )}
      </nav>

      {/* ── Основной контент (семантический <main>, задание 2.1) ─────────── */}
      <main className="app-content" id="main-content">

        {/* ══════════════════════════════════════════════════════
            ВКЛАДКА: ЗАГРУЗКА
            ══════════════════════════════════════════════════════ */}
        {activeTab === 'upload' && (
          <section className="upload-section" aria-labelledby="upload-heading">
            <h2 id="upload-heading">AI Анонимизация изображений</h2>
            <p>Загрузите фото для автоматического размытия лиц</p>

            {/* Выбор метода обработки */}
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>Метод обработки:</h3>
              <div className="demo-buttons" style={{ marginBottom: '15px' }} role="group" aria-label="Выбор метода обработки">
                {(['blur', 'none'] as const).map(type => (
                  <button
                    key={type}
                    className="demo-btn"
                    onClick={() => setProcessingType(type)}
                    aria-pressed={processingType === type}
                    style={{
                      backgroundColor: processingType === type ? '#28a745' : 'white',
                      color: processingType === type ? 'white' : '#333',
                    }}
                  >
                    {type === 'blur' ? 'Размытие' : 'Без обработки'}
                  </button>
                ))}
              </div>
            </div>

            {/* Лимит загрузок */}
            {isFreeUser && (
              <div
                className={`upload-limit-info ${isLimitReached ? 'limit-reached' : ''}`}
                role="status"
                aria-live="polite"
              >
                {isLimitReached
                  ? '❌ Лимит загрузок исчерпан. Обновитесь до Pro.'
                  : `📊 Осталось загрузок: ${FREE_USER_LIMIT - uploadCount} / ${FREE_USER_LIMIT}`}
              </div>
            )}

            {/* Кнопки управления загрузкой */}
            <div className="demo-buttons">
              <label
                className="demo-btn primary"
                style={{ cursor: isLimitReached ? 'not-allowed' : 'pointer', opacity: isLimitReached ? 0.5 : 1 }}
              >
                Выбрать файл
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/tiff"
                  onChange={handleFileChange}
                  disabled={isLimitReached}
                  style={{ display: 'none' }}
                  aria-label="Выбрать файл изображения"
                />
              </label>
              <button
                className="demo-btn secondary"
                onClick={handleUpload}
                disabled={!selectedFile || uploading || isLimitReached}
                aria-busy={uploading}
              >
                {uploading ? 'Обработка AI...' : 'Обработать изображение'}
              </button>
            </div>

            {/* Информация о выбранном файле */}
            {selectedFile && (
              <p style={{ textAlign: 'center', fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                <span aria-label="Выбранный файл">{selectedFile.name}</span>{' '}
                ({(selectedFile.size / 1024).toFixed(1)} КБ)
              </p>
            )}

            {/* Прогресс-бар (стабильность CLS — фиксированная высота, задание 4.4) */}
            {uploading && (
              <div
                className="upload-progress-wrap"
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Прогресс загрузки"
              >
                <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                <span className="upload-progress-label">{uploadProgress}%</span>
              </div>
            )}

            {/* Сообщение об успехе/ошибке */}
            {uploadMessage && (
              <div
                className={`auth-message ${uploadMessage.startsWith('❌') ? 'error' : 'success'}`}
                style={{ marginTop: '15px' }}
                role="alert"
                aria-live="assertive"
              >
                {uploadMessage}
              </div>
            )}

            {/* Предпросмотр изображений */}
            <div className="demo-placeholder" aria-label="Предпросмотр изображений">
              <figure className="placeholder-image" style={{ position: 'relative', margin: 0 }}>
                {previewUrl ? (
                  <>
                    {/* loading="lazy" — задание 4.1 */}
                    <img
                      src={previewUrl}
                      alt="Исходное изображение перед обработкой"
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                    <figcaption style={{
                      position: 'absolute', bottom: '5px', left: '5px',
                      backgroundColor: 'rgba(0,0,0,0.7)', color: 'white',
                      padding: '3px 8px', borderRadius: '4px', fontSize: '12px'
                    }}>
                      Исходное
                    </figcaption>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
                    Исходное изображение
                  </div>
                )}
              </figure>

              <figure className="placeholder-image" style={{ position: 'relative', margin: 0 }}>
                {processedUrl ? (
                  <>
                    <img
                      src={processedUrl}
                      alt="Обработанное изображение с анонимизацией лиц"
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                    <figcaption style={{
                      position: 'absolute', bottom: '5px', left: '5px',
                      backgroundColor: 'rgba(0,123,255,0.7)', color: 'white',
                      padding: '3px 8px', borderRadius: '4px', fontSize: '12px'
                    }}>
                      Обработанное AI
                    </figcaption>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
                    Обработанное AI
                  </div>
                )}
              </figure>
            </div>

            {/* Виджет геолокации — сторонний API (задание 6.1, 6.2, 6.3) */}
            <SecurityWidget />
          </section>
        )}

        {/* ══════════════════════════════════════════════════════
            ВКЛАДКА: ADMIN — lazy-loaded (задание 4.1)
            ══════════════════════════════════════════════════════ */}
        {activeTab === 'admin' && (
          <Suspense
            fallback={
              <div role="status" aria-label="Загрузка панели администратора" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                ⏳ Загрузка панели администратора...
              </div>
            }
          >
            <AdminPanel />
          </Suspense>
        )}

        {/* ══════════════════════════════════════════════════════
            ВКЛАДКА: ИСТОРИЯ
            ══════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <section className="history-section" aria-labelledby="history-heading">
            <h2 id="history-heading">История обработки</h2>
            <p>
              {isAdmin
                ? 'Все изображения всех пользователей'
                : 'Ваши загруженные и обработанные изображения'}
            </p>

            {/* Форма фильтров */}
            <div className="filters-panel" role="search" aria-label="Фильтры истории">
              <div className="filters-row">
                <div className="filter-group">
                  <label htmlFor="filter-search">Поиск по имени</label>
                  <input
                    id="filter-search"
                    type="search"
                    placeholder="Введите имя файла..."
                    value={filters.search}
                    onChange={e => handleFilterChange('search', e.target.value)}
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label htmlFor="filter-processed">Статус обработки</label>
                  <select
                    id="filter-processed"
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
                  <label htmlFor="filter-date-from">Дата от</label>
                  <input
                    id="filter-date-from"
                    type="date"
                    value={filters.date_from}
                    onChange={e => handleFilterChange('date_from', e.target.value)}
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label htmlFor="filter-date-to">Дата до</label>
                  <input
                    id="filter-date-to"
                    type="date"
                    value={filters.date_to}
                    onChange={e => handleFilterChange('date_to', e.target.value)}
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label htmlFor="filter-sort">Сортировка</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      id="filter-sort"
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
                      aria-label={`Порядок сортировки: ${filters.sort_order === 'desc' ? 'по убыванию' : 'по возрастанию'}`}
                    >
                      {filters.sort_order === 'desc' ? '↓' : '↑'}
                    </button>
                  </div>
                </div>

                <div className="filter-group">
                  <label htmlFor="filter-limit">На странице</label>
                  <select
                    id="filter-limit"
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
                <span className="filters-total" role="status" aria-live="polite">
                  Найдено: {pagination.total} записей
                </span>
              </div>
            </div>

            {/* Список изображений */}
            {historyLoading ? (
              /* Скелетон-загрузчик предотвращает CLS (задание 4.4) */
              <div role="status" aria-label="Загрузка истории" className="history-loading">
                ⏳ Загрузка...
              </div>
            ) : history.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666', padding: '30px 0' }} role="status">
                Нет изображений, удовлетворяющих условиям поиска
              </p>
            ) : (
              /* Список как <ul> с семантическими <li> (задание 2.1) */
              <ul className="history-list" aria-label="Список обработанных изображений">
                {history.map(img => (
                  <li key={img.id} className="history-item">
                    {/* Превью с lazy loading (задание 4.1) */}
                    <div className="item-preview">
                      <img
                        src={img.url.startsWith('http') ? img.url : `${API_BASE}${img.url}`}
                        alt={`Обработанное изображение: ${img.original_name}`}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                        onError={e => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="item-info">
                      <h3 title={img.original_name}>{img.original_name}</h3>
                      <p>
                        <time dateTime={img.created_at}>
                          Загружено: {new Date(img.created_at).toLocaleString('ru-RU')}
                        </time>
                      </p>
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
                        aria-label={`Скачать ${img.original_name}`}
                      >
                        Скачать
                      </button>
                      {deleteConfirm === img.id ? (
                        <>
                          <button
                            className="action-btn"
                            style={{ backgroundColor: '#dc3545' }}
                            onClick={() => handleDelete(img.id)}
                            aria-label={`Подтвердить удаление ${img.original_name}`}
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
                          aria-label={`Удалить ${img.original_name}`}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Пагинация */}
            {pagination.pages > 1 && (
              <nav className="pagination" aria-label="Пагинация">
                <button
                  className="page-btn"
                  disabled={filters.page <= 1}
                  onClick={() => handleFilterChange('page', 1)}
                  aria-label="Первая страница"
                >
                  «
                </button>
                <button
                  className="page-btn"
                  disabled={filters.page <= 1}
                  onClick={() => handleFilterChange('page', filters.page - 1)}
                  aria-label="Предыдущая страница"
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
                      aria-label={`Страница ${p}`}
                      aria-current={p === filters.page ? 'page' : undefined}
                    >
                      {p}
                    </button>
                  ))}

                <button
                  className="page-btn"
                  disabled={filters.page >= pagination.pages}
                  onClick={() => handleFilterChange('page', filters.page + 1)}
                  aria-label="Следующая страница"
                >
                  ›
                </button>
                <button
                  className="page-btn"
                  disabled={filters.page >= pagination.pages}
                  onClick={() => handleFilterChange('page', pagination.pages)}
                  aria-label="Последняя страница"
                >
                  »
                </button>

                <span className="pagination-info" aria-live="polite">
                  Стр. {pagination.page} из {pagination.pages}
                </span>
              </nav>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default MainApp;
