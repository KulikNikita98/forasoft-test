/**
 * ParticipantList — список участников комнаты (обновляется в реальном времени).
 *
 * @param {object} props
 * @param {Array<{socketId: string, userName: string}>} props.participants
 * @param {string} props.currentUserName — имя текущего пользователя (для пометки "вы")
 */
function ParticipantList({ participants = [], currentUserName }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
        Участники ({participants.length})
      </h2>
      <ul className="flex flex-col gap-1">
        {participants.map((p) => (
          <li key={p.socketId} className="flex items-center gap-2 text-sm text-white">
            <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
            {p.userName}
            {p.userName === currentUserName && (
              <span className="text-xs text-gray-500">(вы)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ParticipantList;
