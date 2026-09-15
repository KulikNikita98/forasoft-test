/**
 * Participant — отдельный участник в списке.
 *
 * @param {object} props
 * @param {string} props.userName
 * @param {boolean} props.isCurrentUser
 * @param {boolean} props.isMuted
 * @param {boolean} props.isVideoOff
 */
function Participant({ userName, isCurrentUser = false, isMuted = false, isVideoOff = false }) {
  return (
    <li className="flex items-center gap-2 text-sm text-white">
      <span
        className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500"
        aria-hidden="true"
      />
      <span className="flex-1 truncate">{userName}</span>
      {isCurrentUser && <span className="text-xs text-gray-500">(вы)</span>}

      {/* Индикаторы состояния микрофона и камеры */}
      <div className="flex gap-1">
        {isMuted && (
          <span className="text-xs text-gray-400" title="Микрофон выключен">
            🔇
          </span>
        )}
        {isVideoOff && (
          <span className="text-xs text-gray-400" title="Камера выключена">
            📷
          </span>
        )}
      </div>
    </li>
  );
}

export default Participant;
