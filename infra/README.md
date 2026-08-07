# Infrastructure & Containerization (V31)
#
# Quick start (local API, Redis optional):
#   cp .env.example .env.development
#   npm install
#   npm run server:dev
#
# Docker stack (Redis + PM2 API + workers + gateway + web):
#   docker compose --env-file .env.example up --build -d
#   docker compose up --scale worker=3
#
# Load test (k6):
#   npm run test:load:smoke
#   k6 run -e LOADTEST_VUS=50000 load-test/load-test.js
#
# Endpoints:
#   POST /auth/client   — read-only JWT
#   POST /auth/admin    — admin JWT (ADMIN_BOOTSTRAP_KEY)
#   GET  /health        — worker metrics
#   WS   /ws?token=...  — stadium client socket
