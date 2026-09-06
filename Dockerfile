# syntax=docker/dockerfile:1

# --- build ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

RUN npm ci

COPY shared shared
COPY server server
COPY client client

# Browser key is baked into the client bundle at build time
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

RUN npm run build -w shared \
  && npm run build -w server \
  && npm run build -w client

# --- run ---
FROM node:22-alpine AS runner
WORKDIR /app

ARG SOURCE_COMMIT=unknown
ENV SOURCE_COMMIT=$SOURCE_COMMIT
ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist

RUN npm ci --omit=dev -w server -w shared \
  && npm cache clean --force \
  && chown -R node:node /app

USER node
EXPOSE 3001

CMD ["node", "server/dist/index.js"]
