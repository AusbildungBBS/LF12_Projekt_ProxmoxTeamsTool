# syntax=docker/dockerfile:1.7

# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY bridge ./bridge
RUN npx tsc -p bridge/tsconfig.json

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /home/node/app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node --from=builder /app/bridge/dist ./bridge/dist
USER node
EXPOSE 3001
CMD ["node", "bridge/dist/index.js"]
