import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ChatMessage, GameSettings, GameStatePublic, LatLng } from '@geoguess/shared';
import { DEFAULT_SETTINGS, formatDistance } from '@geoguess/shared';
import CountryPicker from '../components/CountryPicker';
import GuessDock from '../components/GuessDock';
import { GuessMap, RevealMap } from '../components/GuessMap';
import PanoViewer from '../components/PanoViewer';
import RoomChat from '../components/RoomChat';
import SettingsPanel from '../components/SettingsPanel';
import { formatTimer, useCountdown } from '../hooks/useCountdown';
import { getStoredNickname } from '../nickname';
import { getStoredSettings } from '../settings';
import {
  createRoom,
  getSocket,
  joinRoom,
  leaveRoom,
  nextRound,
  onChatMessage,
  onGameState,
  rematch,
  returnToLobby,
  startGame,
  submitGuess,
  updateRoomSettings,
} from '../socket';

type NavState = {
  intent?: 'create' | 'join';
  nickname?: string;
  settings?: GameSettings;
};

export default function Multiplayer() {
  const { code: codeParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = (location.state || {}) as NavState;

  const [state, setState] = useState<GameStatePublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);

  const timeLeft = useCountdown(state?.roundEndsAt ?? null);
  const me = useMemo(
    () => state?.players.find((p) => p.id === selfId) ?? null,
    [state, selfId],
  );

  useEffect(() => {
    const nickname = nav.nickname || getStoredNickname() || 'Explorer';
    const settings = nav.settings || getStoredSettings() || DEFAULT_SETTINGS;
    let cancelled = false;

    (async () => {
      try {
        let next: GameStatePublic;
        if (nav.intent === 'create' || (!codeParam && nav.intent !== 'join')) {
          next = await createRoom(nickname, settings);
          if (!cancelled) navigate(`/play/${next.roomCode}`, { replace: true, state: nav });
        } else if (codeParam) {
          next = await joinRoom(codeParam, nickname);
        } else {
          throw new Error('Missing room');
        }
        if (cancelled) return;
        setState(next);
        setChat(next.chat || []);
        setSelfId(getSocket().id ?? null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    const off = onGameState((s) => {
      setState((prev) => {
        if (prev?.round?.index !== s.round?.index || prev?.phase !== s.phase) {
          setGuess(null);
          setCountry('');
        }
        return s;
      });
      if (s.chat) setChat(s.chat);
      setSelfId(getSocket().id ?? null);
    });

    const offChat = onChatMessage((msg) => {
      setChat((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg].slice(-50);
      });
    });

    return () => {
      cancelled = true;
      off();
      offChat();
      leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSettingsChange(next: GameSettings) {
    if (!me?.isHost) return;
    try {
      await updateRoomSettings(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onRematch() {
    setBusy(true);
    setError(null);
    try {
      await rematch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onLobby() {
    setBusy(true);
    setError(null);
    try {
      await returnToLobby();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (state.settings.playMode === 'country') {
        if (!country) throw new Error('Pick a country');
        await submitGuess({ type: 'country', country });
      } else {
        if (!guess) throw new Error('Place a pin');
        await submitGuess({ type: 'pin', lat: guess.lat, lng: guess.lng });
      }
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
          <h1>{state.isDuel ? 'Duel lobby' : 'Party lobby'}</h1>
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
          {me?.isHost ? (
            <SettingsPanel value={state.settings} onChange={onSettingsChange} />
          ) : (
            <p className="muted">
              {state.settings.mapPack}/{state.settings.playMode}/
              {state.settings.movement}
              {state.settings.showCompass ? ' · compass' : ''}
            </p>
          )}
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
          <RoomChat messages={chat} selfId={selfId} />
        </div>
      </div>
    );
  }

  if (state.phase === 'finished') {
    const ranked = [...state.players].sort((a, b) =>
      state.isDuel ? b.hp - a.hp || b.score - a.score : b.score - a.score,
    );
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
                <span>
                  {state.isDuel
                    ? `${p.hp.toLocaleString()} HP · ${p.score.toLocaleString()} pts`
                    : `${p.score.toLocaleString()} pts`}
                </span>
              </li>
            ))}
          </ul>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <Link className="btn btn-ghost" to="/" onClick={() => leaveRoom()}>
              Home
            </Link>
            {me?.isHost ? (
              <>
                <button className="btn btn-ghost" type="button" onClick={onLobby} disabled={busy}>
                  Lobby
                </button>
                <button className="btn" type="button" onClick={onRematch} disabled={busy}>
                  Rematch
                </button>
              </>
            ) : (
              <p className="muted">Waiting for host to rematch…</p>
            )}
          </div>
          <RoomChat messages={chat} selfId={selfId} />
        </div>
      </div>
    );
  }

  const hasGuessed = me?.hasGuessed ?? false;
  const canConfirm =
    state.settings.playMode === 'country' ? Boolean(country) : Boolean(guess);

  return (
    <div className="game-layout">
      {state.round && (
        <PanoViewer
          panoId={state.round.panoId}
          allowMove={state.settings.movement === 'moving'}
          showCompass={state.settings.showCompass}
        />
      )}

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
          <h3>{state.isDuel ? 'Health' : 'Scoreboard'}</h3>
          <ul>
            {[...state.players]
              .sort((a, b) => (state.isDuel ? b.hp - a.hp : b.score - a.score))
              .map((p) => (
                <li key={p.id}>
                  <span>
                    {p.nickname}
                    {state.phase === 'guessing' ? (p.hasGuessed ? ' ✓' : '') : ''}
                  </span>
                  <span>
                    {state.isDuel
                      ? `${p.hp.toLocaleString()} HP`
                      : p.score.toLocaleString()}
                  </span>
                </li>
              ))}
          </ul>
          {state.isDuel && (
            <div className="hp-bars">
              {state.players.map((p) => (
                <div key={p.id} className="hp-bar-wrap">
                  <div className="hp-bar" style={{ width: `${(p.hp / 6000) * 100}%` }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {state.phase === 'guessing' && !hasGuessed && (
        <GuessDock>
          {({ mapReady }) => (
            <>
              {state.settings.playMode === 'country' ? (
                <div className="guess-map country-panel">
                  <CountryPicker value={country} onChange={setCountry} />
                </div>
              ) : mapReady ? (
                <GuessMap guess={guess} onPick={setGuess} />
              ) : (
                <div className="guess-map-placeholder">Hover to open map</div>
              )}
              <div className="guess-actions">
                <button
                  className="btn"
                  type="button"
                  disabled={!canConfirm || busy}
                  onClick={onConfirm}
                >
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
            {state.reveal.answerCountry && (
              <p className="muted">Answer: {state.reveal.answerCountry}</p>
            )}
            {state.settings.playMode !== 'country' && (
              <RevealMap
                answer={state.reveal.answer}
                guesses={state.reveal.guesses.map((g) => ({ guess: g.guess }))}
              />
            )}
            <ul className="player-list">
              {state.reveal.guesses
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((g) => (
                  <li key={g.playerId}>
                    <span>{g.nickname}</span>
                    <span>
                      {g.countryGuess
                        ? g.countryGuess
                        : g.distanceKm != null
                          ? formatDistance(g.distanceKm)
                          : '—'}{' '}
                      · +{g.score.toLocaleString()}
                      {g.damageTaken > 0 ? ` · −${g.damageTaken} HP` : ''}
                    </span>
                  </li>
                ))}
            </ul>
            {me?.isHost ? (
              <button className="btn" type="button" onClick={onNext} disabled={busy}>
                Continue
              </button>
            ) : (
              <p className="muted">Waiting for host…</p>
            )}
          </div>
        </div>
      )}

      <RoomChat messages={chat} selfId={selfId} collapsed />
    </div>
  );
}
