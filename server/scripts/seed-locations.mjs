import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

function loadKey() {
  const envPath = join(root, 'server/.env');
  const raw = readFileSync(envPath, 'utf8');
  const line = raw.split(/\r?\n/).find((l) => l.startsWith('GOOGLE_MAPS_API_KEY='));
  if (!line) throw new Error('GOOGLE_MAPS_API_KEY missing in server/.env');
  return line.slice('GOOGLE_MAPS_API_KEY='.length).trim();
}

/** City centers biased toward streets (not malls / interiors). */
const CITIES = [
  { region: 'New York', country: 'USA', lat: 40.7589, lng: -73.9851 },
  { region: 'London', country: 'UK', lat: 51.5033, lng: -0.1195 },
  { region: 'Paris', country: 'France', lat: 48.8606, lng: 2.3376 },
  { region: 'Tokyo', country: 'Japan', lat: 35.6595, lng: 139.7004 },
  { region: 'Sydney', country: 'Australia', lat: -33.8675, lng: 151.207 },
  { region: 'Berlin', country: 'Germany', lat: 52.5208, lng: 13.4094 },
  { region: 'Rome', country: 'Italy', lat: 41.8902, lng: 12.4922 },
  { region: 'Singapore', country: 'Singapore', lat: 1.3006, lng: 103.8558 },
  { region: 'Cape Town', country: 'South Africa', lat: -33.9253, lng: 18.4239 },
  { region: 'Sao Paulo', country: 'Brazil', lat: -23.5489, lng: -46.6388 },
  { region: 'Mumbai', country: 'India', lat: 18.9402, lng: 72.8351 },
  { region: 'Bangkok', country: 'Thailand', lat: 13.746, lng: 100.5347 },
  { region: 'Vancouver', country: 'Canada', lat: 49.2827, lng: -123.1207 },
  { region: 'Stockholm', country: 'Sweden', lat: 59.3293, lng: 18.0686 },
  { region: 'Lisbon', country: 'Portugal', lat: 38.7107, lng: -9.1416 },
  { region: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lng: -58.3816 },
  { region: 'Seoul', country: 'South Korea', lat: 37.5665, lng: 126.978 },
  { region: 'Melbourne', country: 'Australia', lat: -37.8136, lng: 144.9631 },
  { region: 'Amsterdam', country: 'Netherlands', lat: 52.3731, lng: 4.8922 },
  { region: 'Prague', country: 'Czechia', lat: 50.0875, lng: 14.4213 },
  { region: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 },
  { region: 'Vienna', country: 'Austria', lat: 48.2082, lng: 16.3738 },
  { region: 'Helsinki', country: 'Finland', lat: 60.1699, lng: 24.9384 },
  { region: 'Oslo', country: 'Norway', lat: 59.9139, lng: 10.7522 },
  { region: 'Dublin', country: 'Ireland', lat: 53.3498, lng: -6.2603 },
  { region: 'Warsaw', country: 'Poland', lat: 52.2297, lng: 21.0122 },
  { region: 'Budapest', country: 'Hungary', lat: 47.4979, lng: 19.0402 },
  { region: 'Athens', country: 'Greece', lat: 37.9755, lng: 23.7348 },
  { region: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784 },
  { region: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357 },
  { region: 'Nairobi', country: 'Kenya', lat: -1.2864, lng: 36.8172 },
  { region: 'Mexico City', country: 'Mexico', lat: 19.4326, lng: -99.1332 },
  { region: 'Lima', country: 'Peru', lat: -12.0464, lng: -77.0428 },
  { region: 'Santiago', country: 'Chile', lat: -33.4489, lng: -70.6693 },
  { region: 'Hong Kong', country: 'China', lat: 22.2819, lng: 114.1588 },
  { region: 'Taipei', country: 'Taiwan', lat: 25.033, lng: 121.5654 },
  { region: 'Jakarta', country: 'Indonesia', lat: -6.1754, lng: 106.8272 },
  { region: 'Manila', country: 'Philippines', lat: 14.5995, lng: 120.9842 },
  { region: 'Auckland', country: 'New Zealand', lat: -36.8485, lng: 174.7633 },
  { region: 'Chicago', country: 'USA', lat: 41.8827, lng: -87.6233 },
  { region: 'Los Angeles', country: 'USA', lat: 34.0522, lng: -118.2437 },
  { region: 'San Francisco', country: 'USA', lat: 37.7749, lng: -122.4194 },
  { region: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832 },
  { region: 'Milan', country: 'Italy', lat: 45.4642, lng: 9.19 },
  { region: 'Barcelona', country: 'Spain', lat: 41.3874, lng: 2.1686 },
  { region: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708 },
  { region: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lng: -43.1729 },
  { region: 'Montreal', country: 'Canada', lat: 45.5017, lng: -73.5673 },
  { region: 'Brussels', country: 'Belgium', lat: 50.8503, lng: 4.3517 },
  { region: 'Copenhagen', country: 'Denmark', lat: 55.6761, lng: 12.5683 },
];

/** Street-ish offsets around each city (~200–900m). */
const OFFSETS = [
  [0.0015, 0.002],
  [-0.002, 0.0015],
  [0.0025, -0.0018],
  [-0.0012, -0.0024],
  [0.003, 0.0008],
  [-0.0007, 0.0032],
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Outdoor-only Street View metadata lookup. */
async function streetViewOutdoor(key, lat, lng) {
  const url = new URL('https://maps.googleapis.com/maps/api/streetview/metadata');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', '250');
  url.searchParams.set('source', 'outdoor');
  url.searchParams.set('key', key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'REQUEST_DENIED') {
    throw new Error(data.error_message || 'Street View Static API not enabled');
  }
  if (data.status !== 'OK' || !data.pano_id || !data.location) return null;
  const panoId = String(data.pano_id);
  // Skip user-uploaded / Photo Sphere IDs — often indoor or non-road.
  if (panoId.startsWith('CAo')) return null;
  return {
    panoId,
    lat: data.location.lat,
    lng: data.location.lng,
  };
}

async function main() {
  const key = loadKey();

  const probe = await streetViewOutdoor(key, 48.8606, 2.3376);
  if (!probe) {
    console.error('Outdoor Street View probe failed (Paris). Check API key / billing.');
    process.exit(1);
  }
  console.log('Outdoor probe OK');

  const locations = [];
  const seen = new Set();
  let n = 0;

  for (const city of CITIES) {
    let found = 0;
    for (const [dlat, dlng] of OFFSETS) {
      if (found >= 3) break;
      try {
        await sleep(100);
        const hit = await streetViewOutdoor(key, city.lat + dlat, city.lng + dlng);
        if (!hit || seen.has(hit.panoId)) continue;
        seen.add(hit.panoId);
        n += 1;
        found += 1;
        locations.push({
          id: `loc_${String(n).padStart(3, '0')}`,
          panoId: hit.panoId,
          lat: hit.lat,
          lng: hit.lng,
          country: city.country,
          region: city.region,
        });
      } catch (err) {
        if (
          String(err.message).includes('not enabled') ||
          String(err.message).includes('REQUEST_DENIED') ||
          String(err.message).includes('This API')
        ) {
          console.error(`Fatal: ${err.message}`);
          process.exit(1);
        }
      }
    }
    console.log(`${city.region}: ${found} outdoor`);
  }

  if (locations.length < 10) {
    console.error(`Only ${locations.length} locations — aborting write.`);
    process.exit(1);
  }

  const outDir = join(root, 'server/src/data');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'locations.json'), JSON.stringify(locations, null, 2));
  console.log(`Wrote ${locations.length} outdoor locations`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
