# Implementation Plan — Video Chat Room

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-09-15 |
| **Status** | Draft |
| **Feature** | video-chat-room |
| **Based on** | PRD: `docs/prd-video-chat-room.md` v1.0, TDD: `prds/video-chat-room/design-video-chat-room.md` v1.0 |

> Каждая задача рассчитана на ≤ 1 рабочий день и оформляется одним MR/PR.
> `_Requirements_` ссылается на нумерованные требования PRD раздел 4 (F-XX или № пункта); `_Design_` — на разделы TDD (1–14).
> Требования без F-префикса в PRD обозначены как «п.N» (номер пункта в разделе 4 PRD).

---

## Легенда требований PRD

**Функциональные (раздел 4 PRD):**
- F-01..F-18 — пронумерованные требования тест-задания
- п.5, п.6, п.8, п.9, п.13, п.14, п.16, п.18, п.19, п.20, п.24, п.28, п.29, п.30, п.32, п.33, п.34, п.35, п.36, п.37, п.38, п.39, п.40 — требования без F-префикса

**Нефункциональные (разделы 6, 7 PRD):**
- NFR-PERF — задержка ≤500ms, 720p @ 30fps
- NFR-COMPAT — Chrome/Firefox/Edge 100+, desktop ≥1024px
- NFR-SEC — XSS защита, валидация, HTTPS
- NFR-UX — русский язык, адаптивная раскладка

---

## Инициализация репозитория

- [ ] 0. **Инициализация git-репозитория**
  - Завести git до написания кода, чтобы каждая задача попадала в историю отдельным коммитом/PR
  - Перед всеми остальными задачами
  - 0.1. `git init`, создать корневой `.gitignore` (`node_modules/`, `dist/`, `.env`, `certs/`, `*.pem`)
  - 0.2. Первичный коммит с текущей документацией (`docs/`, `prds/`)
  - 0.3. Договорённость о рабочем процессе: одна задача плана = одна ветка + один PR/коммит; заголовок коммита ссылается на номер задачи (например, `feat(server): task 1 — init server`)
  - _Requirements: —, Design: 12 (Deployment)_

---

## Backend

- [ ] 1. **Инициализация проекта сервера**
  - Настроить структуру `server/`, зависимости, базовый HTTPS + Express + Socket.io сервер
  - Архитектура **MVC + сервисный слой**: `config/` (конфигурация из .env), `models/` (модели данных), `services/` (бизнес-логика), `controllers/` (REST + WebSocket), `routes/` (Express-роуты), `infrastructure/` (логгер, SSL, rate limiter), `validation/`, `setup/` (сборка приложения)
  - 1.1. Создать `server/` со структурой (`src/config`, `src/models`, `src/services`, `src/controllers`, `src/routes`, `src/infrastructure`, `src/validation`, `src/setup`, `tests/`), инициализировать `package.json`
  - 1.2. Установить зависимости: `express`, `socket.io`, `dotenv`, `winston`
  - 1.3. `config/index.js` — единый объект `config` из `.env`: port, corsOrigin, ssl (certPath/keyPath), logLevel, socketIO (`pingTimeout: 20000`, `pingInterval: 25000`). Зависит от задачи 25 (сначала сертификаты)
  - 1.4. `infrastructure/ssl.js` (загрузка сертификатов по путям из .env), `infrastructure/logger.js` (winston, уровень из .env)
  - 1.5. `setup/app.js` — единая точка сборки (`createApp()`): Express + health-check `GET /health`, REST-роуты, HTTPS-сервер, Socket.io, подключение контроллеров
  - 1.6. `server.js` — только запуск: `server.listen()` + graceful shutdown (SIGTERM)
  - _Requirements: F-06, NFR-COMPAT, Design: 3, 4 (server.js), 8 (heartbeat), 12_

- [ ] 2. **Модели и RoomService (models + services)**
  - Реализовать модели данных и бизнес-логику управления комнатами в памяти
  - После задачи 1
  - 2.1. `models/Participant.js` — класс `Participant` (socketId, userName, `mediaState: {audio, video}` по умолчанию true, `updateMediaState`, `toJSON`)
  - 2.2. `models/Room.js` — класс `Room` (participants `Map`, chatHistory, `addParticipant`, `removeParticipant`, `isFull` (лимит 4), `isEmpty`, `addChatMessage`, `toJSON`)
  - 2.3. `services/RoomService.js` — `rooms: Map<roomId, Room>`; `createRoom`, `getOrCreateRoom`, `deleteRoom`, `roomExists`
  - 2.4. `addParticipant(roomId, socketId, userName)` — атомарная проверка лимита `< 4`, возврат `{success, room, participant, error}`
  - 2.5. `removeParticipant(roomId, socketId)` — удаление участника, `shouldDeleteRoom` (последний вышел), удаление комнаты
  - 2.6. `updateMediaState`, `addChatMessage`, `getChatHistory`
  - _Requirements: F-05, п.5, п.8, п.9, п.30, п.32, Design: 4 (models, RoomService), 5, 7_

- [ ] 3. **Валидация и XSS-защита (Backend)**
  - Реализовать валидацию входных данных и санитизацию для защиты от XSS
  - После задачи 1
  - 3.1. Директория `validation/` с разбивкой по доменным областям: `userName.js`, `roomId.js`, `message.js` + общий реэкспорт `index.js`. Регулярки: `userName` `/^[\p{L}\p{N} _-]{1,30}$/u`, `roomId` (UUID v4), `message` (1..1000 символов, trim)
  - 3.2. Переиспользуемые константы вынесены в `validation/constants.js` (паттерны, лимиты длины, опции DOMPurify), локализованные сообщения об ошибках — в `validation/messages.js` (русский язык)
  - 3.3. Функция `sanitizeUserName` (DOMPurify/isomorphic-dompurify)
  - 3.4. Санитизация текста сообщений перед сохранением в историю
  - 3.5. Функции `processUserName` / `processMessage` — комплексная обработка (санитизация + валидация) с единым возвращаемым контрактом `{valid, value?, error?}`
  - _Requirements: п.38, п.39, п.24, п.40, NFR-SEC, Design: 6 (validation), 10_

- [ ] 4. **REST API комнат (RoomController + routes)**
  - HTTP-эндпоинты для управления комнатами до входа (Express)
  - После задач 2, 3
  - 4.1. `controllers/RoomController.js` — `POST /api/rooms` (создать комнату, вернуть `{roomId, createdAt}`), `GET /api/rooms/:roomId` (`{exists, participantCount, isFull}` или 404), `GET /api/rooms/:roomId/participants` (список или 404)
  - 4.2. `routes/api.js` — Express Router, подключение к `/api` в `setup/app.js`
  - 4.3. Обработка ошибок и статус-коды (201, 400, 404, 500)
  - _Requirements: F-02, F-04, F-16, Design: 6 (REST API), 7_

- [ ] 5. **WebSocket контроллер: вход/выход + чат (SocketController)**
  - Клиент подключается к Socket.io ТОЛЬКО при входе в комнату; параметры входа в `handshake.query`
  - После задач 2, 3
  - 5.1. `controllers/SocketController.js` — `handleConnection`: валидация `roomId`/`userName` из query → лимит → добавление → `room-joined {participants, chatHistory}` или `error` + disconnect
  - 5.2. Broadcast `user-joined` остальным; системные сообщения о входе/выходе (`type: 'system'`)
  - 5.3. `handleDisconnect` — удаление участника, broadcast `user-left`, удаление комнаты при выходе последнего
  - 5.4. Обработчик `chat-message`: валидация, санитизация, добавление в историю, broadcast `{from, fromName, message, timestamp}` всем
  - 5.5. Rate limiting (`infrastructure/RateLimiter.js`): 5 сообщений/сек на socketId; при превышении — `emit error {type: 'rate-limit'}` отправителю
  - 5.6. Обработчик `media-state`: обновление состояния, broadcast `media-state-changed`
  - _Requirements: F-01, F-04, F-12, F-13, F-14, F-16, F-17, F-18, п.24, п.28, п.29, п.35, п.40, Design: 6, 7, 8 (disconnect), 10 (rate limiting)_

- [ ] 6. **WebSocket контроллер: WebRTC сигналинг**
  - Ретрансляция offer/answer/ice-candidate между конкретными участниками
  - После задачи 5
  - 6.1. Обработчик `offer`: relay `{from, sdp}` → `targetSocketId`
  - 6.2. Обработчик `answer`: relay `{from, sdp}` → `targetSocketId`
  - 6.3. Обработчик `ice-candidate`: relay `{fromSocketId, candidate}` → `targetSocketId`
  - 6.4. Валидация `targetSocketId`: должен быть в той же комнате, что и отправитель — иначе игнорировать и `emit error`
  - _Requirements: F-06, Design: 4, 6, 7_

- [ ] 7. **Socket.io события: media-state-changed**
  - Broadcast изменения состояния микрофона/камеры участника
  - После задачи 4
  - 7.1. Обработчик `media-state-changed`: сервер только транслирует событие. `mediaState` НЕ хранится на сервере — сервер stateless по этому полю (актуальное состояние клиенты получают из broadcast)
  - 7.2. Broadcast `{socketId, kind, enabled}` остальным в комнате
  - _Requirements: F-09, F-10, п.16, п.18, Design: 4 (media-state-changed), 6_

---

## Frontend

- [ ] 8. **Инициализация React проекта**
  - Настроить структуру `client/`, Vite, React Router, базовые стили
  - 8.1. Создать `client/` через Vite (`react` template), структура `components/`, `hooks/`, `utils/`
  - 8.2. Установить зависимости: `react-router-dom`, `socket.io-client`
  - 8.3. Настроить `vite.config.js` (HTTPS для dev, proxy для API)
  - 8.4. Настроить роутинг: `/` → StartScreen, `/room/:roomId` → RoomScreen
  - 8.5. Проверка поддержки WebRTC при загрузке (`window.RTCPeerConnection`)
  - _Requirements: F-02, F-04, п.36, NFR-COMPAT, Design: 4, 8 (нет WebRTC), 12_

- [ ] 9. **StartScreen компонент**
  - Экран ввода имени, создания комнаты и входа по ссылке
  - После задачи 8
  - 9.1. Поле ввода имени с клиентской валидацией (≤30, регулярка, не пустое)
  - 9.2. Кнопка «Создать комнату» → генерация roomId (UUID v4) → navigate `/room/:roomId`
  - 9.3. Подсказки при ошибках валидации (пустое имя, спецсимволы)
  - _Requirements: F-01, F-02, п.38, NFR-UX, Design: 4 (StartScreen), 6 (валидация)_

- [ ] 10. **Socket.io клиент и хук useSocket**
  - Подключение к серверу, обработка ошибок соединения
  - После задачи 8
  - 10.1. `useSocket` хук: инициализация socket.io-client, подключение к комнате с параметрами `{roomId, userName}` в query (подключение происходит только при входе в комнату)
  - 10.2. Обработка `connect_error` → сообщение «Сервер недоступен» (retry 3 раза)
  - 10.3. Обработка события `room-joined` (участники, история чата) и `error` (validation/room-full)
  - _Requirements: п.35, Design: 4, 6, 8 (недоступность сервера)_

- [ ] 11. **RoomScreen layout**
  - Основной экран комнаты, координация дочерних компонентов и состояния
  - После задач 9, 10
  - 11.1. Layout: видеосетка + панель управления + чат/список участников
  - 11.2. Запрос имени, если открыт `/room/:roomId` напрямую (без имени)
  - 11.3. Подключение к WebSocket с `{roomId, userName}`, обработка `room-joined` (участники, история)
  - 11.4. Кнопка копирования ссылки-приглашения в буфер обмена + подтверждение
  - 11.5. Состояние участников (список, обновление в реальном времени)
  - _Requirements: F-03, F-04, F-16, п.5, п.6, NFR-UX, Design: 4 (RoomScreen), 7_

- [ ] 12. **VideoGrid и VideoTile**
  - Адаптивная сетка видео (1–4) с overlay имени и индикаторами
  - После задачи 11
  - 12.1. `VideoGrid` — адаптивная раскладка (1×1, 1×2, 2×2) под число участников
  - 12.2. `VideoTile` — video-элемент, self-view отдельно, оверлей с именем
  - 12.3. Заглушка (силуэт + имя) при выключенной/отсутствующей камере
  - 12.4. Иконка перечёркнутого микрофона при выключенном audio
  - 12.5. Оптимизация `React.memo` для VideoTile
  - _Requirements: F-07, F-08, п.16, п.18, NFR-PERF, NFR-UX, Design: 4, 9 (React.memo)_

- [ ] 13. **MediaManager**
  - Управление локальными медиа-устройствами (getUserMedia, toggle)
  - После задачи 8
  - 13.1. Класс `MediaManager`: `getUserMedia(constraints)` с default 720p @ 30fps
  - 13.2. `toggleAudio(enabled)` — `track.enabled`
  - 13.3. `toggleVideo(enabled)` — `track.enabled = false/true`; track НЕ останавливается (stop ломает RTCPeerConnection и удалённый `ontrack`). Если нужно освободить устройство — вынести в отдельную задачу с `sender.replaceTrack()`
  - 13.4. Вход без физических устройств — присоединение с выключенными устройствами
  - _Requirements: F-06, F-09, F-10, п.13, п.14, п.19, Design: 4 (MediaManager), 7, 9_

- [ ] 14. **PeerConnectionManager**
  - Управление RTCPeerConnection для каждого участника
  - После задачи 13
  - 14.1. Класс `PeerConnectionManager`: `createPeerConnection(socketId, isInitiator)` с STUN конфигом
  - 14.2. `createOffer` / `handleOffer` / `handleAnswer` — SDP обмен. Условие: если `isInitiator === true` — `createOffer` сразу; если `false` — ждать входящий offer через `handleOffer`
  - 14.3. `handleIceCandidate` — добавление ICE candidates
  - 14.4. `addTrack` локального stream, обработка `ontrack` для remote stream
  - 14.5. `closePeerConnection` / `closeAllConnections` — очистка при выходе
  - _Requirements: F-06, Design: 4 (PeerConnectionManager), 7_

- [ ] 15. **Controls компонент**
  - Панель управления: микрофон, камера, выход
  - После задач 12, 13
  - 15.1. Кнопки toggle микрофона и камеры с индикацией состояния
  - 15.2. Кнопка «Выйти» → leave-room, очистка соединений, navigate `/`
  - 15.3. Вызов `media-state-changed` при переключении
  - _Requirements: F-09, F-10, F-17, п.16, п.18, п.19, Design: 4, 6, 7_

- [ ] 16. **Chat компонент**
  - Панель текстового чата с историей и отправкой
  - После задачи 11
  - 16.1. Отображение истории сообщений (имя, время HH:MM, текст) + системные сообщения
  - 16.2. Поле ввода + отправка (Enter/кнопка), блокировка пустых сообщений
  - 16.3. Автопрокрутка к последнему сообщению
  - 16.4. Рендер сообщений через React (авто-экранирование XSS)
  - _Requirements: F-12, F-13, F-14, F-15, п.24, п.39, NFR-SEC, Design: 4 (Chat), 7, 10_

- [ ] 17. **Обработка ошибок UI**
  - Экраны и сообщения для крайних случаев
  - После задач 11, 13
  - 17.1. Экран «Комната заполнена» (при error `room-full`) с кнопкой «Повторить»
  - 17.2. Сообщение при отказе в доступе к камере/микрофону (остаться в комнате без медиа)
  - 17.3. Сообщение «WebRTC не поддерживается» (несовместимый браузер)
  - 17.4. Обработка autoplay policy — жест пользователя для воспроизведения remote audio
  - _Requirements: п.8, п.33, п.36, п.37, п.14, Design: 8 (edge cases)_

---

## Интеграция WebRTC

- [ ] 18. **WebRTC handshake flow (координация)**
  - Связать сигналинг сервера с PeerConnectionManager по правилу против glare
  - После задач 6, 14
  - 18.1. При входе новый участник создаёт offer для КАЖДОГО существующего (initiator)
  - 18.2. Существующие участники ТОЛЬКО отвечают (answer) — правило против glare
  - 18.3. Обработка `user-joined` / `user-left` → создание/закрытие соединений
  - 18.4. Проверка задержки медиа ≤500ms в локальной сети
  - 18.5. PC между существующими участниками НЕ пересоздаётся при входе нового — создаются только новые связи с новым участником
  - _Requirements: F-06, F-07, NFR-PERF, Design: 7 (glare rule, sequenceDiagram), 9_

- [ ] 19. **ICE connection states**
  - Обработка состояний соединения и UI-индикаторы
  - После задачи 18
  - 19.1. `iceConnectionState === 'failed'` → «Соединение потеряно», предложить перезайти
  - 19.2. `iceConnectionState === 'disconnected'` → индикатор, ждать 5 сек, при восстановлении скрыть
  - 19.3. Корректная обработка недоступности STUN (не ломать приложение)
  - _Requirements: F-18, п.34, Design: 8 (ICE states)_

- [ ] 20. **MediaStreamTrack.onended**
  - Обработка потери устройства во время звонка
  - После задач 13, 15
  - 20.1. Обработчик `track.onended` → выключить соответствующий контрол в UI
  - 20.2. Разослать `media-state-changed` (enabled: false)
  - _Requirements: п.20, п.33, Design: 8 (MediaStreamTrack.onended)_

---

## Тестирование

- [ ] 21. **Unit-тесты Backend (модели, сервис)**
  - Покрыть тестами серверную логику, цель 80% coverage
  - После задач 2, 3
  - 21.1. Models: `Room` (добавление/удаление участников, isFull/isEmpty, chat), `Participant` (mediaState, toJSON); `RoomService`: создание, вход, лимит 4 (отклонение 5-го), удаление комнаты
  - 21.2. Валидация покрывается косвенно через integration-тесты контроллеров; отдельные unit-тесты модуля `validation/` не пишем (решение по итогам ревью)
  - 21.3. Настроить Vitest (нативная поддержка ESM), скрипт `npm test`, coverage report. Альтернатива: Jest с `--experimental-vm-modules` для ESM
  - 21.4. Соглашение по тестам: файлы располагаются в `server/tests/` БЕЗ суффикса `.test.` в имени; структура папки `tests/` зеркалит слои `src/` (например, `src/models/Room.js` → `tests/models/Room.js`, `src/services/RoomService.js` → `tests/services/RoomService.js`, `src/controllers/SocketController.js` → `tests/controllers/SocketController.js`). `vitest.config.js` настроен с `include: ['tests/**/*.js']`
  - _Requirements: F-05, п.8, п.9, п.24, п.38, Design: 11 (Unit tests)_

- [ ] 22. **Integration-тесты (REST API + Socket.io)**
  - Проверить сценарии событий через socket.io-client и HTTP fetch
  - После задач 4, 5, 6, 7
  - 22.1. REST API (`RoomController`): создание комнаты, получение информации, список участников, 404
  - 22.2. WebSocket: вход 4 участников, отклонение 5-го (error `room-full`)
  - 22.3. Обмен сообщениями в чате, broadcast user-joined/user-left, media-state-changed
  - 22.4. Relay WebRTC signaling, выход последнего → удаление комнаты
  - 22.5. Проверка обработки `disconnect` (broadcast user-left, удаление комнаты)
  - _Requirements: F-05, F-12, F-16, F-17, F-18, п.9, Design: 11 (Integration tests)_

- [ ] 23. **E2E тесты (Playwright)**
  - Автоматизировать ключевые пользовательские сценарии
  - После задач 15, 16, 17
  - 23.1. Настроить Playwright: два browser context одновременно; флаги Chrome `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`; проверка обоих концов соединения
  - 23.2. Создание комнаты и копирование ссылки
  - 23.3. Вход по ссылке-приглашению, отображение видео
  - 23.4. Отправка/получение сообщений в чате
  - 23.5. Toggle микрофона и камеры, выход из комнаты
  - _Requirements: F-01, F-02, F-03, F-07, F-12, F-17, Design: 11 (E2E tests)_

- [ ] 24. **Мануальное тестирование WebRTC**
  - Проверить видео/аудио в целевых браузерах и NAT-сценариях
  - После задачи 18
  - 24.1. Тест-матрица: Chrome/Firefox/Edge 100+ (video/audio/ICE)
  - 24.2. Сценарии: одна локальная сеть, разные сети (STUN), без камеры/микрофона
  - 24.3. Визуальная оценка отсутствия заметной задержки (точное измерение ≤500ms — out of scope MVP), документирование результатов
  - _Requirements: F-06, п.14, п.34, NFR-COMPAT, NFR-PERF, Design: 11 (WebRTC testing)_

---

## DevOps / Инфраструктура

- [ ] 25. **HTTPS dev окружение**
  - Настроить локальные сертификаты для HTTPS (обязателен для getUserMedia)
  - После задачи 1
  - 25.1. Генерация сертификатов через mkcert (`localhost`, `127.0.0.1`)
  - 25.2. Подключение сертификатов в server.js и vite.config.js
  - 25.3. Документировать setup в README
  - _Requirements: NFR-SEC, NFR-COMPAT, Design: 10 (HTTPS), 12_

- [ ] 26. **Environment variables**
  - Вынести конфигурацию в .env файлы
  - После задач 1, 8
  - 26.1. Server `.env`: PORT, NODE_ENV, SSL пути, PING_TIMEOUT/INTERVAL, LOG_LEVEL
  - 26.2. Client `.env`: VITE_API_URL, VITE_STUN_SERVER, VITE_NODE_ENV
  - 26.3. Создать `.env.example` для обоих + добавить в .gitignore
  - _Requirements: NFR-SEC, Design: 12 (env vars)_

- [ ] 27. **Production build**
  - Настроить сборку и деплой (обязательно: рабочий запуск по README — требование задания)
  - После задач 1, 8, 26
  - 27.1. `npm run build` в client → статика в `client/dist`
  - 27.2. Сервер раздаёт статику + WebSocket endpoint
  - 27.3. PM2 ecosystem.config.js или Dockerfile
  - _Requirements: NFR-COMPAT, Design: 12 (deployment)_

---

## Документация

- [ ] 28. **README с инструкциями запуска**
  - Написать полную инструкцию установки и запуска
  - После задач 25, 26
  - 28.1. Установка зависимостей (client/server)
  - 28.2. Генерация HTTPS сертификатов (mkcert)
  - 28.3. Запуск dev (client + server), запуск production
  - 28.4. Структура проекта, описание env variables
  - _Requirements: NFR-COMPAT, Design: 12_

- [ ] 29. **Демо-видео**
  - Записать демонстрацию работы приложения
  - После задач 23, 24 (когда функциональность готова)
  - 29.1. Сценарий записи: создание комнаты → копирование ссылки → вход 2-4 участников
  - 29.2. Демонстрация: видео/аудио, чат, toggle mic/camera, выход
  - 29.3. Демонстрация крайних случаев: комната заполнена, отказ getUserMedia
  - _Requirements: F-01..F-18 (демонстрация), Design: 1_

---

**Итого: 30 задач** (Репозиторий: 1, Backend: 7, Frontend: 10, WebRTC: 3, Тесты: 4, DevOps: 3, Документация: 2)

**Критический путь:** 0 (git) → (25 HTTPS ‖ 1 server ‖ 8 client) → 2/3 → 4 → 5/6/7 (Backend) ‖ 10/13 → 11/14 → 12/15/16/17 (Frontend) → 18 → 19/20 (WebRTC integration) → 21/22/23/24 (Tests) → 27 (build) → 28/29 (Docs)

> Примечание: задача 25 (HTTPS-сертификаты) выполняется параллельно с 1 и 8, но задача 1.3 (HTTPS-сервер) зависит от 25 — сертификаты должны существовать до запуска HTTPS-сервера.
