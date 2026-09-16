# Video Chat Room

WebRTC видеочат с mesh-топологией (P2P), поддержкой до 4 участников, текстовым чатом и управлением медиа-устройствами.

## Технологии

**Frontend:**
- React 19 + Vite
- Tailwind CSS
- Socket.io-client
- WebRTC API

**Backend:**
- Node.js + Express 5
- Socket.io
- HTTPS (mkcert для локальной разработки)

## Быстрый старт

### 1. Установка зависимостей

```bash
# Клиент
cd client
npm install

# Сервер
cd ../server
npm install
```

### 2. Настройка SSL-сертификатов (для локальной разработки)

WebRTC требует HTTPS даже в dev-режиме:

```bash
# Установить mkcert (если ещё нет)
# Windows (chocolatey): choco install mkcert
# macOS: brew install mkcert
# Linux: см. https://github.com/FiloSottile/mkcert

cd server
mkcert -install
mkcert localhost 127.0.0.1 ::1
# → создаст localhost+2.pem и localhost+2-key.pem в server/certs/
```

### 3. Конфигурация окружения

```bash
# server/.env (опционально, есть дефолты)
cp server/.env.example server/.env

# Основные параметры:
# PORT=3000
# NODE_ENV=development
# CORS_ORIGIN=https://localhost:5173
```

### 4. Запуск в dev-режиме

**Терминал 1 — сервер:**
```bash
cd server
npm run dev
# → https://localhost:3000
```

**Терминал 2 — клиент:**
```bash
cd client
npm run dev
# → https://localhost:5173
```

Откройте **https://localhost:5173** в браузере (Chrome/Edge рекомендуется).

## Production

### Сборка и запуск

```bash
# Из корня проекта или из server/
cd server
npm run serve
# → собирает клиент в client/dist и запускает сервер в production-режиме
# Всё доступно на https://localhost:3000
```

Скрипты сервера:
- `npm start` — запуск сервера из `src/server.js`
- `npm run start:prod` — запуск с `NODE_ENV=production`
- `npm run dev` — режим разработки с авто-перезагрузкой (--watch)
- `npm run build` — сборка клиента (`client/dist`)
- `npm run serve` — build + start:prod (полный production-запуск)
- `npm test` — запуск Vitest тестов

## Тестирование

```bash
# Сервер (Vitest)
cd server
npm test

# Клиент (Vitest + React Testing Library)
cd client
npm test
```

## Архитектура

### Backend (MVC + Service Layer)
```
server/src/
├── controllers/    # HTTP (RoomController) + WebSocket (SocketController)
├── services/       # Бизнес-логика (RoomService)
├── routes/         # Express роутеры
├── infrastructure/ # SSL, logger (Winston)
├── config/         # Конфигурация из .env
└── server.js       # Точка входа
```

### Frontend (React Hooks)
```
client/src/
├── components/     # UI (сгруппированы по домену: common, room, video, chat, controls, participant)
├── hooks/          # useMedia, useWebRTC, useSocket
├── services/       # api.js (REST-клиент)
├── utils/          # validation, webrtcSupport
└── config/         # Конфигурация из import.meta.env
```

## Основные фичи

- ✅ **WebRTC mesh-топология**: P2P видео/аудио между участниками
- ✅ **Socket.io signaling**: обмен SDP offer/answer, ICE-кандидатами
- ✅ **Управление медиа**: включение/выключение микрофона и камеры
- ✅ **Текстовый чат**: сообщения с временными метками (XSS-защита)
- ✅ **Список участников**: онлайн-статус, индикаторы muted/video-off
- ✅ **Лимиты**: до 4 участников, имена до 30 символов
- ✅ **Доступность**: aria-labels, role attributes, keyboard-friendly

## Документация

Дизайн и план реализации в `prds/video-chat-room/`:
- `design-video-chat-room.md` — архитектура, технические решения
- `impl-video-chat-room.md` — детальный план задач по реализации
