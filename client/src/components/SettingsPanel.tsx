import type { ReactNode } from 'react';
import type { GameSettings, MapPack, MovementMode, PlayMode } from '@geoguess/shared';

type Props = {
  value: GameSettings;
  onChange: (next: GameSettings) => void;
  allowDuels?: boolean;
};

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`mode-chip ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function SettingsPanel({ value, onChange, allowDuels = true }: Props) {
  function set<K extends keyof GameSettings>(key: K, v: GameSettings[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="settings-panel">
      <div className="settings-block">
        <h3>Map</h3>
        <div className="chip-row">
          {([
            ['world', 'World'],
            ['poland', 'Poland'],
          ] as [MapPack, string][]).map(([id, label]) => (
            <Chip key={id} active={value.mapPack === id} onClick={() => set('mapPack', id)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="settings-block">
        <h3>Mode</h3>
        <div className="chip-row">
          {(
            [
              ['classic', 'Classic'],
              ['country', 'Country'],
              ...(allowDuels ? ([['duels', 'Duels']] as [PlayMode, string][]) : []),
            ] as [PlayMode, string][]
          ).map(([id, label]) => (
            <Chip key={id} active={value.playMode === id} onClick={() => set('playMode', id)}>
              {label}
            </Chip>
          ))}
        </div>
        <p className="settings-hint">
          {value.playMode === 'classic' && 'Pin the exact location on the map.'}
          {value.playMode === 'country' && 'Guess the country only — 5,000 if correct.'}
          {value.playMode === 'duels' && '1v1 with 6,000 HP. Score gap = damage.'}
        </p>
      </div>

      <div className="settings-block">
        <h3>Movement</h3>
        <div className="chip-row">
          {([
            ['moving', 'Moving'],
            ['noMove', 'No move'],
          ] as [MovementMode, string][]).map(([id, label]) => (
            <Chip key={id} active={value.movement === id} onClick={() => set('movement', id)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="settings-block settings-row">
        <label className="check-label">
          <input
            type="checkbox"
            checked={value.showCompass}
            onChange={(e) => set('showCompass', e.target.checked)}
          />
          Compass
        </label>
        {value.playMode !== 'duels' && (
          <label className="rounds-label">
            Rounds
            <select
              value={value.rounds}
              onChange={(e) => set('rounds', Number(e.target.value))}
            >
              {[3, 5, 7, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
