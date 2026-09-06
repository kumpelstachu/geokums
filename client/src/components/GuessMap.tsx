import { useEffect, useRef } from 'react';
import type { LatLng } from '@geoguess/shared';
import { hasGoogleMapsKey, loadMaps } from '../googleMaps';

const GUESS_COLOR = '#e6c07b';
const ANSWER_COLOR = '#2a9d8f';

function guessIcon() {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: GUESS_COLOR,
    fillOpacity: 1,
    strokeColor: '#0b1f24',
    strokeWeight: 2,
  };
}

type GuessProps = {
  guess: LatLng | null;
  onPick: (ll: LatLng) => void;
  disabled?: boolean;
};

export function GuessMap({ guess, onPick, disabled }: GuessProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const disabledRef = useRef(disabled);
  const guessRef = useRef(guess);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    guessRef.current = guess;
    const map = mapRef.current;
    if (!map) return;

    if (!guess) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }

    const pos = { lat: guess.lat, lng: guess.lng };
    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        map,
        position: pos,
        icon: guessIcon(),
      });
    } else {
      markerRef.current.setPosition(pos);
      markerRef.current.setMap(map);
    }
  }, [guess]);

  useEffect(() => {
    if (!containerRef.current || !hasGoogleMapsKey()) return;
    let cancelled = false;
    let clickListener: google.maps.MapsEventListener | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    loadMaps().then((maps) => {
      if (cancelled || !containerRef.current) return;
      const map = new maps.Map(containerRef.current, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        minZoom: 1,
        maxZoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        keyboardShortcuts: false,
        // Fewer decorative layers → fewer tile requests
        mapTypeId: 'roadmap',
      });
      mapRef.current = map;

      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          google.maps.event.trigger(map, 'resize');
        }, 280);
      });
      resizeObserver.observe(containerRef.current);

      clickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (disabledRef.current || !e.latLng) return;
        onPickRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });

      const current = guessRef.current;
      if (current) {
        markerRef.current = new google.maps.Marker({
          map,
          position: current,
          icon: guessIcon(),
        });
      }
    });

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      clickListener?.remove();
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  if (!hasGoogleMapsKey()) {
    return <div className="guess-map missing-key">Set VITE_GOOGLE_MAPS_API_KEY</div>;
  }

  return <div ref={containerRef} className="guess-map" />;
}

type RevealProps = {
  answer: LatLng;
  guesses: Array<{ guess: LatLng | null; color?: string }>;
};

export function RevealMap({ answer, guesses }: RevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<Array<google.maps.Marker | google.maps.Polyline>>([]);

  useEffect(() => {
    if (!containerRef.current || !hasGoogleMapsKey()) return;
    let cancelled = false;

    loadMaps().then(() => {
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: answer,
          zoom: 3,
          maxZoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          keyboardShortcuts: false,
          mapTypeId: 'roadmap',
        });
      }

      const map = mapRef.current;
      for (const o of overlaysRef.current) o.setMap(null);
      overlaysRef.current = [];

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(answer);

      overlaysRef.current.push(
        new google.maps.Marker({
          map,
          position: answer,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: ANSWER_COLOR,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          zIndex: 2,
        }),
      );

      for (const g of guesses) {
        if (!g.guess) continue;
        bounds.extend(g.guess);
        overlaysRef.current.push(
          new google.maps.Marker({
            map,
            position: g.guess,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: g.color || GUESS_COLOR,
              fillOpacity: 1,
              strokeColor: '#0b1f24',
              strokeWeight: 2,
            },
          }),
        );
        overlaysRef.current.push(
          new google.maps.Polyline({
            map,
            path: [g.guess, answer],
            strokeColor: g.color || GUESS_COLOR,
            strokeOpacity: 0.9,
            strokeWeight: 2,
          }),
        );
      }

      map.fitBounds(bounds, 48);
    });

    return () => {
      cancelled = true;
    };
  }, [answer, guesses]);

  useEffect(() => {
    return () => {
      for (const o of overlaysRef.current) o.setMap(null);
      overlaysRef.current = [];
      mapRef.current = null;
    };
  }, []);

  if (!hasGoogleMapsKey()) {
    return <div className="reveal-map missing-key">Set VITE_GOOGLE_MAPS_API_KEY</div>;
  }

  return <div ref={containerRef} className="reveal-map" />;
}
