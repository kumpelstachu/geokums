import { useEffect, useRef, useState } from 'react';
import { hasGoogleMapsKey, loadStreetView } from '../googleMaps';

type Props = {
  panoId: string;
};

export default function PanoViewer({ panoId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !hasGoogleMapsKey()) return;
    let cancelled = false;

    loadStreetView()
      .then((streetView) => {
        if (cancelled || !containerRef.current) return;

        const existing = panoramaRef.current;
        if (existing) {
          existing.setVisible(true);
          return;
        }

        panoramaRef.current = new streetView.StreetViewPanorama(containerRef.current, {
          pano: panoId,
          visible: true,
          addressControl: false,
          showRoadLabels: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          enableCloseButton: false,
          linksControl: true,
          panControl: true,
          zoomControl: true,
          zoom: 0,
        });
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
    };
  }, [panoId]);

  useEffect(() => {
    const panorama = panoramaRef.current;
    if (!panorama || !panoId) return;
    if (panorama.getPano() !== panoId) {
      panorama.setPano(panoId);
    }
  }, [panoId]);

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
