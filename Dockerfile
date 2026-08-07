# V31 — Pulse / Reji multi-stage container build
# Targets: deps | web-build | web | api

ARG NODE_VERSION=22

# ─── Dependencies ───────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=optional

COPY . .

# ─── Expo Web static export ─────────────────────────────────
FROM deps AS web-build
ENV NODE_ENV=production
ENV EXPO_NO_TELEMETRY=1
# Public client config baked at build time
ARG EXPO_PUBLIC_APP_ENV=production
ARG EXPO_PUBLIC_WS_HOST=localhost
ARG EXPO_PUBLIC_WS_PORT=8080
ARG EXPO_PUBLIC_WS_SECURE=false
ARG EXPO_PUBLIC_WS_PATH=/ws
ARG EXPO_PUBLIC_JWT_SECRET
ARG EXPO_PUBLIC_PTP_NETWORK_BUFFER_MS=80
ENV EXPO_PUBLIC_APP_ENV=$EXPO_PUBLIC_APP_ENV \
    EXPO_PUBLIC_WS_HOST=$EXPO_PUBLIC_WS_HOST \
    EXPO_PUBLIC_WS_PORT=$EXPO_PUBLIC_WS_PORT \
    EXPO_PUBLIC_WS_SECURE=$EXPO_PUBLIC_WS_SECURE \
    EXPO_PUBLIC_WS_PATH=$EXPO_PUBLIC_WS_PATH \
    EXPO_PUBLIC_JWT_SECRET=$EXPO_PUBLIC_JWT_SECRET \
    EXPO_PUBLIC_PTP_NETWORK_BUFFER_MS=$EXPO_PUBLIC_PTP_NETWORK_BUFFER_MS

RUN npx expo export -p web

# ─── Nginx static frontend ──────────────────────────────────
FROM nginx:1.27-alpine AS web
COPY infra/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

# ─── API / Worker (PM2 cluster) ─────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS api
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    WS_PATH=/ws \
    PM2_HOME=/tmp/pm2 \
    EXPO_NO_TELEMETRY=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r reji && useradd -r -g reji -d /app reji

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional && npm install tsx pm2 --no-save \
    && npm cache clean --force

COPY src ./src
COPY server ./server
COPY tsconfig.json ./

USER reji
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "pm2-runtime", "start", "server/ecosystem.config.cjs"]
