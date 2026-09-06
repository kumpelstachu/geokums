import { useEffect, useRef, useState } from 'react';
import { hasGoogleMapsKey, loadStreetView } from '../googleMaps';
import Compass from './Compass';

type Props = {
  panoId: string;
  allowMove?: boolean;
  showCompass?: boolean;
};

export default function PanoViewer({
  panoId,
  allowMove = true,
  showCompass = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !hasGoogleMapsKey()) return;
    let cancelled = false;
    let povListener: google.maps.MapsEventListener | null = null;

    loadStreetView()
      .then((streetView) => {
        if (cancelled || !containerRef.current) return;

        if (!panoramaRef.current) {
          panoramaRef.current = new streetView.StreetViewPanorama(containerRef.current, {
            pano: panoId,
            visible: true,
            addressControl: false,
            showRoadLabels: false,
            fullscreenControl: false,
            motionTracking: false,
            motionTrackingControl: false,
            enableCloseButton: false,
            linksControl: allowMove,
            panControl: true,
            zoomControl: true,
            zoom: 0,
          });
        } else {
          panoramaRef.current.setOptions({ linksControl: allowMove });
          panoramaRef.current.setVisible(true);
        }

        const panorama = panoramaRef.current;
        povListener = panorama.addListener('pov_changed', () => {
          setHeading(panorama.getPov().heading || 0);
        });
        setHeading(panorama.getPov().heading || 0);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e?.message ||
              'Failed to load Street View. Enable Maps JavaScript API for this key.',
          );
        }
      });

    return () => {
      cancelled = true;
      povListener?.remove();
    };
  }, [panoId, allowMove]);

  useEffect(() => {
    const panorama = panoramaRef.current;
    if (!panorama || !panoId) return;
    if (panorama.getPano() !== panoId) {
      panorama.setPano(panoId);
    }
    panorama.setOptions({ linksControl: allowMove });
  }, [panoId, allowMove]);

  if (!hasGoogleMapsKey()) {
    return (
      <div className="pano" style={{ display: 'grid', placeItems: 'center', color: '#e8f4f2' }}>
        <p>Set VITE_GOOGLE_MAPS_API_KEY in client/.env</p>
      </div>
    );
  }

  return (
    <div className="pano">
      <div ref={containerRef} className="street-view" style={{ width: '100%', height: '100%' }} />
      {showCompass && <Compass heading={heading} />}
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,0.65)',
            color: '#e8f4f2',
            padding: '1.25rem',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
