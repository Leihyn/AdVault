# Stage 1: Build web frontend
FROM node:20-slim AS web-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install --legacy-peer-deps
COPY web/ ./
RUN npm run build

# Stage 2: Build server
FROM node:20-slim AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --legacy-peer-deps
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Production
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server build and dependencies
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/package.json ./server/package.json
COPY --from=server-build /app/server/prisma ./server/prisma

# Copy web build into web/dist (server serves this via @fastify/static)
COPY --from=web-build /app/web/dist ./web/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

WORKDIR /app/server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
