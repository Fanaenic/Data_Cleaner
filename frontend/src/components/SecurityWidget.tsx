/**
 * SecurityWidget — виджет информации о текущей сессии (геолокация по IP).
 *
 * Задание 6 (Лаб. 4):
 *   6.1 — отображение данных от стороннего API (ip-api.com) в UI
 *   6.2 — состояния: загрузка / данные / пустой результат / ошибка
 *   6.3 — graceful degradation: при недоступности API показывает
 *          заглушку, не ломая основной функционал приложения
 *
 * Компонент отображается на вкладке "Загрузить изображение"
 * как блок "Информация о текущей сессии".
 */
import React, { useState, useEffect } from 'react';
import api from '../api';
import './SecurityWidget.css';

interface GeoInfo {
  available: boolean;
  error?: string;
  ip?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  org?: string;
}

const SecurityWidget: React.FC = () => {
  const [geoInfo, setGeoInfo] = useState<GeoInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchGeo = async () => {
      try {
        const response = await api.get<GeoInfo>('/geo/location', {
          signal: controller.signal,
        });
        setGeoInfo(response.data);
      } catch (err: unknown) {
        // Не показываем ошибку если запрос был отменён при размонтировании
        if ((err as { name?: string }).name !== 'CanceledError' &&
            (err as { name?: string }).name !== 'AbortError') {
          setFetchError(true);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchGeo();

    // Отменяем запрос при размонтировании (предотвращаем memory leak)
    return () => controller.abort();
  }, []);

  // ── Состояние: загрузка ───────────────────────────────────────────────────
  if (loading) {
    return (
      <aside className="security-widget security-widget--loading" aria-label="Информация о сессии">
        <h3 className="security-widget__title">
          <span aria-hidden="true">🔐</span> Информация о сессии
        </h3>
        <div className="security-widget__skeleton">
          <div className="skeleton-line skeleton-line--short" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--medium" />
        </div>
      </aside>
    );
  }

  // ── Состояние: ошибка запроса или API недоступен (graceful degradation) ───
  if (fetchError || !geoInfo || !geoInfo.available) {
    return (
      <aside
        className="security-widget security-widget--degraded"
        aria-label="Информация о сессии недоступна"
      >
        <h3 className="security-widget__title">
          <span aria-hidden="true">🔐</span> Информация о сессии
        </h3>
        <p className="security-widget__degraded-msg">
          <span aria-hidden="true">⚠️</span> Геоданные временно недоступны
          {geoInfo?.error && (
            <span className="security-widget__error-detail"> — {geoInfo.error}</span>
          )}
        </p>
      </aside>
    );
  }

  // ── Состояние: пустой результат (нет данных, но API ответил) ─────────────
  if (!geoInfo.city && !geoInfo.country && !geoInfo.ip) {
    return (
      <aside className="security-widget" aria-label="Информация о сессии">
        <h3 className="security-widget__title">
          <span aria-hidden="true">🔐</span> Информация о сессии
        </h3>
        <p className="security-widget__empty">Данные о местоположении недоступны</p>
      </aside>
    );
  }

  // ── Состояние: успешные данные ────────────────────────────────────────────
  return (
    <aside className="security-widget security-widget--loaded" aria-label="Информация о текущей сессии">
      <h3 className="security-widget__title">
        <span aria-hidden="true">🔐</span> Информация о текущей сессии
      </h3>
      <dl className="security-widget__grid">
        {geoInfo.ip && (
          <div className="security-widget__item">
            <dt className="security-widget__label">IP-адрес</dt>
            <dd className="security-widget__value">
              <code>{geoInfo.ip}</code>
            </dd>
          </div>
        )}
        {(geoInfo.city || geoInfo.country) && (
          <div className="security-widget__item">
            <dt className="security-widget__label">Местоположение</dt>
            <dd className="security-widget__value">
              {[geoInfo.city, geoInfo.region, geoInfo.country]
                .filter(Boolean)
                .join(', ')}
              {geoInfo.country_code && (
                <span className="security-widget__flag">
                  {' '}({geoInfo.country_code})
                </span>
              )}
            </dd>
          </div>
        )}
        {geoInfo.timezone && (
          <div className="security-widget__item">
            <dt className="security-widget__label">Часовой пояс</dt>
            <dd className="security-widget__value">{geoInfo.timezone}</dd>
          </div>
        )}
        {geoInfo.isp && (
          <div className="security-widget__item">
            <dt className="security-widget__label">Провайдер</dt>
            <dd className="security-widget__value">{geoInfo.isp}</dd>
          </div>
        )}
      </dl>
      <p className="security-widget__hint">
        Если вы не узнаёте это местоположение — смените пароль
      </p>
    </aside>
  );
};

export default SecurityWidget;
