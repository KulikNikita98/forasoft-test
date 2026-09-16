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

> ⚠️ **Сертификаты обязательны.** WebRTC (`getUserMedia`) работает только по HTTPS.
> Без сертификатов в `server/certs/` **не запустится ни dev-режим, ни сборка** —
> `vite.config.js` читает их синхронно при любой команде (`dev`, `build`, `preview`),
> а сервер читает их при старте. Поэтому шаг 2 нельзя пропускать.

### 1. Установка зависимостей

```bash
# Клиент
cd client
npm install

# Сервер
cd ../server
npm install
```

### 2. SSL-сертификаты (обязательный шаг)

WebRTC требует HTTPS даже в dev-режиме. И клиент (Vite), и сервер читают одни и те же
mkcert-сертификаты из `server/certs/`:

- `server/certs/localhost+2.pem` — сертификат
- `server/certs/localhost+2-key.pem` — приватный ключ

Сгенерировать их:

```bash
# Установить mkcert (если ещё нет)
# Windows (chocolatey): choco install mkcert
# macOS: brew install mkcert
# Linux: см. https://github.com/FiloSottile/mkcert

cd server
mkcert -install          # один раз: добавляет локальный CA в доверенные
mkdir -p certs
cd certs
mkcert localhost 127.0.0.1 ::1
# → создаст localhost+2.pem и localhost+2-key.pem в server/certs/
```

> Имена файлов (`localhost+2*.pem`) должны совпадать с дефолтами в
> `client/vite.config.js` и `server/.env`. Если генерируете сертификаты с другими
> именами — обновите `SSL_CERT_PATH` / `SSL_KEY_PATH` в `server/.env` и пути в
> `client/vite.config.js`.

### 3. Конфигурация окружения

Оба `.env` опциональны — у клиента и сервера есть рабочие дефолты.

```bash
# server/.env
cp server/.env.example server/.env
# Основные параметры:
# PORT=3000
# NODE_ENV=development
# CORS_ORIGIN=https://localhost:5173
# SSL_CERT_PATH / SSL_KEY_PATH — пути к mkcert-сертификатам

# client/.env
cp client/.env.example client/.env
# Основные параметры:
# VITE_API_BASE_URL=https://localhost:3000
# VITE_WS_URL=https://localhost:3000
# VITE_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
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

> ⚠️ Сертификаты из шага 2 нужны и для сборки: `npm run build` вызывает Vite,
> который читает `server/certs/*.pem` при старте. Без них сборка упадёт с
> `ENOENT: no such file or directory ... localhost+2-key.pem`.

```bash
# Из папки server/ — одной командой
cd server
npm run serve
# → собирает клиент в client/dist и запускает сервер в production-режиме
# Всё доступно на https://localhost:3000
```

В production (`NODE_ENV=production`) сервер:
- раздаёт собранную статику из `client/dist`
- обслуживает SPA-fallback (любой маршрут → `index.html`)
- обслуживает REST API (`/api`) и WebSocket (Socket.io)

Скрипты сервера:
- `npm start` — запуск сервера из `src/server.js`
- `npm run start:prod` — запуск с `NODE_ENV=production`
- `npm run dev` — режим разработки с авто-перезагрузкой (--watch)
- `npm run build` — сборка клиента (`client/dist`)
- `npm run serve` — build + start:prod (полный production-запуск)
- `npm test` — запуск Vitest тестов

## Troubleshooting

**`ENOENT: no such file or directory ... localhost+2-key.pem`** (при `npm run dev`,
`build` или старте сервера)
→ Сертификаты не сгенерированы. Выполните шаг 2 «SSL-сертификаты».

**Браузер ругается на небезопасное соединение / `NET::ERR_CERT_AUTHORITY_INVALID`**
→ Не выполнен `mkcert -install` (локальный CA не в доверенных). Запустите его и
перезапустите браузер.

**Камера/микрофон не запрашиваются, `getUserMedia` недоступен**
→ Убедитесь, что открыли именно `https://localhost:5173` (не `http://`) —
WebRTC работает только в защищённом контексте.

**Сертификаты сгенерированы с другими именами**
→ Обновите `SSL_CERT_PATH` / `SSL_KEY_PATH` в `server/.env` и пути в
`client/vite.config.js`, чтобы они указывали на ваши файлы.

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
