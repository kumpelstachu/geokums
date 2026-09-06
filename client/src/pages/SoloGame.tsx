import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LatLng, SoloGameState } from '@geoguess/shared';
import { formatDistance } from '@geoguess/shared';
import { nextSoloRound, startSolo, submitSoloGuess } from '../api';
import PanoViewer from '../components/PanoViewer';
import { GuessMap, RevealMap } from '../components/GuessMap';
import GuessDock from '../components/GuessDock';

export default function SoloGame() {
  const [game, setGame] = useState<SoloGameState | null>(null);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    startSolo()
      .then((g) => {
        if (alive) setGame(g);
      })
      .catch((e) => setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  async function confirmGuess() {
    if (!game || !guess || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await submitSoloGuess(game.gameId, guess);
      setGame(next);
      setGuess(null);
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
      const g = await startSolo();
      setGame(g);
      setGuess(null);
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
          <p className="muted">Fetching your first street view</p>
        </div>
      </div>
    );
  }

  if (game.phase === 'finished') {
    return (
      <div className="lobby">
        <div className="lobby-panel">
          <h1 className="score-pop">Final score</h1>
          <p className="muted">Five rounds around the world</p>
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
                  {formatDistance(h.distanceKm)} · {h.score.toLocaleString()} pts
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

  return (
    <div className="game-layout">
      <PanoViewer panoId={game.round.panoId} />

      <div className="hud hud-top">
        <div className="chip-group">
          <Link className="chip" to="/">
            GeoGuess
          </Link>
          <div className="chip">
            Round {game.round.index + 1}/{game.round.total}
          </div>
          <div className="chip">{game.totalScore.toLocaleString()} pts</div>
        </div>
      </div>

      {game.phase === 'guessing' && (
        <GuessDock>
          {({ mapReady }) => (
            <>
              {mapReady ? (
                <GuessMap guess={guess} onPick={setGuess} />
              ) : (
                <div className="guess-map-placeholder">Hover to open map</div>
              )}
              <div className="guess-actions">
                <button
                  className="btn"
                  type="button"
                  disabled={!guess || busy}
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
              You were {formatDistance(game.reveal.distanceKm)} away · Total{' '}
              {game.totalScore.toLocaleString()}
            </p>
            <RevealMap
              answer={game.reveal.answer}
              guesses={[{ guess: game.reveal.guess }]}
            />
            <button className="btn" type="button" onClick={goNext} disabled={busy}>
              {game.round.index >= game.round.total - 1 ? 'See results' : 'Next round'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
