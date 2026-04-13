# --- BUILD STAGE ---
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# --- RUNTIME STAGE ---
FROM node:20-slim

WORKDIR /app

# Copy production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy build artifacts and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/api ./api

# Cloud Run defines the PORT environment variable
ENV PORT 8080
EXPOSE 8080

# Start server
CMD ["node", "server/prod-server.mjs"]
