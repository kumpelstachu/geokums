import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { GameSettings, LatLng, SoloGameState } from '@geoguess/shared';
import { DEFAULT_SETTINGS, formatDistance } from '@geoguess/shared';
import { nextSoloRound, startSolo, submitSoloGuess } from '../api';
import CountryPicker from '../components/CountryPicker';
import GuessDock from '../components/GuessDock';
import { GuessMap, RevealMap } from '../components/GuessMap';
import PanoViewer from '../components/PanoViewer';
import { getStoredSettings } from '../settings';

type NavState = { settings?: GameSettings };

export default function SoloGame() {
  const location = useLocation();
  const nav = (location.state || {}) as NavState;
  const settings = nav.settings || getStoredSettings() || DEFAULT_SETTINGS;

  const [game, setGame] = useState<SoloGameState | null>(null);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [country, setCountry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    startSolo(settings)
      .then((g) => {
        if (alive) setGame(g);
      })
      .catch((e) => setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmGuess() {
    if (!game || busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload =
        game.settings.playMode === 'country'
          ? ({ type: 'country', country } as const)
          : guess
            ? ({ type: 'pin', lat: guess.lat, lng: guess.lng } as const)
            : null;
      if (!payload || (payload.type === 'country' && !payload.country)) {
        setError(game.settings.playMode === 'country' ? 'Pick a country' : 'Place a pin');
        return;
      }
      const next = await submitSoloGuess(game.gameId, payload);
      setGame(next);
      setGuess(null);
      setCountry('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function goNext() {
    if (!game || busy) return;
    setBusy(true);
    try {
      const next = await nextSoloRound(game.gameId);
      setGame(next);
      setGuess(null);
      setCountry('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function playAgain() {
    setBusy(true);
    setError(null);
    try {
      const g = await startSolo(settings);
      setGame(g);
      setGuess(null);
      setCountry('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !game) {
    return (
      <div className="lobby">
        <div className="lobby-panel">
          <h1>Couldn’t start</h1>
          <p className="error">{error}</p>
          <Link className="btn" to="/">
            Home
          </Link>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="lobby">
        <div className="lobby-panel">
          <h1>Loading…</h1>
          <p className="muted">Resolving Street View…</p>
        </div>
      </div>
    );
  }

  if (game.phase === 'finished') {
    return (
      <div className="lobby">
        <div className="lobby-panel">
          <h1 className="score-pop">Final score</h1>
          <p className="muted">
            {game.settings.mapPack === 'poland' ? 'Poland' : 'World'} ·{' '}
            {game.settings.playMode} · {game.settings.movement}
          </p>
          <div className="stat-row">
            <div className="stat">
              <strong>{game.totalScore.toLocaleString()}</strong>
              <span>Total points</span>
            </div>
          </div>
          <ul className="player-list">
            {game.history.map((h, i) => (
              <li key={i}>
                <span>Round {i + 1}</span>
                <span>
                  {h.countryGuess
                    ? `${h.countryGuess}${h.answerCountry ? ` → ${h.answerCountry}` : ''}`
                    : h.distanceKm != null
                      ? formatDistance(h.distanceKm)
                      : '—'}{' '}
                  · {h.score.toLocaleString()} pts
                </span>
              </li>
            ))}
          </ul>
          <div className="row">
            <Link className="btn btn-ghost" to="/">
              Home
            </Link>
            <button className="btn" type="button" onClick={playAgain} disabled={busy}>
              Play again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const canConfirm =
    game.settings.playMode === 'country' ? Boolean(country) : Boolean(guess);

  return (
    <div className="game-layout">
      <PanoViewer
        panoId={game.round.panoId}
        allowMove={game.settings.movement === 'moving'}
        showCompass={game.settings.showCompass}
      />

      <div className="hud hud-top">
        <div className="chip-group">
          <Link className="chip" to="/">
            GeoGuess
          </Link>
          <div className="chip">
            Round {game.round.index + 1}/{game.round.total}
          </div>
          <div className="chip">{game.totalScore.toLocaleString()} pts</div>
          <div className="chip">
            {game.settings.mapPack}/{game.settings.playMode}
            {game.settings.movement === 'noMove' ? ' · NM' : ''}
          </div>
        </div>
      </div>

      {game.phase === 'guessing' && (
        <GuessDock>
          {({ mapReady }) => (
            <>
              {game.settings.playMode === 'country' ? (
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
                  onClick={confirmGuess}
                >
                  Confirm
                </button>
              </div>
              {error && <p className="error">{error}</p>}
            </>
          )}
        </GuessDock>
      )}

      {game.phase === 'reveal' && game.reveal && (
        <div className="overlay-center">
          <div className="card">
            <h2 className="score-pop">+{game.reveal.score.toLocaleString()}</h2>
            <p>
              {game.reveal.countryGuess != null ? (
                <>
                  You: {game.reveal.countryGuess || '—'} · Answer:{' '}
                  {game.reveal.answerCountry || '—'}
                </>
              ) : (
                <>
                  {game.reveal.distanceKm != null
                    ? `You were ${formatDistance(game.reveal.distanceKm)} away`
                    : 'No pin'}{' '}
                  · Total {game.totalScore.toLocaleString()}
                </>
              )}
            </p>
            {game.reveal.guess && (
              <RevealMap
                answer={game.reveal.answer}
                guesses={[{ guess: game.reveal.guess }]}
              />
            )}
            <button className="btn" type="button" onClick={goNext} disabled={busy}>
              {game.round.index >= game.round.total - 1 ? 'See results' : 'Next round'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
