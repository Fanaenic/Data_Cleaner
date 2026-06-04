/**
 * Тесты компонента SEOHead — управление мета-тегами документа.
 */
import React from 'react';
import { render } from '@testing-library/react';
import SEOHead from '../components/SEOHead';

describe('SEOHead', () => {
  afterEach(() => {
    // Сбрасываем title после каждого теста
    document.title = '';
    // Удаляем добавленные мета-теги
    document.querySelectorAll('meta[name="description"]').forEach(el => el.remove());
    document.querySelectorAll('meta[name="robots"]').forEach(el => el.remove());
    document.querySelectorAll('link[rel="canonical"]').forEach(el => el.remove());
    document.querySelectorAll('script[data-seo-jsonld]').forEach(el => el.remove());
    document.querySelectorAll('meta[property="og:title"]').forEach(el => el.remove());
  });

  test('устанавливает заголовок документа', () => {
    render(<SEOHead title="Тестовая страница" />);
    expect(document.title).toBe('Тестовая страница | DataCleaner');
  });

  test('устанавливает заголовок по умолчанию без title', () => {
    render(<SEOHead />);
    expect(document.title).toBe('DataCleaner');
  });

  test('устанавливает meta description', () => {
    render(<SEOHead description="Описание тестовой страницы" />);
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(meta).not.toBeNull();
    expect(meta.content).toBe('Описание тестовой страницы');
  });

  test('устанавливает noindex для закрытых страниц', () => {
    render(<SEOHead noIndex={true} />);
    const meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    expect(meta).not.toBeNull();
    expect(meta.content).toBe('noindex, nofollow');
  });

  test('устанавливает index, follow по умолчанию', () => {
    render(<SEOHead noIndex={false} />);
    const meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    expect(meta).not.toBeNull();
    expect(meta.content).toBe('index, follow');
  });

  test('устанавливает canonical URL', () => {
    render(<SEOHead canonical="http://localhost:3000/login" />);
    const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    expect(link).not.toBeNull();
    expect(link.href).toBe('http://localhost:3000/login');
  });

  test('устанавливает OG title', () => {
    render(<SEOHead ogTitle="OG Заголовок" />);
    const meta = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
    expect(meta).not.toBeNull();
    expect(meta.content).toBe('OG Заголовок');
  });

  test('добавляет JSON-LD скрипт', () => {
    const jsonLd = { '@type': 'WebPage', name: 'Test' };
    render(<SEOHead jsonLd={jsonLd} />);
    const script = document.querySelector('script[data-seo-jsonld]');
    expect(script).not.toBeNull();
    expect(script?.textContent).toContain('WebPage');
  });

  test('компонент не рендерит DOM-элементы', () => {
    const { container } = render(<SEOHead title="Test" />);
    expect(container.firstChild).toBeNull();
  });

  test('сбрасывает title при размонтировании', () => {
    const { unmount } = render(<SEOHead title="Временная страница" />);
    expect(document.title).toBe('Временная страница | DataCleaner');
    unmount();
    expect(document.title).toBe('DataCleaner');
  });
});
