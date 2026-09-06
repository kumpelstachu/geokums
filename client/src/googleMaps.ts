import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

let optionsSet = false;
let mapsPromise: Promise<google.maps.MapsLibrary> | null = null;

export function hasGoogleMapsKey(): boolean {
  return Boolean(API_KEY);
}

export async function loadMaps(): Promise<google.maps.MapsLibrary> {
  if (!API_KEY) throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY');
  if (!optionsSet) {
    setOptions({ key: API_KEY, v: 'weekly' });
    optionsSet = true;
  }
  if (!mapsPromise) {
    mapsPromise = importLibrary('maps');
  }
  return mapsPromise;
}

export async function loadStreetView(): Promise<google.maps.StreetViewLibrary> {
  if (!API_KEY) throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY');
  if (!optionsSet) {
    setOptions({ key: API_KEY, v: 'weekly' });
    optionsSet = true;
  }
  return importLibrary('streetView');
}
