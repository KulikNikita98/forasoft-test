/**
 * RateLimiter — server-side rate limiting (sliding window)
 * По умолчанию: 5 сообщений в секунду на socketId
 */
class RateLimiter {
  constructor(maxMessages = 5, windowMs = 1000) {
    this.maxMessages = maxMessages;
    this.windowMs = windowMs;
    this.timestamps = new Map(); // socketId -> timestamp[]
  }

  /**
   * Проверить, можно ли принять сообщение от socketId
   * @param {string} socketId
   * @returns {boolean} true если в пределах лимита
   */
  check(socketId) {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let times = this.timestamps.get(socketId) || [];
    times = times.filter((t) => t > cutoff);

    if (times.length >= this.maxMessages) {
      return false;
    }

    times.push(now);
    this.timestamps.set(socketId, times);

    return true;
  }

  /**
   * Очистить историю для socketId (при disconnect)
   * @param {string} socketId
   */
  clear(socketId) {
    this.timestamps.delete(socketId);
  }
}

export default RateLimiter;
