import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StartScreen, RoomScreen, UnsupportedBrowser } from './components/room/index.js';
import { isWebRTCSupported } from './utils/webrtcSupport.js';

function App() {
  // Проверка поддержки WebRTC при загрузке — без него видеозвонок невозможен
  if (!isWebRTCSupported()) {
    return <UnsupportedBrowser />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/room/:roomId" element={<RoomScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
