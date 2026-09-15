import Participant from './Participant.jsx';

/**
 * ParticipantList — список участников комнаты (обновляется в реальном времени).
 *
 * @param {object} props
 * @param {Array<{socketId: string, userName: string, isMuted?: boolean, isVideoOff?: boolean}>} props.participants
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
          <Participant
            key={p.socketId}
            userName={p.userName}
            isCurrentUser={p.userName === currentUserName}
            isMuted={p.isMuted}
            isVideoOff={p.isVideoOff}
          />
        ))}
      </ul>
    </div>
  );
}

export default ParticipantList;
