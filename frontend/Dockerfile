# ── Этап 1: Сборка React-приложения ─────────────────────────────────────────
FROM node:20-alpine AS builder
LABEL stage="builder"

WORKDIR /app

# Копируем package.json отдельно для кэширования зависимостей
COPY package*.json ./
RUN npm ci --prefer-offline

# Копируем исходный код и собираем
COPY . .
RUN npm run build

# ── Этап 2: Веб-сервер nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Копируем собранное приложение в nginx
COPY --from=builder /app/build /usr/share/nginx/html

# Конфигурация nginx для React Router (SPA)
COPY nginx.spa.conf /etc/nginx/nginx.conf

EXPOSE 80

# Проверка работоспособности
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/health.txt || exit 1

CMD ["nginx", "-g", "daemon off;"]
