import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import SoloGame from './pages/SoloGame';
import Multiplayer from './pages/Multiplayer';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/solo" element={<SoloGame />} />
      <Route path="/play" element={<Multiplayer />} />
      <Route path="/play/:code" element={<Multiplayer />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
