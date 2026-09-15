import { processUserName } from '../validation/userName.js';
import { validateRoomId } from '../validation/roomId.js';

/**
 * SignalingHandler — регистрация обработчиков Socket.io событий
 * Отвечает за вход/выход участников и системные сообщения
 */
class SignalingHandler {
  /**
   * @param {import('socket.io').Server} io - Socket.io сервер
   * @param {import('./RoomManager.js').default} roomManager
   * @param {import('winston').Logger} logger
   */
  constructor(io, roomManager, logger) {
    this.io = io;
    this.roomManager = roomManager;
    this.logger = logger;
  }

  /**
   * Зарегистрировать все обработчики для нового сокета
   * @param {import('socket.io').Socket} socket
   */
  register(socket) {
    socket.on('join-room', (payload, ack) => this.handleJoinRoom(socket, payload, ack));
    socket.on('leave-room', (payload) => this.handleLeaveRoom(socket, payload));
    socket.on('disconnecting', () => this.handleDisconnecting(socket));
  }

  /**
   * Обработчик join-room с acknowledgement callback
   */
  handleJoinRoom(socket, payload, ack) {
    const sendAck = typeof ack === 'function' ? ack : () => {};
    const { roomId, userName } = payload || {};

    // Валидация roomId
    const roomIdCheck = validateRoomId(roomId);
    if (!roomIdCheck.valid) {
      return sendAck({ success: false, error: 'invalid-room' });
    }

    // Валидация + санитизация имени
    const nameCheck = processUserName(userName);
    if (!nameCheck.valid) {
      return sendAck({ success: false, error: 'invalid-name' });
    }

    const safeName = nameCheck.value;

    // Атомарное добавление в комнату (с проверкой лимита)
    const result = this.roomManager.joinRoom(roomId, socket.id, safeName);
    if (!result.success) {
      return sendAck({ success: false, error: 'room-full' });
    }

    // Присоединить сокет к комнате Socket.io
    socket.join(roomId);

    // Broadcast остальным участникам о новом участнике
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userName: safeName
    });

    this.logger.info(`User ${safeName} (${socket.id}) joined room ${roomId}`);

    // Acknowledgement с текущим состоянием комнаты (до добавления
    // системного сообщения о собственном входе — вошедший его не видит)
    sendAck({
      success: true,
      participants: result.participants.map((p) => ({
        socketId: p.socketId,
        userName: p.userName,
        mediaState: p.mediaState
      })),
      chatHistory: result.chatHistory
    });

    // Системное сообщение о входе (для остальных и поздних участников)
    this.addSystemMessage(roomId, `${safeName} присоединился к комнате`);
  }

  /**
   * Обработчик leave-room (осознанный выход)
   */
  handleLeaveRoom(socket, payload) {
    const { roomId } = payload || {};
    this.removeParticipant(socket, roomId);
  }

  /**
   * Обработчик disconnecting (обрыв/закрытие вкладки)
   * ВАЖНО: используем 'disconnecting', а не 'disconnect' — socket.rooms ещё доступны
   */
  handleDisconnecting(socket) {
    // socket.rooms содержит id самого сокета + комнаты, к которым он присоединён
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        this.removeParticipant(socket, roomId);
      }
    }
  }

  /**
   * Общая логика удаления участника из комнаты
   */
  removeParticipant(socket, roomId) {
    const result = this.roomManager.leaveRoom(socket.id);
    if (!result) {
      return;
    }

    const { participant, shouldDeleteRoom } = result;
    const targetRoomId = result.roomId;

    // Broadcast остальным участникам о выходе
    socket.to(targetRoomId).emit('user-left', {
      socketId: socket.id,
      userName: participant.userName
    });

    // Системное сообщение о выходе (только если комната ещё жива)
    if (!shouldDeleteRoom) {
      this.addSystemMessage(targetRoomId, `${participant.userName} покинул комнату`);
    }

    // Покинуть комнату Socket.io
    socket.leave(targetRoomId);

    this.logger.info(
      `User ${participant.userName} (${socket.id}) left room ${targetRoomId}` +
        (shouldDeleteRoom ? ' (room deleted)' : '')
    );
  }

  /**
   * Добавить системное сообщение в историю и разослать всем в комнате
   */
  addSystemMessage(roomId, text) {
    const message = this.roomManager.addChatMessage(roomId, {
      type: 'system',
      text,
      timestamp: Date.now()
    });

    this.io.to(roomId).emit('system-message', {
      id: message.id,
      type: 'system',
      text: message.text,
      timestamp: message.timestamp
    });
  }
}

export default SignalingHandler;
