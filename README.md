# GeoGuess

Street-view guessing game inspired by GeoGuessr — solo and party multiplayer.

## Stack

- **Client:** Vite + React + TypeScript, Google Street View + Google Maps guess map
- **Server:** Express + Socket.IO (authoritative rooms & scoring)
- **Shared:** distance / score helpers and types

## Docker (single container)

Build (pass the Maps key for the client bundle):

```bash
docker build -t geoguess --build-arg VITE_GOOGLE_MAPS_API_KEY=your_key .
```

Run (server also needs the key to resolve Street View metadata):

```bash
docker run --rm -p 3001:3001 -e GOOGLE_MAPS_API_KEY=your_key geoguess
```

Open http://localhost:3001

## Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. In [Google Cloud Console](https://console.cloud.google.com/google/maps-apis), create a key with **billing enabled** and turn on:

- **Maps JavaScript API** — interactive Street View panoramas
- **Street View Static API** — metadata used to resolve panoramas near coordinates (free quota for metadata)

3. Copy env files and paste the key:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Set the same key as `VITE_GOOGLE_MAPS_API_KEY` (client) and `GOOGLE_MAPS_API_KEY` (server).

Restrict the browser key to `http://localhost:5173/*` (and your prod domain later).

4. Optional — pre-resolve a larger location pack:

```bash
npm run seed
```

Without seeding, the server resolves Street View panoramas from the built-in city list at game start.

5. Run:

```bash
npm run dev
```

- App: http://localhost:5173  
- API / sockets: http://localhost:3001  

## How to play

- **Solo:** Home → Play Solo → look around → pin the map → Confirm. Five rounds, max 5000 pts each.
- **Multiplayer:** Create Room → share the 4-letter code → friends Join Room → host starts.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Client + server in watch mode |
| `npm run build` | Production build |
| `npm start` | Serve built client from the API server |
| `npm run seed` | Refresh Street View location pack via metadata API |

## Notes

- Nicknames only (no accounts); stored in `localStorage`.
- Answers stay on the server until reveal; clients only receive opaque panorama IDs.
- Do not commit `.env` files.
