/**
 * NotFound — страница 404.
 *
 * Задание 3.3 (Лаб. 4): корректный HTTP-статус для несуществующих страниц.
 * - noIndex=true: поисковики не индексируют страницу ошибки
 * - Семантическая разметка: <main>, <article>
 * - Ссылка возврата на главную страницу
 */
import React from 'react';
import { Link } from 'react-router-dom';
import SEOHead from './SEOHead';
import './NotFound.css';

const NotFound: React.FC = () => {
  return (
    <>
      {/* Запрещаем индексацию страницы 404 (задание 1.2) */}
      <SEOHead
        title="Страница не найдена (404)"
        description="Запрошенная страница не существует. Вернитесь на главную страницу DataCleaner."
        noIndex={true}
      />

      <main className="not-found" role="main">
        <article className="not-found__box" aria-labelledby="not-found-heading">
          <div className="not-found__code" aria-hidden="true">404</div>

          <h1 id="not-found-heading" className="not-found__title">
            Страница не найдена
          </h1>

          <p className="not-found__text">
            К сожалению, запрошенная страница не существует
            или была перемещена.
          </p>

          <nav className="not-found__nav" aria-label="Навигация возврата">
            <Link to="/" className="not-found__link">
              ← Вернуться на главную
            </Link>
          </nav>
        </article>
      </main>
    </>
  );
};

export default NotFound;
