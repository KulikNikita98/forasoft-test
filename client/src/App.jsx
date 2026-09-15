import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import StartScreen from './components/StartScreen.jsx';
import RoomScreen from './components/RoomScreen.jsx';
import UnsupportedBrowser from './components/UnsupportedBrowser.jsx';
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
