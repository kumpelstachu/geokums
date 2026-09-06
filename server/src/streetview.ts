import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadKey(): string | undefined {
  try {
    const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    const raw = readFileSync(join(serverRoot, '.env'), 'utf8');
    const line = raw.split(/\r?\n/).find((l) => l.startsWith('GOOGLE_MAPS_API_KEY='));
    return line?.slice('GOOGLE_MAPS_API_KEY='.length).trim();
  } catch {
    return process.env.GOOGLE_MAPS_API_KEY;
  }
}

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || loadKey();

export type ResolvedPano = {
  panoId: string;
  lat: number;
  lng: number;
};

export async function resolveStreetView(
  lat: number,
  lng: number,
): Promise<ResolvedPano> {
  if (!API_KEY) {
    throw new Error(
      'GOOGLE_MAPS_API_KEY missing. Set it in server/.env and enable Street View Static API.',
    );
  }

  const url = new URL('https://maps.googleapis.com/maps/api/streetview/metadata');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', '250');
  url.searchParams.set('source', 'outdoor');
  url.searchParams.set('key', API_KEY);

  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    pano_id?: string;
    location?: { lat: number; lng: number };
  };

  if (data.status === 'REQUEST_DENIED') {
    throw new Error(
      data.error_message ||
        'Street View Static API is not enabled for this Google Cloud project.',
    );
  }
  if (data.status !== 'OK' || !data.pano_id || !data.location) {
    throw new Error(`No Street View near ${lat},${lng} (${data.status})`);
  }

  const panoId = String(data.pano_id);
  if (panoId.startsWith('CAo')) {
    throw new Error(`Indoor/user pano near ${lat},${lng}`);
  }

  return {
    panoId,
    lat: data.location.lat,
    lng: data.location.lng,
  };
}
