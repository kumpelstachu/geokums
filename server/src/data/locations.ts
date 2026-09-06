import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Location, MapPack } from '@geoguess/shared';
import { resolveStreetView } from '../streetview.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, 'locations.json'), 'utf8');
const ALL: Location[] = JSON.parse(raw).map((loc: Location) => ({
  ...loc,
  pack: loc.pack || (loc.country === 'Poland' ? 'poland' : 'world'),
}));

export const LOCATIONS: Location[] = ALL;

function shuffle<T>(arr: T[]): T[] {
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function poolForPack(pack: MapPack): Location[] {
  if (pack === 'poland') {
    const pl = ALL.filter((l) => l.pack === 'poland' || l.country === 'Poland');
    return pl.length ? pl : ALL;
  }
  // world = everything (including Poland)
  return ALL;
}

/** Pick random locations and resolve Street View pano IDs (snaps lat/lng to coverage). */
export async function sampleLocations(
  count: number,
  pack: MapPack = 'world',
): Promise<Location[]> {
  const source = poolForPack(pack);
  if (source.length === 0) {
    throw new Error('No locations loaded for this map.');
  }

  const pool = shuffle(source);
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
    }
  }

  if (picked.length < count) {
    throw new Error(
      `Could only resolve ${picked.length}/${count} Street View locations for map "${pack}".`,
    );
  }

  return picked;
}

/** Dev helper: rewrite locations.json with pack tags (unused at runtime). */
export function writeTaggedLocations(path = join(__dirname, 'locations.json')) {
  writeFileSync(path, JSON.stringify(ALL, null, 2));
}
