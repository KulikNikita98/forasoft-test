# Technical Design Document — Video Chat Room

| | |
|---|---|
| **Version** | 2.5 |
| **Date** | 2026-09-16 |
| **Status** | In Progress |
| **Feature** | video-chat-room |
| **Based on** | PRD: `prds/video-chat-room/prd-video-chat-room.md` v1.0 |

### История версий

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 2026-09-15 | Первоначальная версия: слоистая архитектура, Socket.io `join-room` с acknowledgement |
| 2.0 | 2026-09-16 | Переход на **MVC + сервисный слой**; добавлен REST API (Express) для управления комнатами; вход в комнату через `handshake.query` при WebSocket-подключении вместо события `join-room`; единый объект конфигурации; структура тестов зеркалит слои `src/` |
| 2.1 | 2026-09-16 | После code review: (1) `Room.tryAddParticipant()` — атомарная проверка лимита 4 участников; (2) WebRTC signaling: проверка `targetSocketId` в той же комнате перед relay (требование 6.4); (3) TTL-очистка пустых комнат (защита от утечки памяти); (4) `roomId` генерируется через `crypto.randomUUID()` (UUID v4); (5) интеграционный тест REST→WebSocket |
| 2.2 | 2026-09-16 | Решения по frontend: структура `components/hooks/services/utils`, **Tailwind CSS** для стилей, тестирование Vitest + React Testing Library для компонентов и хуков; `services/api.js` — REST-клиент |
| 2.3 | 2026-09-16 | Frontend WebRTC: замена классов `MediaManager`/`PeerConnectionManager` на React hooks `useMedia`/`useWebRTC` для лучшей интеграции с компонентами и автоматической очистки ресурсов |
| 2.4 | 2026-09-16 | Упрощение раздела деплоя: убраны HTTPS setup (Let's Encrypt), CI/CD pipeline и PM2/Docker; актуализированы build/run скрипты (`npm run serve`, `start:prod`, production-раздача `client/dist` + SPA-fallback) |
| 2.5 | 2026-09-16 | Раздел тестирования (11): убраны E2E (Playwright) и ручная тест-матрица WebRTC как отдельные секции; добавлена секция Frontend Tests (компоненты + хуки, Vitest + RTL), отражающая фактическую реализацию |

---

## 1. Overview / Контекст

### Цель фичи
Веб-приложение для группового видеозвонка с текстовым чатом, рассчитанное на **до 4 участников одновременно**. Пользователь открывает приложение, вводит отображаемое имя, создаёт комнату и делится ссылкой-приглашением; остальные присоединяются по этой ссылке. Внутри комнаты все видят и слышат друг друга в реальном времени и могут переписываться в общем чате.

### Ссылка на PRD
`prds/video-chat-room/prd-video-chat-room.md` — Product Requirements Document v1.0

### Проблема
Небольшим группам нужен мгновенный способ созвониться «лицом к лицу» прямо в браузере — без регистрации, установки приложений и сложной настройки.

### Решение
Лёгкое приложение «зашёл по ссылке — представился — общаешься»: видео + аудио через WebRTC, текстовый чат и системные события через Socket.io, без авторизации и без серверного хранения истории.

### Ключевые ограничения
- **Технический стек (зафиксирован):** JavaScript ES6+, Node.js, React, Socket.io, WebRTC
- **Топология:** WebRTC mesh (P2P между всеми участниками)
- **Лимит участников:** строго 4 (проверка атомарная на сервере)
- **Хранение:** in-memory (без БД, без персистентного хранилища)
- **NAT traversal:** только Google STUN (без TURN)
- **HTTPS обязателен:** getUserMedia требует защищенный контекст
- **Целевая платформа:** Chrome/Firefox/Edge 100+, desktop от 1024px
- **Язык интерфейса:** русский

---

## 2. Current Architecture & Codebase Summary

### Статус проекта
Backend реализован (MVC + сервисный слой). Документация:
- `prds/video-chat-room/prd-video-chat-room.md` — Product Requirements Document
- `prds/video-chat-room/design-video-chat-room.md` — этот TDD
- `prds/video-chat-room/impl-video-chat-room.md` — Implementation Plan
- `docs/prd-design.mdc` — правила генерации TDD
- `docs/prd-tasks.mdc` — правила генерации плана задач

### Просмотренные файлы
| Путь | Компонент | Назначение |
|------|-----------|-----------|
| — | — | Кодовая база отсутствует |

Архитектура и все компоненты будут созданы с нуля согласно данному TDD.

---

## 3. Proposed Architecture / High-Level Design

### Архитектурная диаграмма

```mermaid
graph TB
    subgraph "Client A (Browser)"
        CA[React App]
        MCA[MediaManager]
        PCA[PeerConnectionManager]
        SCA[Socket.io Client]
    end
    
    subgraph "Client B (Browser)"
        CB[React App]
        MCB[MediaManager]
        PCB[PeerConnectionManager]
        SCB[Socket.io Client]
    end
    
    subgraph "Server (Node.js — MVC)"
        EXP[Express REST API]
        SS[Socket.io Server]
        RC[RoomController]
        SC[SocketController]
        RSV[RoomService]
        MDL[Models: Room, Participant]
    end
    
    subgraph "External"
        STUN[Google STUN Server]
    end
    
    CA --> SCA
    CA -->|"REST: create/get room"| EXP
    EXP --> RC
    RC --> RSV
    SCA <-->|"WS: signaling + chat"| SS
    SS --> SC
    SC --> RSV
    RSV --> MDL
    
    CB --> SCB
    SCB <-->|"WS: signaling + chat"| SS
    
    PCA <-.->|"P2P Media Streams"| PCB
    PCA ---|"ICE Candidates"| STUN
    PCB ---|"ICE Candidates"| STUN
    
    MCA -->|"getUserMedia"| PCA
    MCB -->|"getUserMedia"| PCB
```

### Топология WebRTC Mesh

```
4 участника = 6 P2P соединений всего (каждый с каждым)

Participant A: 3 исходящих потока (→ B, C, D)
Participant B: 3 исходящих потока (→ A, C, D)
Participant C: 3 исходящих потока (→ A, B, D)
Participant D: 3 исходящих потока (→ A, B, C)

Upload bandwidth на клиента: ~4.5 Mbps (при 720p, ~1.5 Mbps/поток)
```

### Компоненты системы

**Frontend (React):**
- UI компоненты для ввода имени, создания/входа в комнату
- Видеосетка (адаптивная раскладка 1–4 плитки)
- Панель управления (микрофон, камера, выход)
- Текстовый чат с историей
- WebRTC управление (RTCPeerConnection для каждого peer)
- Управление локальными медиа-устройствами

**Backend (Node.js + Socket.io):**
- HTTP-сервер (раздача статики)
- WebSocket-сервер (Socket.io)
- Управление комнатами в памяти
- Ретрансляция WebRTC сигналинга (SDP/ICE)
- Broadcast событий чата и системных уведомлений

**Infrastructure:**
- Google STUN для NAT traversal
- HTTPS (обязательно для getUserMedia)

---

## 4. Components & Interfaces

### Frontend Components

#### UI Components

**`StartScreen`**
- **Ответственность:** ввод отображаемого имени, создание/вход в комнату
- **Props:** `onJoinRoom: (roomId: string, userName: string) => void`
- **State:** `userName`, `roomIdInput`, `validation errors`

**`RoomScreen`**
- **Ответственность:** основной экран звонка, координация всех дочерних компонентов
- **Props:** `roomId: string`, `userName: string`
- **Children:** `VideoGrid`, `Controls`, `Chat`, `ParticipantList`

**`VideoGrid`**
- **Ответственность:** адаптивная сетка видео-плиток (1–4 участника)
- **Props:** `participants: Array`, `localStream: MediaStream`
- **Layout:** динамическая раскладка (1×1, 1×2, 2×2)

**`VideoTile`**
- **Ответственность:** отображение одного участника (видео + overlay)
- **Props:** `stream: MediaStream`, `userName: string`, `isMuted: boolean`, `isVideoOff: boolean`, `isLocal: boolean`
- **State:** показ аватара при отсутствии видео, индикатор muted mic

**`Controls`**
- **Ответственность:** управление микрофоном, камерой, выходом
- **Props:** `onToggleMic`, `onToggleVideo`, `onLeave`, `isMicEnabled`, `isVideoEnabled`

**`Chat`**
- **Ответственность:** панель текстового чата, отправка/прием сообщений
- **Props:** `messages: Array`, `onSendMessage: (text: string) => void`
- **State:** `inputText`, автопрокрутка к новым сообщениям

**`ParticipantList`**
- **Ответственность:** список участников комнаты
- **Props:** `participants: Array<{socketId, userName}>`

#### Core Modules

**`useMedia` (hook)**
- **Ответственность:** управление локальными медиа-устройствами через React hook
- **API:**
  ```javascript
  function useMedia({ autoStart?: boolean }) {
    return {
      localStream: MediaStream | null,
      isAudioEnabled: boolean,
      isVideoEnabled: boolean,
      error: string | null,
      startMedia: () => Promise<void>,
      stopMedia: () => void,
      toggleAudio: (enabled?: boolean) => void,
      toggleVideo: (enabled?: boolean) => void
    }
  }
  ```
- **Преимущества hook-подхода:** автоматическая очистка при unmount, интеграция с React lifecycle, состояние синхронизировано с UI

**`useWebRTC` (hook)**
- **Ответственность:** управление RTCPeerConnection для mesh-топологии через React hook
- **API:**
  ```javascript
  function useWebRTC({
    socket: Socket,
    localStream: MediaStream,
    onRemoteStream: (socketId, stream) => void,
    onPeerLeft: (socketId) => void
  }) {
    return {
      peers: Map<string, RTCPeerConnection>,
      createPeerConnection: (socketId: string, isInitiator: boolean) => Promise<void>,
      closePeerConnection: (socketId: string) => void,
      closeAllConnections: () => void
    }
  }
  ```
- **Обработка signaling:** hook автоматически подписывается на Socket.io события (`offer`, `answer`, `ice-candidate`) и управляет их обработкой
- **Автоматическая очистка:** все peer connections закрываются при unmount компонента

### Backend Modules (MVC + сервисный слой)

**`server.js`** (entry point)
- **Ответственность:** только запуск сервера — `server.listen()` + graceful shutdown (SIGTERM/SIGINT, `io.close()`)
- Вся сборка приложения вынесена в `setup/app.js` (`createApp()`)

**`setup/app.js`** (composition root)
- **Ответственность:** собирает все слои — Express + health-check, REST-роуты, HTTPS-сервер, Socket.io, подключение контроллеров; создаёт единый экземпляр `RoomService`, общий для HTTP и WebSocket

**`config/index.js`**
- **Ответственность:** единый объект конфигурации из `.env` (port, corsOrigin, ssl paths, logLevel, socketIO options)

**Models (M):**

**`models/Participant.js`**
```javascript
class Participant {
  constructor(socketId, userName)   // mediaState: {audio:true, video:true}
  updateMediaState({audio?, video?})
  toJSON()
}
```

**`models/Room.js`**
```javascript
class Room {
  addParticipant(socketId, userName): Participant
  tryAddParticipant(socketId, userName): {success, participant?, error?}  // атомарно: isFull + add
  removeParticipant(socketId): Participant | undefined
  getParticipant(socketId): Participant | undefined
  isFull(): boolean                 // лимит 4
  isEmpty(): boolean
  addChatMessage(message): message  // id = crypto.randomUUID()
  toJSON()
}
```

**Service (бизнес-логика):**

**`services/RoomService.js`**
```javascript
class RoomService {
  createRoom(roomId): Room          // + ленивая cleanupEmptyRooms()
  getRoom(roomId): Room | undefined
  getOrCreateRoom(roomId): Room
  roomExists(roomId): boolean
  addParticipant(roomId, socketId, userName): {success, room?, participant?, error?}  // через Room.tryAddParticipant
  removeParticipant(roomId, socketId): {participant?, shouldDeleteRoom}
  updateMediaState(roomId, socketId, {audio?, video?}): boolean
  addChatMessage(roomId, message): message | null
  getChatHistory(roomId): Array
  cleanupEmptyRooms(): number       // TTL-очистка пустых комнат (защита от утечки памяти)
}
```

**Controllers (C):**

**`controllers/RoomController.js`** (REST API)
- **Ответственность:** HTTP-обработчики для управления комнатами до входа
- **Методы:** `createRoom` (POST — валидирует userName, генерирует roomId через `crypto.randomUUID()`), `getRoom` (GET), `getParticipants` (GET)

**`controllers/SocketController.js`** (WebSocket)
- **Ответственность:** real-time — вход/выход, чат, media-state, WebRTC-сигналинг
- **`handleConnection(socket)`:** читает `roomId`/`userName` из `handshake.query`, валидирует, добавляет участника, эмитит `room-joined`
- **`registerHandlers(socket, roomId)`:** `chat-message`, `media-state`, `offer`, `answer`, `ice-candidate`, `disconnecting`
- **`isSameRoom(roomId, senderId, targetSocketId)`:** проверка принадлежности цели комнате перед WebRTC-relay
- Rate limiting через `infrastructure/RateLimiter.js` (5 сообщений/сек)

**Routes:**

**`routes/api.js`**
- **Ответственность:** Express Router, монтируется на `/api`; маршруты `POST /rooms`, `GET /rooms/:roomId`, `GET /rooms/:roomId/participants`

### Socket.io Events

Подключение к комнате происходит через `handshake.query` (см. раздел 6). После подключения регистрируются обработчики событий.

#### Client → Server

| Event | Payload | Response | Description |
|-------|---------|----------|-------------|
| (handshake query) | `{roomId, userName}` | `room-joined` или `error` | Вход в комнату при WS-подключении |
| `chat-message` | `{message: string}` | broadcast | Текстовое сообщение (roomId из сессии) |
| `media-state` | `{audio?: boolean, video?: boolean}` | broadcast | Изменение состояния медиа |
| `offer` | `{targetSocketId: string, sdp}` | unicast | WebRTC offer |
| `answer` | `{targetSocketId: string, sdp}` | unicast | WebRTC answer |
| `ice-candidate` | `{targetSocketId: string, candidate}` | unicast | ICE candidate |

#### Server → Client (broadcast/emit)

| Event | Payload | Target | Description |
|-------|---------|--------|-------------|
| `room-joined` | `{participants, chatHistory}` | individual | Успешный вход |
| `error` | `{type, message?}` | individual | validation / room-full / rate-limit |
| `user-joined` | `{socketId, userName, mediaState}` | room | Участник вошел |
| `user-left` | `{socketId, userName}` | room | Участник вышел |
| `system-message` | `{id, type: 'system', text, timestamp}` | room | Вход/выход в чат |
| `chat-message` | `{from, fromName, message, timestamp}` | room | Сообщение чата |
| `offer` | `{from, sdp}` | individual | WebRTC offer |
| `answer` | `{from, sdp}` | individual | WebRTC answer |
| `ice-candidate` | `{from, candidate}` | individual | ICE candidate |
| `media-state-changed` | `{socketId, mediaState: {audio, video}}` | room | Изменение состояния медиа |

---

## 5. Data Model & DB Changes

### In-Memory Data Structures

#### Room
```javascript
{
  roomId: string,              // UUID v4
  participants: Map<socketId, Participant>,
  chatHistory: Array<Message>,
  createdAt: number,           // Date.now() — используется для TTL-очистки пустых комнат
  maxParticipants: 4
}
```
Добавление участника — через атомарный `Room.tryAddParticipant()` (проверка `isFull` + вставка в одном синхронном методе).

#### Participant
```javascript
{
  socketId: string,            // уникальный ID (socket.id)
  userName: string,            // отображаемое имя (≤30 символов)
  joinedAt: number,            // Date.now()
  mediaState: {
    audio: boolean,            // микрофон включен (по умолчанию true)
    video: boolean             // камера включена (по умолчанию true)
  }
}
```

#### Message
```javascript
{
  id: string,                  // crypto.randomUUID()
  from: string,                // socketId отправителя (для type: 'user')
  fromName: string,            // имя отправителя (для type: 'user')
  message: string,             // текст (1..1000 символов) — для type: 'user'
  text: string,                // текст системного сообщения — для type: 'system'
  timestamp: number,           // Date.now()
  type: 'user' | 'system'      // тип сообщения
}
```

### Data Storage

**Серверная память:**
- `rooms: Map<roomId, Room>` — все активные комнаты
- При выходе последнего участника комната и её история полностью удаляются
- Пустые комнаты (созданные через REST, но без входа по WS) удаляются по TTL (`cleanupEmptyRooms`)

**Клиентская память:**
- Ничего не сохраняется между перезагрузками (без localStorage)
- Вся история сессии теряется при закрытии вкладки

### Database Migrations
Не требуются — персистентное хранилище отсутствует.

---

## 6. API / Contracts

### Архитектура: MVC + REST + WebSocket

Приложение использует паттерн **MVC** с сервисным слоем:
- **Models** (`Room`, `Participant`) — структуры данных
- **Services** (`RoomService`) — бизнес-логика, общая для HTTP и WebSocket
- **Controllers** (`RoomController` — REST, `SocketController` — WebSocket)

**Разделение HTTP и WebSocket:**
- **REST API** (Express) — управление комнатами до входа: создание, проверка существования, список участников
- **WebSocket** (Socket.io) — клиент подключается ТОЛЬКО при входе в комнату; параметры входа (`roomId`, `userName`) передаются в `handshake.query`. Real-time: чат, WebRTC-сигналинг, состояние медиа

---

### REST API (Express)

#### `POST /api/rooms` — создать комнату

**Request:**
```json
{ "userName": "Alice" }
```

**Response `201`:**
```json
{ "roomId": "550e8400-e29b-41d4-a716-446655440000", "createdAt": 1789507694392 }
```

**Response `400`:** `{ "error": "Имя обязательно" }` (userName валидируется и санитизируется — защита от XSS)

#### `GET /api/rooms/:roomId` — информация о комнате

**Response `200`:**
```json
{ "exists": true, "participantCount": 2, "isFull": false }
```

**Response `404`:** `{ "error": "Room not found" }`

#### `GET /api/rooms/:roomId/participants` — список участников

**Response `200`:**
```json
{
  "participants": [
    { "socketId": "abc", "userName": "Alice", "mediaState": { "audio": true, "video": true } }
  ]
}
```

**Response `404`:** `{ "error": "Room not found" }`

#### `GET /health` — статус сервера

**Response `200`:** `{ "status": "ok", "timestamp": "2026-09-15T21:28:14.448Z" }`

---

### Socket.io Event Schemas

#### Подключение к комнате (handshake)

Клиент подключается к Socket.io с параметрами входа в query. Сервер валидирует их в `handleConnection`, добавляет участника (атомарная проверка лимита 4) и присоединяет к комнате.

```javascript
const socket = io('https://localhost:3000', {
  query: { roomId: '<uuid v4>', userName: 'Alice' }
})
```

**Server → Client `room-joined`** (успешный вход):
```javascript
{
  participants: [   // существующие участники (без себя)
    { socketId: string, userName: string, mediaState: { audio: boolean, video: boolean } }
  ],
  chatHistory: [
    { id, from, fromName, message, timestamp, type: 'user' | 'system', text? }
  ]
}
```

**Server → Client `error`** (отказ, после чего сокет отключается):
```javascript
{ type: 'validation' | 'room-full', message: string }
```

**Server → Room `user-joined`** (новый участник):
```javascript
{ socketId: string, userName: string, mediaState: { audio: boolean, video: boolean } }
```

**Server → Room `user-left`** (участник вышел / отключился):
```javascript
{ socketId: string, userName: string }
```

**Server → Room `system-message`** (вход/выход):
```javascript
{ id: string, type: 'system', text: string, timestamp: number }
```

#### `chat-message`

**Client → Server:**
```javascript
socket.emit('chat-message', { message: string })  // roomId известен из сессии
```

**Server → Room (broadcast, включая отправителя):**
```javascript
{ from: string, fromName: string, message: string, timestamp: number }
```

Rate limiting: 5 сообщений/сек на socketId; при превышении отправителю приходит `error { type: 'rate-limit' }`.

#### `media-state`

**Client → Server:**
```javascript
socket.emit('media-state', { audio: boolean, video: boolean })
```

**Server → Room `media-state-changed`:**
```javascript
{ socketId: string, mediaState: { audio: boolean, video: boolean } }
```

#### WebRTC signaling: `offer` / `answer` / `ice-candidate`

**Client → Server:**
```javascript
socket.emit('offer', { targetSocketId: string, sdp: RTCSessionDescriptionInit })
socket.emit('answer', { targetSocketId: string, sdp: RTCSessionDescriptionInit })
socket.emit('ice-candidate', { targetSocketId: string, candidate: RTCIceCandidateInit })
```

**Server → Target (unicast):**
```javascript
{ from: string, sdp }          // для offer/answer
{ from: string, candidate }    // для ice-candidate
```

### Validation Rules

#### `userName`
```javascript
const USER_NAME_REGEX = /^[\p{L}\p{N} _-]{1,30}$/u;

function validateUserName(name) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 30) return false;
  return USER_NAME_REGEX.test(trimmed);
}
```

#### `roomId`
```javascript
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateRoomId(roomId) {
  return UUID_V4_REGEX.test(roomId);
}
```

#### `message`
```javascript
function validateMessage(message) {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length === 0) return false;
  if (trimmed.length > 1000) return false;
  return true;
}
```

---

## 7. Data & Control Flows

### Создание комнаты

```
1. Пользователь вводит имя на StartScreen
2. Клик "Создать комнату"
3. Frontend: POST /api/rooms {userName} → получает {roomId} (UUID v4)
4. Navigate к `/room/:roomId`
5. Автоматический вход в комнату (см. "Вход в комнату")
```

### Вход в комнату

```
1. Клиент открывает `/room/:roomId`
2. Если имя не введено → запрос имени
3. getUserMedia() → получение локального stream
4. Подключение к Socket.io с query {roomId, userName}
5. Сервер (SocketController.handleConnection):
   - Валидация userName и roomId из handshake.query
   - Атомарная проверка лимита (Room.tryAddParticipant, < 4)
   - При отказе: emit('error', {type: 'validation'|'room-full'}) + disconnect
   - При успехе: socket.join(roomId)
   - Broadcast 'user-joined' остальным
   - emit('room-joined', {participants, chatHistory})
6. Клиент:
   - Отображение локального видео
   - Для каждого existing participant:
     * Создание RTCPeerConnection
     * Создание offer (см. "WebRTC Handshake")
```

### WebRTC Handshake (новый участник B входит к существующему A)

```mermaid
sequenceDiagram
    participant B as Client B (new)
    participant Server
    participant A as Client A (existing)
    
    Note over B: getUserMedia()
    B->>B: createPeerConnection(A.socketId)
    B->>B: addTrack(localStream)
    B->>B: createOffer()
    B->>Server: emit('offer', {target: A, sdp})
    Server->>A: emit('offer', {from: B, sdp})
    
    Note over A: Получил offer
    A->>A: createPeerConnection(B.socketId)
    A->>A: addTrack(localStream)
    A->>A: setRemoteDescription(offer)
    A->>A: createAnswer()
    A->>Server: emit('answer', {target: B, sdp})
    Server->>B: emit('answer', {from: A, sdp})
    
    Note over B: Получил answer
    B->>B: setRemoteDescription(answer)
    
    par ICE Candidate Exchange
        B->>Server: emit('ice-candidate', {target: A})
        Server->>A: emit('ice-candidate', {from: B})
    and
        A->>Server: emit('ice-candidate', {target: B})
        Server->>B: emit('ice-candidate', {from: A})
    end
    
    Note over A,B: ICE connection established
    Note over A,B: P2P media streams flowing
```

**Правило против glare:**
- Offer создаёт ТОЛЬКО новый участник (B)
- Существующие участники (A) только отвечают (answer)
- Это исключает simultaneous offer (glare situation)

### Отправка сообщения в чат

```
1. Участник вводит текст в Chat компонент
2. Нажатие Enter или кнопки "Отправить"
3. Валидация на клиенте (не пустое, ≤1000 символов)
4. socket.emit('chat-message', {message})   // roomId известен из сессии
5. Сервер (SocketController.handleChatMessage):
   - Rate limiting (5 сообщений/сек) — до санитизации
   - Валидация и sanitization (XSS защита)
   - Добавление в chatHistory комнаты
   - io.to(roomId).emit('chat-message', {from, fromName, message, timestamp})
6. Все клиенты получают сообщение и добавляют в UI
7. Автопрокрутка чата к последнему сообщению
```

### Переключение микрофона/камеры

```
1. Клик на кнопку микрофона/камеры в Controls
2. MediaManager.toggleAudio(enabled) или toggleVideo(enabled)
3. Для audio: track.enabled = !track.enabled
4. Для video:
   - Выключение: stopTrack(), освобождение устройства
   - Включение: getUserMedia({video: true}), замена track
5. socket.emit('media-state', {audio?, video?})
6. Сервер (SocketController.handleMediaState):
   - Валидация boolean-полей
   - Обновление participant.mediaState в модели
   - Broadcast фактического mediaState из модели: media-state-changed
7. Остальные обновляют UI:
   - audio off → иконка перечёркнутого микрофона
   - video off → показать аватар/заглушку
```

### Выход участника

```
1. Клик "Выйти" или закрытие вкладки
2. socket.on('disconnecting') event на сервере
   - Важно: использовать 'disconnecting', а не 'disconnect'
   - В 'disconnect' сокет уже покинул комнаты, broadcast не дойдёт
3. SocketController.handleDisconnect(socket, roomId) → roomService.removeParticipant(roomId, socket.id)
   - roomId известен из замыкания registerHandlers
   - rateLimiter.clear(socket.id)
4. Если последний участник (shouldDeleteRoom):
   - Удалить комнату и всю историю
5. Иначе:
   - socket.to(roomId).emit('user-left', {socketId, userName})
   - Системное сообщение о выходе в чат
6. Остальные клиенты:
   - Закрывают RTCPeerConnection с ушедшим
   - Удаляют его VideoTile
   - Добавляют системное сообщение в чат
```

---

## 8. Error Handling & Edge Cases

### Комната заполнена (5-й участник)

**Обработка:**
- Сервер: атомарная проверка `Room.tryAddParticipant` (isFull + вставка) перед добавлением
- При отказе: `socket.emit('error', {type: 'room-full'})` + `socket.disconnect()`
- Клиент: показать экран "Комната заполнена (4/4)" с кнопкой "Повторить попытку"

### Отказ в доступе к медиа-устройствам

**Scenario:** пользователь отклонил запрос getUserMedia

**Обработка:**
```javascript
try {
  const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
} catch (error) {
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    // Показать сообщение: "Доступ к камере/микрофону запрещён"
    // Пользователь остаётся в комнате без медиа
    // mediaState: {audio: false, video: false}
  }
}
```

**UI:** участник без медиа отображается с аватаром/силуэтом и именем.

### ICE Connection States

**`iceConnectionState === 'failed'`:**
```javascript
peerConnection.on('iceconnectionstatechange', () => {
  if (peerConnection.iceConnectionState === 'failed') {
    // Показать: "Соединение потеряно с [userName]"
    // Предложить: "Перезайти в комнату"
  }
})
```

**`iceConnectionState === 'disconnected'`:**
```javascript
// Показать индикатор "Переподключение..."
// Ждать 5 секунд
setTimeout(() => {
  if (peerConnection.iceConnectionState === 'connected') {
    // Скрыть индикатор
  } else {
    // Считать соединение потерянным
  }
}, 5000)
```

### MediaStreamTrack.onended

**Scenario:** пользователь физически отключил камеру/микрофон или отозвал разрешение

```javascript
track.onended = () => {
  // Устройство потеряно
  // Выключить соответствующий контрол в UI
  mediaManager.toggleVideo(false) // или toggleAudio(false)
  
  // Разослать обновление актуального состояния
  socket.emit('media-state', { video: false }) // или { audio: false }
}
```

### Socket.io Connection Issues

**Недоступность сервера:**
```javascript
socket.on('connect_error', (error) => {
  // Показать: "Не удалось подключиться к серверу"
  // Retry logic: 3 попытки с задержкой 2s
})
```

**Socket.io heartbeat configuration:**
```javascript
// server.js
const io = new Server(server, {
  pingTimeout: 20000,    // 20 секунд без pong → disconnect
  pingInterval: 25000    // каждые 25 сек ping
})
```

**Назначение:** предотвратить «мёртвые» комнаты, когда клиент потерял соединение, но сервер ещё не знает об этом.

### Событие `disconnecting` vs `disconnect`

**Правильно:**
```javascript
// SocketController: roomId сохранён в замыкании при registerHandlers
socket.on('disconnecting', () => this.handleDisconnect(socket, roomId))

handleDisconnect(socket, roomId) {
  // socket ещё в комнате Socket.io → broadcast дойдёт до остальных
  const { participant, shouldDeleteRoom } = this.roomService.removeParticipant(roomId, socket.id)
  this.rateLimiter.clear(socket.id)
  socket.to(roomId).emit('user-left', { socketId: socket.id, userName: participant.userName })
}
```

**Неправильно:**
```javascript
socket.on('disconnect', () => {
  // socket уже покинул все комнаты → socket.to(roomId) никого не достигнет
})
```

### Браузер без поддержки WebRTC

**Проверка при загрузке:**
```javascript
if (!window.RTCPeerConnection) {
  // Показать: "Ваш браузер не поддерживает WebRTC"
  // Рекомендация: "Используйте Chrome, Firefox или Edge"
}
```

### Autoplay Policy

**Scenario:** браузер блокирует автозапуск удалённого аудио

**Решение:**
```javascript
// После получения remote stream
remoteAudio.play().catch(error => {
  if (error.name === 'NotAllowedError') {
    // Показать кнопку "Включить звук"
    // После клика пользователя:
    remoteAudio.play()
  }
})
```

**Альтернатива:** жест входа в комнату (клик "Войти") уже считается user interaction.

### Потеря устройства во время звонка

**Scenario:** камера/микрофон стали недоступны (заняты другим приложением, отключены физически)

**Обработка:** см. MediaStreamTrack.onended выше.

**Восстановление:** пользователь должен вручную выбрать устройство через настройки браузера/ОС, затем повторно включить в Controls.

---

## 9. Performance & Scalability

### Целевые метрики

| Метрика | Целевое значение | Контекст |
|---------|------------------|----------|
| Медиа-задержка (latency) | ≤500ms | Локальная сеть |
| RTT сигналинга | ≤100ms | Socket.io ping |
| Время входа в комнату | ≤2s | От клика до отображения видео |
| Video resolution | 720p (1280×720) | По умолчанию |
| Video framerate | 30 fps | По умолчанию |

### Ограничения Mesh Топологии

**Bandwidth:**
- 4 участника = 3 исходящих потока на клиента
- При 720p @ 1.5 Mbps/поток: ~4.5 Mbps upload
- При 1080p @ 2.5 Mbps/поток: ~7.5 Mbps upload (не рекомендуется)

**CPU:**
- Кодирование 3 исходящих потоков (VP8/VP9/H.264)
- Декодирование 3 входящих потоков
- Может быть тяжело на слабых устройствах

**Scalability:**
- Mesh не масштабируется >4 участников
- Для 5+ участников требуется SFU архитектура (out of scope)

### Оптимизации

**Video constraints:**
```javascript
const constraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
}
```

**React optimizations:**
```javascript
// VideoTile с React.memo
export const VideoTile = React.memo(({stream, userName, isMuted, isVideoOff}) => {
  // ...
}, (prevProps, nextProps) => {
  return prevProps.stream === nextProps.stream &&
         prevProps.isMuted === nextProps.isMuted &&
         prevProps.isVideoOff === nextProps.isVideoOff
})
```

**No explicit bitrate cap:**
- WebRTC автоматически адаптирует битрейт под bandwidth
- Явное ограничение не задаётся

---

## 10. Security & Compliance

### XSS Protection

**userName sanitization:**
```javascript
// Server-side
import DOMPurify from 'isomorphic-dompurify';

function sanitizeUserName(name) {
  return DOMPurify.sanitize(name.trim(), {ALLOWED_TAGS: []});
}
```

**Chat message sanitization:**
```javascript
// Client-side rendering
function renderMessage(message) {
  const div = document.createElement('div');
  div.textContent = message.message; // textContent автоматически экранирует
  return div.innerHTML;
}
```

**React:**
```jsx
<div>{message.message}</div> {/* React автоматически экранирует */}
```

### Validation Rules

**userName:**
- Regex: `/^[\p{L}\p{N} _-]{1,30}$/u`
- Trim, max 30 символов
- Буквы (любые Unicode), цифры, пробел, `_`, `-`

**message:**
- Trim, 1..1000 символов Unicode
- Не пустое после trim
- Санитизация на сервере

**roomId:**
- UUID v4 формат
- Сложно угадать (2^122 вариантов)

### Content Security Policy

**HTTP headers:**
```javascript
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", 
    "default-src 'self'; " +
    "connect-src 'self' wss://your-domain.com; " +
    "media-src 'self' blob:; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'"
  );
  next();
});
```

### Media Encryption

**DTLS-SRTP:**
- Встроено в WebRTC по умолчанию
- Все медиа-потоки шифруются автоматически
- E2E шифрование сверх этого — out of scope

### HTTPS

**Development:**
```bash
# mkcert для локальных сертификатов
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

**Production:**
```bash
# Let's Encrypt с certbot
certbot certonly --standalone -d your-domain.com
```

**Node.js:**
```javascript
const https = require('https');
const fs = require('fs');

const server = https.createServer({
  key: fs.readFileSync('path/to/privkey.pem'),
  cert: fs.readFileSync('path/to/cert.pem')
}, app);
```

### Access Control

**Доступ к комнатам:**
- Намеренно не ограничивается (по дизайну PRD)
- Любой, кто знает roomId, может войти
- roomId сложно угадать (UUID v4)
- Для приватных комнат потребовалась бы авторизация (out of scope)

### Rate Limiting

**Chat flooding protection (`infrastructure/RateLimiter.js`):**
```javascript
// Server-side: 5 сообщений/сек на socketId (sliding window)
class RateLimiter {
  constructor(maxMessages = 5, windowMs = 1000) { /* ... */ }

  check(socketId) {
    const now = Date.now();
    let times = (this.timestamps.get(socketId) || [])
      .filter(t => t > now - this.windowMs);   // sliding window
    if (times.length >= this.maxMessages) return false;
    times.push(now);
    this.timestamps.set(socketId, times);
    return true;
  }

  clear(socketId) { this.timestamps.delete(socketId); }
}

// SocketController.handleChatMessage: rate limit проверяется ДО санитизации
if (!this.rateLimiter.check(socket.id)) {
  socket.emit('error', { type: 'rate-limit' });
  return;
}
```

---

## 11. Testing Strategy

### Unit Tests (Backend)

**Models (`Room`, `Participant`):**
```javascript
describe('Room', () => {
  test('добавление/удаление участников')
  test('tryAddParticipant: атомарная проверка лимита 4')
  test('isFull / isEmpty')
  test('addChatMessage с id = crypto.randomUUID()')
})
describe('Participant', () => {
  test('mediaState по умолчанию {audio:true, video:true}')
  test('updateMediaState / toJSON')
})
```

**Service (`RoomService`):**
```javascript
describe('RoomService', () => {
  test('создание комнаты при первом участнике')
  test('вход в существующую комнату')
  test('отклонение 5-го участника (лимит room-full)')
  test('удаление комнаты при выходе последнего')
  test('cleanupEmptyRooms по TTL')
  test('updateMediaState / addChatMessage / getChatHistory')
})
```

**Coverage target:** 80%

**Tools:** Vitest (нативный ESM). Файлы в `tests/` зеркалят слои `src/`, без суффикса `.test.`

### Integration Tests (REST API + Socket.io)

**Scenarios:**
```javascript
describe('RoomController (REST API)', () => {
  test('POST /api/rooms создаёт комнату, roomId = валидный UUID v4')
  test('POST /api/rooms отклоняет пустой / XSS userName (400)')
  test('GET /api/rooms/:roomId (200 / 404)')
  test('GET /api/rooms/:roomId/participants')
})
describe('SocketController (WebSocket)', () => {
  test('handshake query: room-joined при входе')
  test('отклонение при невалидных roomId / userName')
  test('отклонение 5-го участника с ошибкой room-full')
  test('broadcast user-joined / user-left')
  test('обмен сообщениями в чате + XSS санитизация')
  test('rate limiting 5 сообщений/сек')
  test('media-state: валидация boolean + broadcast из модели')
  test('relay WebRTC offer/answer/ice-candidate')
  test('НЕ relay в чужую комнату (targetSocketId проверка)')
  test('выход последнего участника → удаление комнаты')
})
describe('Integration: REST create → WebSocket join', () => {
  test('вход в созданную через REST комнату (C1 regression)')
  test('полный сценарий: create, 2 участника, чат, disconnect')
})
```

**Tools:** Vitest + socket.io-client

### Frontend Tests (компоненты + хуки)

**Компоненты (React Testing Library):**
```javascript
describe('common', () => {
  test('Button: варианты, disabled, onClick')
  test('Input: label, error, value/onChange')
  test('Card: рендер children')
})
describe('video', () => {
  test('VideoTile: video-элемент / placeholder при isVideoOff, индикаторы mic')
  test('VideoGrid: адаптивная сетка 1–4, привязка remoteStreams по socketId')
})
describe('chat', () => {
  test('Chat: история сообщений, автопрокрутка, пустое состояние')
  test('ChatMessage: user/system, время HH:MM, XSS-экранирование')
  test('ChatInput: отправка Enter/кнопкой, блокировка пустых')
})
describe('controls / participant / room', () => {
  test('Controls: toggle mic/camera, кнопка выхода, индикация состояния')
  test('ParticipantList / Participant: список, индикаторы mic/video')
  test('MediaErrorBanner / AudioUnlockOverlay / ConnectionStatusBanner')
})
```

**Хуки:**
```javascript
describe('useMedia', () => {
  test('getUserMedia с constraints 720p@30fps')
  test('toggleAudio / toggleVideo (track.enabled)')
  test('обработка ошибок NotAllowedError / NotFoundError')
  test('track.onended → выключение контрола + onDeviceLost')
})
describe('useWebRTC', () => {
  test('createPeerConnection: initiator создаёт offer, answerer — нет')
  test('glare rule: room-joined → offer каждому существующему')
  test('ICE states: failed → закрытие, disconnected → 5с таймер')
  test('буферизация ICE-кандидатов до remoteDescription')
})
describe('App routing', () => {
  test('StartScreen / RoomScreen по маршрутам, UnsupportedBrowser без WebRTC')
})
```

**Tools:** Vitest + React Testing Library (jsdom). Файлы в `client/tests/` зеркалят `src/`, без суффикса `.test.`. Мокируются браузерные API: `getUserMedia`, `RTCPeerConnection`, `MediaStreamTrack`, `scrollIntoView`

**Ручная проверка WebRTC (не автоматизировано):** визуальная проверка видео/аудио в Chrome/Firefox/Edge 100+; сценарии — одна локальная сеть (direct P2P), разные сети (STUN), вход без камеры/микрофона (аватар + отключённый микрофон).

### Load Testing

**Out of scope** для MVP:
- Single-server архитектура
- In-memory хранилище
- Нет требований к concurrent rooms

---

## 12. Deployment & Migration Plan

### Project Structure

```
video-chat-room/
├── client/                    # React frontend
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/          # UI-компоненты (сгруппированы по домену)
│   │   │   ├── common/         # Переиспользуемые: Button, Input, Card
│   │   │   ├── room/           # StartScreen, RoomScreen, NamePrompt, RoomError,
│   │   │   │                   # InviteButton, UnsupportedBrowser, MediaErrorBanner,
│   │   │   │                   # AudioUnlockOverlay
│   │   │   ├── video/          # VideoGrid, VideoTile
│   │   │   ├── controls/       # Controls
│   │   │   ├── chat/           # Chat, ChatMessage, ChatInput
│   │   │   └── participant/    # Participant, ParticipantList
│   │   ├── hooks/              # React-хуки (side-effect логика)
│   │   │   ├── useMedia.js     # Локальные медиа-устройства (getUserMedia, toggle)
│   │   │   ├── useWebRTC.js    # RTCPeerConnection, mesh-топология, signaling
│   │   │   └── useSocket.js    # Socket.io подключение к комнате
│   │   ├── services/          # Внешние интеграции
│   │   │   └── api.js          # REST-клиент (POST /api/rooms и т.д.)
│   │   ├── utils/             # Чистые утилиты
│   │   │   ├── validation.js
│   │   │   └── webrtcSupport.js
│   │   ├── config/            # Конфигурация из import.meta.env
│   │   │   └── index.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css          # Tailwind-директивы
│   ├── tests/                 # Структура зеркалит src/ (Vitest + RTL)
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vitest.config.js
│   └── vite.config.js
├── server/                    # Node.js backend (MVC + service layer)
│   ├── src/
│   │   ├── config/            # Configuration (reads from .env)
│   │   │   └── index.js       # single config object: port, ssl, logLevel, socketIO
│   │   ├── models/           # Data models (M in MVC)
│   │   │   ├── Room.js        # Room: participants, chat history, limits
│   │   │   └── Participant.js # Participant: socketId, userName, mediaState
│   │   ├── services/         # Business logic layer
│   │   │   └── RoomService.js # room lifecycle, participants, chat, media state
│   │   ├── controllers/      # Controllers (C in MVC)
│   │   │   ├── RoomController.js   # REST API handlers (HTTP)
│   │   │   └── SocketController.js # WebSocket handlers (real-time)
│   │   ├── routes/           # Express routing
│   │   │   └── api.js         # REST API routes (/api/rooms)
│   │   ├── validation/       # Validation & XSS protection
│   │   │   ├── constants.js
│   │   │   ├── messages.js    # localized error messages (ru)
│   │   │   ├── userName.js
│   │   │   ├── roomId.js
│   │   │   ├── message.js
│   │   │   └── index.js
│   │   ├── infrastructure/   # Infrastructure layer
│   │   │   ├── RateLimiter.js # chat rate limiting (5 msg/sec)
│   │   │   ├── logger.js      # winston logger
│   │   │   └── ssl.js         # SSL certificate loader
│   │   ├── setup/            # App composition root
│   │   │   └── app.js         # createApp(): wires MVC + Socket.io together
│   │   └── server.js         # Entry point: only listen() + graceful shutdown
│   ├── tests/                # Test structure mirrors src/ layers
│   │   ├── models/
│   │   │   ├── Room.js
│   │   │   └── Participant.js
│   │   ├── services/
│   │   │   └── RoomService.js
│   │   ├── controllers/
│   │   │   ├── RoomController.js   # REST API integration tests
│   │   │   └── SocketController.js # WebSocket integration tests
│   │   └── integration/
│   │       └── RestToWebSocket.js  # REST create → WS join (C1 regression)
│   ├── certs/                # mkcert SSL certificates (gitignored)
│   ├── vitest.config.js
│   ├── package.json
│   └── .env.example
├── prds/
│   └── video-chat-room/
│       ├── prd-video-chat-room.md   # PRD
│       ├── design-video-chat-room.md # TDD (this doc)
│       └── impl-video-chat-room.md   # Implementation Plan
├── docs/
│   ├── prd-design.mdc                # TDD generation rules
│   └── prd-tasks.mdc                 # Implementation Plan generation rules
├── .gitignore
└── README.md
```

### Environment Variables

**Server (`.env`):**
```bash
# Server configuration
PORT=3000
NODE_ENV=development

# HTTPS (development) — пути к сертификатам mkcert
SSL_CERT_PATH=./certs/localhost+2.pem
SSL_KEY_PATH=./certs/localhost+2-key.pem

# Socket.io
PING_TIMEOUT=20000
PING_INTERVAL=25000
CORS_ORIGIN=https://localhost:5173

# Logging
LOG_LEVEL=info
```

**Client (`.env`):**
```bash
# API endpoints
VITE_API_BASE_URL=https://localhost:3000
VITE_WS_URL=https://localhost:3000

# WebRTC STUN servers (comma-separated)
VITE_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302

# Application config
VITE_APP_TITLE=Video Chat Room
VITE_MAX_PARTICIPANTS=4
VITE_MAX_MESSAGE_LENGTH=1000
VITE_MAX_USERNAME_LENGTH=30
```

### Build & Deploy Steps

**Development:**
```bash
# 1. Install dependencies
cd client && npm install
cd ../server && npm install

# 2. Generate HTTPS certificates (mkcert) в server/certs/
mkcert -install
cd server/certs && mkcert localhost 127.0.0.1 ::1 && cd ../..
# Результат: server/certs/localhost+2.pem и localhost+2-key.pem
# (имена совпадают с SSL_CERT_PATH / SSL_KEY_PATH в .env)

# 3. Start development servers
# Terminal 1: Frontend
cd client && npm run dev

# Terminal 2: Backend
cd server && npm run dev
```

**Production build & run:**
```bash
# Вариант 1: одной командой (сборка клиента + запуск сервера в production)
cd server && npm run serve

# Вариант 2: по шагам
cd client && npm run build      # → client/dist
cd ../server && npm run start:prod   # NODE_ENV=production, раздаёт client/dist

# В production (NODE_ENV=production) сервер:
# - раздаёт статику из client/dist (express.static)
# - обслуживает SPA-fallback (/*splat → index.html)
# - обслуживает REST API (/api) и WebSocket (Socket.io)
# Всё доступно на https://localhost:3000
```

Скрипты сервера (`server/package.json`):
- `npm start` — запуск из `src/server.js`
- `npm run dev` — режим разработки с авто-перезагрузкой (`--watch`)
- `npm run start:prod` — запуск с `NODE_ENV=production`
- `npm run build` — сборка клиента (`client/dist`)
- `npm run serve` — `build` + `start:prod` (полный production-запуск)
- `npm test` — Vitest

### Feature Flags
Не требуются для MVP (нет phased rollout).

### Rollback Strategy
- Stateless приложение (нет БД)
- Rollback = перезапуск предыдущей версии
- Zero-downtime deploy не критичен (малая нагрузка)

### Migration Plan
**Не требуется** — персистентное хранилище отсутствует.

---

## 13. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| **NAT traversal без TURN** | Некоторые пары участников не смогут соединиться через P2P | Medium | Приемлемо для локальной сети и офисной среды; документировать ограничение; STUN покрывает большинство случаев |
| **Mesh не масштабируется >4** | Невозможно добавить 5+ участников без переработки архитектуры | Low | Жёсткий лимит 4 заложен в требования; для масштабирования потребуется SFU (out of scope) |
| **Потеря истории при перезапуске сервера** | Все комнаты и история чата исчезают | Medium | По дизайну (in-memory); документировать; для production потребуется Redis или БД |
| **Браузерная совместимость** | getUserMedia API и WebRTC различаются между браузерами | Low | Тестирование в Chrome/Firefox/Edge; feature detection; graceful degradation |
| **HTTPS в dev окружении** | Сложность настройки локальных сертификатов | Low | mkcert упрощает генерацию доверенных сертификатов; документировать setup |
| **Single point of failure** | Падение сервера → все комнаты недоступны | Medium | Приемлемо для MVP; horizontal scaling требует shared state (Redis/DB) |
| **Bandwidth constraints** | Клиенты с медленным upload не смогут передавать 3 потока | Medium | Mesh ограничение; WebRTC автоматически снижает качество; альтернатива — SFU (out of scope) |
| **Device permission denial** | Пользователь отклонил доступ к камере/микрофону | Low | Graceful degradation: участник остаётся в комнате без медиа; чёткая инструкция |

---

## 14. Open Questions / TBD

### Лимит длины сообщения
**Вопрос:** Какой максимальный размер текстового сообщения?  
**Предложение:** 1000 символов Unicode (достаточно для чата, защищает от злоупотреблений)  
**Статус:** TBD → принято для реализации

### Rate Limiting
**Вопрос:** Нужна ли защита от флуда в чате?  
**Решение:** 5 сообщений/сек на socketId (sliding window, `infrastructure/RateLimiter.js`), проверка до санитизации  
**Статус:** ✅ реализовано

### Logging
**Вопрос:** Какая стратегия логирования на сервере?  
**Решение:** Winston (`infrastructure/logger.js`), уровень из `.env` (LOG_LEVEL), вывод в stdout  
**Статус:** ✅ реализовано

### Reconnection Timeout
**Вопрос:** Сколько ждать перед считыванием disconnect?  
**Решение:** Socket.io pingTimeout = 20 сек, pingInterval = 25 сек (из `.env`)  
**Статус:** ✅ реализовано

### Room ID Collision
**Вопрос:** Как обрабатывать коллизию roomId?  
**Решение:** UUID v4 (`crypto.randomUUID()`) достаточно безопасен (вероятность коллизии ~10^-18); explicit collision handling не требуется  
**Статус:** ✅ реализовано

### Video Quality Adaptation
**Вопрос:** Нужна ли явная настройка битрейта или разрешения?  
**Предложение:** Оставить WebRTC автоматическую адаптацию; пользовательские настройки качества — out of scope для MVP  
**Статус:** TBD → принято для реализации (frontend)

---

**End of Technical Design Document**
