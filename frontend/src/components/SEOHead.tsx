/**
 * SEOHead — компонент управления мета-тегами документа.
 *
 * Задание 2 (Лаб. 4):
 *   2.3 — динамические мета-теги (title, description) для каждой страницы
 *   2.4 — canonical URL для исключения дублей контента
 *   2.5 — Open Graph / social meta для предпросмотра ссылок
 *
 * Не использует react-helmet-async (чтобы не добавлять зависимость):
 * управляет DOM напрямую через useEffect.
 *
 * Использование:
 *   <SEOHead title="Загрузка" description="Обработка изображений" />
 *   <SEOHead noIndex={true} />   ← для закрытых страниц
 */
import { useEffect } from 'react';

const BASE_TITLE = 'DataCleaner';
const BASE_URL = process.env.REACT_APP_SITE_URL || 'http://localhost:3000';
const DEFAULT_DESCRIPTION =
  'DataCleaner — сервис автоматической анонимизации изображений с AI-распознаванием лиц. ' +
  'Защитите персональные данные на фотографиях.';
const DEFAULT_OG_IMAGE = `${BASE_URL}/logo192.png`;

interface SEOHeadProps {
  /** Заголовок страницы (будет: "{title} | DataCleaner") */
  title?: string;
  /** Мета-описание страницы */
  description?: string;
  /** Canonical URL (по умолчанию: BASE_URL + текущий путь) */
  canonical?: string;
  /** Запретить индексацию (noindex, nofollow) — для закрытых страниц */
  noIndex?: boolean;
  /** OG-заголовок (по умолчанию = title) */
  ogTitle?: string;
  /** OG-описание (по умолчанию = description) */
  ogDescription?: string;
  /** OG-изображение */
  ogImage?: string;
  /** JSON-LD структурированные данные для страницы */
  jsonLd?: object;
}

const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  canonical,
  noIndex = false,
  ogTitle,
  ogDescription,
  ogImage,
  jsonLd,
}) => {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
    const desc = description || DEFAULT_DESCRIPTION;
    const canonicalUrl =
      canonical || `${BASE_URL}${window.location.pathname}`;
    const ogImg = ogImage || DEFAULT_OG_IMAGE;

    // ── <title> ───────────────────────────────────────────────────────────
    document.title = fullTitle;

    // ── robots ────────────────────────────────────────────────────────────
    setMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    // ── description ───────────────────────────────────────────────────────
    setMeta('name', 'description', desc);

    // ── canonical ─────────────────────────────────────────────────────────
    setLink('canonical', canonicalUrl);

    // ── Open Graph ────────────────────────────────────────────────────────
    setMeta('property', 'og:title', ogTitle || fullTitle);
    setMeta('property', 'og:description', ogDescription || desc);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', ogImg);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', BASE_TITLE);
    setMeta('property', 'og:locale', 'ru_RU');

    // ── Twitter Card ──────────────────────────────────────────────────────
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', ogTitle || fullTitle);
    setMeta('name', 'twitter:description', ogDescription || desc);
    setMeta('name', 'twitter:image', ogImg);

    // ── JSON-LD ───────────────────────────────────────────────────────────
    if (jsonLd) {
      let script = document.querySelector(
        'script[data-seo-jsonld]'
      ) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-seo-jsonld', 'true');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }

    // Cleanup: сбрасываем на дефолтные значения при размонтировании
    return () => {
      document.title = BASE_TITLE;
      setMeta('name', 'robots', 'index, follow');
    };
  }, [title, description, canonical, noIndex, ogTitle, ogDescription, ogImage, jsonLd]);

  // Компонент не рендерит ничего в DOM
  return null;
};

// ── Утилиты управления DOM ────────────────────────────────────────────────────

/** Создаёт или обновляет <meta> тег */
function setMeta(attrName: string, attrValue: string, content: string): void {
  let el = document.querySelector(
    `meta[${attrName}="${attrValue}"]`
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Создаёт или обновляет <link> тег */
function setLink(rel: string, href: string): void {
  let el = document.querySelector(
    `link[rel="${rel}"]`
  ) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.href = href;
}

export default SEOHead;
