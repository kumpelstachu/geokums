import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameSettings } from '@geoguess/shared';
import { fetchHealth } from '../api';
import SettingsPanel from '../components/SettingsPanel';
import { getStoredNickname, setStoredNickname } from '../nickname';
import { getStoredSettings, setStoredSettings } from '../settings';

export default function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(getStoredNickname);
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'solo' | 'create' | 'join'>('menu');
  const [settings, setSettings] = useState<GameSettings>(getStoredSettings);
  const [sourceCommit, setSourceCommit] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((h) => {
        if (!cancelled && h.sourceCommit) setSourceCommit(h.sourceCommit);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function saveName(name: string) {
    const n = name.trim() || 'Explorer';
    setStoredNickname(n);
    return n;
  }

  function saveSettings(next: GameSettings) {
    setSettings(next);
    setStoredSettings(next);
  }

  function onSolo(e: FormEvent) {
    e.preventDefault();
    const soloSettings: GameSettings = {
      ...settings,
      playMode: settings.playMode === 'duels' ? 'classic' : settings.playMode,
    };
    setStoredSettings(soloSettings);
    navigate('/solo', { state: { settings: soloSettings } });
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    const n = saveName(nickname);
    setStoredSettings(settings);
    navigate('/play', { state: { intent: 'create', nickname: n, settings } });
  }

  function onJoin(e: FormEvent) {
    e.preventDefault();
    const n = saveName(nickname);
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/play/${code}`, { state: { intent: 'join', nickname: n } });
  }

  const soloSettingsView: GameSettings = {
    ...settings,
    playMode: settings.playMode === 'duels' ? 'classic' : settings.playMode,
  };

  return (
    <div className="app-shell home">
      <div className="home-panel">
        <h1 className="brand">GeoGuess</h1>
        <p>Street View guessing — classic, country, Poland, no-move, and duels.</p>

        {mode === 'menu' && (
          <div className="home-actions">
            <button className="btn" type="button" onClick={() => setMode('solo')}>
              Play Solo
            </button>
            <button className="btn btn-teal" type="button" onClick={() => setMode('create')}>
              Create Room
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setMode('join')}>
              Join Room
            </button>
          </div>
        )}

        {mode === 'solo' && (
          <form className="home-card" onSubmit={onSolo}>
            <h2>Solo setup</h2>
            <SettingsPanel value={soloSettingsView} onChange={saveSettings} allowDuels={false} />
            <div className="row">
              <button className="btn btn-ghost" type="button" onClick={() => setMode('menu')}>
                Back
              </button>
              <button className="btn" type="submit">
                Start
              </button>
            </div>
          </form>
        )}

        {mode === 'create' && (
          <form className="home-card" onSubmit={onCreate}>
            <h2>Create a party</h2>
            <div className="field">
              <label htmlFor="nick">Nickname</label>
              <input
                id="nick"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                placeholder="Explorer"
                autoFocus
              />
            </div>
            <SettingsPanel value={settings} onChange={saveSettings} />
            <div className="row">
              <button className="btn btn-ghost" type="button" onClick={() => setMode('menu')}>
                Back
              </button>
              <button className="btn" type="submit">
                Create room
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form className="home-card" onSubmit={onJoin}>
            <h2>Join a party</h2>
            <div className="field">
              <label htmlFor="nick2">Nickname</label>
              <input
                id="nick2"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                placeholder="Explorer"
              />
            </div>
            <div className="field">
              <label htmlFor="code">Room code</label>
              <input
                id="code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="XK7P"
                autoFocus
              />
            </div>
            <div className="row">
              <button className="btn btn-ghost" type="button" onClick={() => setMode('menu')}>
                Back
              </button>
              <button className="btn" type="submit" disabled={!joinCode.trim()}>
                Join
              </button>
            </div>
          </form>
        )}

      </div>

      {sourceCommit && sourceCommit !== 'unknown' && (
        <a
          className="build-link"
          href={`https://github.com/kumpelstachu/geokums/commit/${sourceCommit}`}
          target="_blank"
          rel="noreferrer"
          title={sourceCommit}
        >
          build {sourceCommit.slice(0, 8)}
        </a>
      )}
    </div>
  );
}
