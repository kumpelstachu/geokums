const KEY = 'geoguess_nickname';

export function getStoredNickname(): string {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredNickname(name: string): void {
  try {
    localStorage.setItem(KEY, name.slice(0, 20));
  } catch {
    /* ignore */
  }
}
