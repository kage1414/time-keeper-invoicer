# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ .
RUN yarn build

# Stage 2: Build backend
FROM node:22-alpine AS backend-builder
WORKDIR /app
COPY backend/package.json backend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY backend/ .
RUN yarn build

# Stage 3: Install production dependencies (needs build tools for better-sqlite3)
FROM node:22-alpine AS prod-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY backend/package.json backend/yarn.lock ./
RUN yarn install --frozen-lockfile --production

# Stage 4: Production
FROM node:22-alpine
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/dist ./public
ENV DATABASE_PATH=/data/db.sqlite
VOLUME ["/data"]
EXPOSE 4000
CMD ["node", "dist/index.js"]
