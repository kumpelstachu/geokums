import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Location } from '@geoguess/shared';
import { resolveStreetView } from '../streetview.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, 'locations.json'), 'utf8');
export const LOCATIONS: Location[] = JSON.parse(raw);

function shuffle<T>(arr: T[]): T[] {
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** Pick random locations and resolve Street View pano IDs (snaps lat/lng to coverage). */
export async function sampleLocations(count: number): Promise<Location[]> {
  if (LOCATIONS.length === 0) {
    throw new Error('No locations loaded.');
  }

  const pool = shuffle(LOCATIONS);
  const picked: Location[] = [];

  for (const candidate of pool) {
    if (picked.length >= count) break;
    try {
      if (candidate.panoId) {
        picked.push({ ...candidate });
        continue;
      }
      const resolved = await resolveStreetView(candidate.lat, candidate.lng);
      picked.push({
        ...candidate,
        panoId: resolved.panoId,
        lat: resolved.lat,
        lng: resolved.lng,
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (
        picked.length === 0 &&
        (msg.includes('not enabled') ||
          msg.includes('GOOGLE_MAPS_API_KEY') ||
          msg.includes('Street View Static API'))
      ) {
        throw err;
      }
      // try next candidate
    }
  }

  if (picked.length < count) {
    throw new Error(
      `Could only resolve ${picked.length}/${count} Street View locations. Enable Street View Static API and run npm run seed.`,
    );
  }

  return picked;
}
