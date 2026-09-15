/**
 * Participant — участник комнаты
 */
class Participant {
  /**
   * @param {string} socketId - Socket.io ID
   * @param {string} userName - Имя участника
   */
  constructor(socketId, userName) {
    this.socketId = socketId;
    this.userName = userName;
    this.mediaState = {
      audio: true,
      video: true
    };
    this.joinedAt = Date.now();
  }

  /**
   * Обновить состояние медиа (аудио/видео)
   * @param {{ audio?: boolean, video?: boolean }} state
   */
  updateMediaState(state) {
    if (state.audio !== undefined) {
      this.mediaState.audio = state.audio;
    }
    if (state.video !== undefined) {
      this.mediaState.video = state.video;
    }
  }

  /**
   * Сериализация для отправки клиенту
   */
  toJSON() {
    return {
      socketId: this.socketId,
      userName: this.userName,
      mediaState: this.mediaState
    };
  }
}

export default Participant;
