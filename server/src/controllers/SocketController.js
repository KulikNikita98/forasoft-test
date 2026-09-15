import { processUserName } from '../validation/userName.js';
import { validateRoomId } from '../validation/roomId.js';
import { processMessage } from '../validation/message.js';
import RateLimiter from '../infrastructure/RateLimiter.js';

/**
 * SocketController — обработчик Socket.io событий
 * WebSocket контроллер для реального времени (чат, WebRTC сигналинг)
 */
class SocketController {
  /**
   * @param {import('socket.io').Server} io
   * @param {import('../services/RoomService.js').default} roomService
   * @param {import('winston').Logger} logger
   */
  constructor(io, roomService, logger) {
    this.io = io;
    this.roomService = roomService;
    this.logger = logger;
    this.rateLimiter = new RateLimiter(5, 1000); // 5 сообщений/сек
  }

  /**
   * Обработать подключение нового сокета
   * @param {import('socket.io').Socket} socket
   */
  handleConnection(socket) {
    const { roomId, userName } = socket.handshake.query;

    // Валидация параметров подключения
    const roomIdCheck = validateRoomId(roomId);
    const userNameCheck = processUserName(userName);

    if (!roomIdCheck.valid || !userNameCheck.valid) {
      socket.emit('error', {
        type: 'validation',
        message: roomIdCheck.error || userNameCheck.error
      });
      socket.disconnect();
      return;
    }

    const safeUserName = userNameCheck.value;
    const safeRoomId = roomId;

    // Добавить участника в комнату
    const result = this.roomService.addParticipant(safeRoomId, socket.id, safeUserName);

    if (!result.success) {
      socket.emit('error', {
        type: result.error,
        message: result.error === 'room-full' ? 'Room is full (max 4 participants)' : 'Unknown error'
      });
      socket.disconnect();
      return;
    }

    const { room, participant } = result;

    // Присоединить сокет к комнате Socket.io
    socket.join(safeRoomId);

    this.logger.info(`User ${safeUserName} (${socket.id}) joined room ${safeRoomId}`);

    // Отправить подтверждение входа с участниками и историей чата
    const participants = Array.from(room.participants.values())
      .filter((p) => p.socketId !== socket.id)
      .map((p) => p.toJSON());

    socket.emit('room-joined', {
      participants,
      chatHistory: room.chatHistory
    });

    // Уведомить остальных участников о новом пользователе
    socket.to(safeRoomId).emit('user-joined', participant.toJSON());

    // Добавить системное сообщение в чат
    this.addSystemMessage(safeRoomId, `${safeUserName} joined the room`);

    // Регистрация обработчиков событий
    this.registerHandlers(socket, safeRoomId);
  }

  /**
   * Зарегистрировать обработчики событий для сокета
   * @param {import('socket.io').Socket} socket
   * @param {string} roomId
   */
  registerHandlers(socket, roomId) {
    socket.on('chat-message', (payload) => this.handleChatMessage(socket, roomId, payload));
    socket.on('media-state', (payload) => this.handleMediaState(socket, roomId, payload));
    socket.on('offer', (payload) => this.handleOffer(socket, roomId, payload));
    socket.on('answer', (payload) => this.handleAnswer(socket, roomId, payload));
    socket.on('ice-candidate', (payload) => this.handleIceCandidate(socket, roomId, payload));
    socket.on('disconnect', () => this.handleDisconnect(socket, roomId));
  }

  /**
   * Обработчик chat-message
   */
  handleChatMessage(socket, roomId, payload) {
    const { message } = payload || {};

    // Валидация сообщения
    const messageCheck = processMessage(message);
    if (!messageCheck.valid) {
      return;
    }

    const safeMessage = messageCheck.value;

    // Rate limiting
    if (!this.rateLimiter.check(socket.id)) {
      socket.emit('error', { type: 'rate-limit' });
      this.logger.warn(`Rate limit exceeded for ${socket.id} in room ${roomId}`);
      return;
    }

    const room = this.roomService.getRoom(roomId);
    if (!room) return;

    const participant = room.getParticipant(socket.id);
    if (!participant) return;

    // Добавить в историю
    const chatMessage = this.roomService.addChatMessage(roomId, {
      from: socket.id,
      fromName: participant.userName,
      message: safeMessage,
      timestamp: Date.now(),
      type: 'user'
    });

    // Broadcast всем в комнате
    this.io.to(roomId).emit('chat-message', {
      from: chatMessage.from,
      fromName: chatMessage.fromName,
      message: chatMessage.message,
      timestamp: chatMessage.timestamp
    });

    this.logger.info(`Chat message from ${participant.userName} in room ${roomId}`);
  }

  /**
   * Обработчик media-state (обновление состояния аудио/видео)
   */
  handleMediaState(socket, roomId, payload) {
    const { audio, video } = payload || {};

    const updated = this.roomService.updateMediaState(roomId, socket.id, { audio, video });

    if (!updated) return;

    // Broadcast изменения состояния медиа всем остальным
    socket.to(roomId).emit('media-state-changed', {
      socketId: socket.id,
      mediaState: { audio, video }
    });

    this.logger.info(`Media state updated for ${socket.id} in room ${roomId}`);
  }

  /**
   * Обработчик WebRTC offer
   */
  handleOffer(socket, roomId, payload) {
    const { targetSocketId, sdp } = payload || {};

    if (!targetSocketId || !sdp) return;

    // Переслать offer целевому участнику
    this.io.to(targetSocketId).emit('offer', {
      from: socket.id,
      sdp
    });

    this.logger.debug(`WebRTC offer from ${socket.id} to ${targetSocketId}`);
  }

  /**
   * Обработчик WebRTC answer
   */
  handleAnswer(socket, roomId, payload) {
    const { targetSocketId, sdp } = payload || {};

    if (!targetSocketId || !sdp) return;

    // Переслать answer целевому участнику
    this.io.to(targetSocketId).emit('answer', {
      from: socket.id,
      sdp
    });

    this.logger.debug(`WebRTC answer from ${socket.id} to ${targetSocketId}`);
  }

  /**
   * Обработчик ICE candidate
   */
  handleIceCandidate(socket, roomId, payload) {
    const { targetSocketId, candidate } = payload || {};

    if (!targetSocketId || !candidate) return;

    // Переслать ICE candidate целевому участнику
    this.io.to(targetSocketId).emit('ice-candidate', {
      from: socket.id,
      candidate
    });

    this.logger.debug(`ICE candidate from ${socket.id} to ${targetSocketId}`);
  }

  /**
   * Обработчик disconnect
   */
  handleDisconnect(socket, roomId) {
    const { participant, shouldDeleteRoom } = this.roomService.removeParticipant(roomId, socket.id);

    if (!participant) return;

    // Очистить rate limiter
    this.rateLimiter.clear(socket.id);

    // Уведомить остальных участников
    socket.to(roomId).emit('user-left', {
      socketId: socket.id,
      userName: participant.userName
    });

    // Добавить системное сообщение
    if (!shouldDeleteRoom) {
      this.addSystemMessage(roomId, `${participant.userName} left the room`);
    }

    this.logger.info(
      `User ${participant.userName} (${socket.id}) left room ${roomId}` +
        (shouldDeleteRoom ? ' (room deleted)' : '')
    );
  }

  /**
   * Добавить системное сообщение в чат
   */
  addSystemMessage(roomId, text) {
    const message = this.roomService.addChatMessage(roomId, {
      type: 'system',
      text,
      timestamp: Date.now()
    });

    if (!message) return;

    this.io.to(roomId).emit('system-message', {
      id: message.id,
      type: 'system',
      text: message.text,
      timestamp: message.timestamp
    });
  }
}

export default SocketController;
