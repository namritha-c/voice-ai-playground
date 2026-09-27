import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Mode } from './api/client';
import Header from './components/Header';
import Rail from './components/Rail';
import { level } from './lib/audio';
import { useClock } from './lib/useClock';
import History from './pages/History';
import Playground from './pages/Playground';
import Providers from './pages/Providers';

export default function App() {
  const loc = useLocation();
  const t = useClock(20);
  const m = loc.pathname.match(/^\/(tts|stt|sts)/);
  const mode = (m?.[1] as Mode | undefined) ?? null;
  return (
    <div className={`app mode-${mode ?? 'tts'}`}>
      <Rail />
      <div className="col">
        <Header mode={mode} t={t} level={mode ? level() : 0} />
        <Routes>
          <Route path="/" element={<Navigate to="/tts" replace />} />
          <Route path="/tts" element={<Playground key="tts" mode="tts" />} />
          <Route path="/stt" element={<Playground key="stt" mode="stt" />} />
          <Route path="/sts" element={<Playground key="sts" mode="sts" />} />
          <Route path="/providers" element={<Providers t={t} />} />
          <Route path="/history" element={<History t={t} />} />
          <Route path="*" element={<Navigate to="/tts" replace />} />
        </Routes>
      </div>
    </div>
  );
}
