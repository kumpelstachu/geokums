import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { GameStatePublic, LatLng } from '@geoguess/shared';
import { formatDistance } from '@geoguess/shared';
import PanoViewer from '../components/PanoViewer';
import { GuessMap, RevealMap } from '../components/GuessMap';
import GuessDock from '../components/GuessDock';
import { formatTimer, useCountdown } from '../hooks/useCountdown';
import { getStoredNickname } from '../nickname';
import {
  createRoom,
  getSocket,
  joinRoom,
  leaveRoom,
  nextRound,
  onGameState,
  startGame,
  submitGuess,
} from '../socket';

type NavState = { intent?: 'create' | 'join'; nickname?: string };

export default function Multiplayer() {
  const { code: codeParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = (location.state || {}) as NavState;

  const [state, setState] = useState<GameStatePublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [busy, setBusy] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);

  const timeLeft = useCountdown(state?.roundEndsAt ?? null);

  const me = useMemo(
    () => state?.players.find((p) => p.id === selfId) ?? null,
    [state, selfId],
  );

  useEffect(() => {
    const nickname = nav.nickname || getStoredNickname() || 'Explorer';
    let cancelled = false;

    (async () => {
      try {
        let next: GameStatePublic;
        if (nav.intent === 'create' || (!codeParam && nav.intent !== 'join')) {
          next = await createRoom(nickname);
          if (!cancelled) navigate(`/play/${next.roomCode}`, { replace: true, state: nav });
        } else if (codeParam) {
          next = await joinRoom(codeParam, nickname);
        } else {
          throw new Error('Missing room');
        }
        if (cancelled) return;
        setState(next);
        setSelfId(getSocket().id ?? null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    const off = onGameState((s) => {
      setState((prev) => {
        if (prev?.round?.index !== s.round?.index || prev?.phase !== s.phase) {
          setGuess(null);
        }
        return s;
      });
      setSelfId(getSocket().id ?? null);
    });

    return () => {
      cancelled = true;
      off();
      leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onStart() {
    setBusy(true);
    setError(null);
    try {
      await startGame();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    if (!guess || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitGuess(guess);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onNext() {
    setBusy(true);
    try {
      await nextRound();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !state) {
    return (
      <div className="lobby">
        <div className="lobby-panel">
          <h1>Couldn’t join</h1>
          <p className="error">{error}</p>
          <Link className="btn" to="/">
            Home
          </Link>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="lobby">
        <div className="lobby-panel">
          <h1>Connecting…</h1>
          <p className="muted">Setting up your room</p>
        </div>
      </div>
    );
  }

  if (state.phase === 'lobby') {
    return (
      <div className="lobby">
        <div className="lobby-panel">
          <h1>Party lobby</h1>
          <p className="muted">Share the code so friends can join</p>
          <div className="code-pill">{state.roomCode}</div>
          <ul className="player-list">
            {state.players.map((p) => (
              <li key={p.id}>
                <span>
                  {p.nickname}
                  {p.isHost ? ' · host' : ''}
                  {p.id === selfId ? ' (you)' : ''}
                </span>
                <span className="muted">{p.connected ? 'ready' : 'away'}</span>
              </li>
            ))}
          </ul>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <Link className="btn btn-ghost" to="/" onClick={() => leaveRoom()}>
              Leave
            </Link>
            {me?.isHost && (
              <button className="btn" type="button" onClick={onStart} disabled={busy}>
                Start game
              </button>
            )}
            {!me?.isHost && <p className="muted">Waiting for host to start…</p>}
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'finished') {
    const ranked = [...state.players].sort((a, b) => b.score - a.score);
    return (
      <div className="lobby">
        <div className="lobby-panel">
          <h1 className="score-pop">Results</h1>
          <p className="muted">Room {state.roomCode}</p>
          <ul className="player-list">
            {ranked.map((p, i) => (
              <li key={p.id}>
                <span>
                  #{i + 1} {p.nickname}
                </span>
                <span>{p.score.toLocaleString()} pts</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <Link className="btn" to="/">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasGuessed = me?.hasGuessed ?? false;

  return (
    <div className="game-layout">
      {state.round && <PanoViewer panoId={state.round.panoId} />}

      <div className="hud hud-top">
        <div className="chip-group">
          <div className="chip">GeoGuess · {state.roomCode}</div>
          {state.round && (
            <div className="chip">
              Round {state.round.index + 1}/{state.round.total}
            </div>
          )}
          {state.phase === 'guessing' && state.roundEndsAt && (
            <div className="chip">{formatTimer(timeLeft)}</div>
          )}
        </div>
        <div className="scoreboard">
          <h3>Scoreboard</h3>
          <ul>
            {[...state.players]
              .sort((a, b) => b.score - a.score)
              .map((p) => (
                <li key={p.id}>
                  <span>
                    {p.nickname}
                    {state.phase === 'guessing' ? (p.hasGuessed ? ' ✓' : '') : ''}
                  </span>
                  <span>{p.score.toLocaleString()}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>

      {state.phase === 'guessing' && !hasGuessed && (
        <GuessDock>
          {({ mapReady }) => (
            <>
              {mapReady ? (
                <GuessMap guess={guess} onPick={setGuess} />
              ) : (
                <div className="guess-map-placeholder">Hover to open map</div>
              )}
              <div className="guess-actions">
                <button className="btn" type="button" disabled={!guess || busy} onClick={onConfirm}>
                  Confirm
                </button>
              </div>
              {error && <p className="error">{error}</p>}
            </>
          )}
        </GuessDock>
      )}

      {state.phase === 'guessing' && hasGuessed && (
        <div className="overlay-center" style={{ background: 'transparent', pointerEvents: 'none' }}>
          <div className="chip">Waiting for other players…</div>
        </div>
      )}

      {state.phase === 'reveal' && state.reveal && (
        <div className="overlay-center">
          <div className="card">
            <h2>Round results</h2>
            <RevealMap
              answer={state.reveal.answer}
              guesses={state.reveal.guesses.map((g) => ({ guess: g.guess }))}
            />
            <ul className="player-list">
              {state.reveal.guesses
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((g) => (
                  <li key={g.playerId}>
                    <span>{g.nickname}</span>
                    <span>
                      {g.distanceKm != null ? formatDistance(g.distanceKm) : '—'} · +
                      {g.score.toLocaleString()}
                    </span>
                  </li>
                ))}
            </ul>
            {me?.isHost ? (
              <button className="btn" type="button" onClick={onNext} disabled={busy}>
                {state.round && state.round.index >= state.round.total - 1
                  ? 'Final results'
                  : 'Next round'}
              </button>
            ) : (
              <p className="muted">Waiting for host…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
