import { useEffect, useRef, useState, type ReactNode } from 'react';

const SHRINK_DELAY_MS = 320;

type Props = {
  children: (state: { expanded: boolean; mapReady: boolean }) => ReactNode;
};

export default function GuessDock({ children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onEnter() {
    clearTimer();
    setMapReady(true);
    setExpanded(true);
  }

  function onLeave() {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setExpanded(false);
      timerRef.current = null;
    }, SHRINK_DELAY_MS);
  }

  useEffect(() => () => clearTimer(), []);

  return (
    <div
      className={`guess-dock ${expanded ? 'expanded' : ''}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children({ expanded, mapReady })}
    </div>
  );
}
