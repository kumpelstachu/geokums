import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getStoredNickname, setStoredNickname } from '../nickname';

export default function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(getStoredNickname);
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');

  function saveName(name: string) {
    const n = name.trim() || 'Explorer';
    setStoredNickname(n);
    return n;
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    const n = saveName(nickname);
    navigate('/play', { state: { intent: 'create', nickname: n } });
  }

  function onJoin(e: FormEvent) {
    e.preventDefault();
    const n = saveName(nickname);
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/play/${code}`, { state: { intent: 'join', nickname: n } });
  }

  return (
    <div className="app-shell home">
      <div className="home-panel">
        <h1 className="brand">GeoGuess</h1>
        <p>Drop into street-level views around the world. Pin the map. Race your friends.</p>

        {mode === 'menu' && (
          <div className="home-actions">
            <Link className="btn" to="/solo">
              Play Solo
            </Link>
            <button className="btn btn-teal" type="button" onClick={() => setMode('create')}>
              Create Room
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setMode('join')}>
              Join Room
            </button>
          </div>
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
    </div>
  );
}
