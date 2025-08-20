# syntax=docker/dockerfile:1

# ---------- Dependencies layer ----------
FROM node:20 as deps
WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# ---------- Runtime image ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Copy production node_modules and app source
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Expose API port (configurable via PORT env)
EXPOSE 3001

# Start the server (uses ESM entry from server/src/index.js)
CMD ["node", "src/index.js"]


