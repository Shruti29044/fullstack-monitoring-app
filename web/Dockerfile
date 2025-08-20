# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:20 AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# Ensure correct platform-specific binaries (e.g., esbuild) inside Linux container
RUN npm ci --include=dev || npm install
COPY . .
# Rebuild native/PNPM-optional binaries that may be wrong for this platform
RUN npm rebuild esbuild || true \
  && npm run build

# ---------- Production stage (static files) ----------
FROM nginx:alpine AS prod
WORKDIR /usr/share/nginx/html

# Copy built assets
COPY --from=build /app/dist ./

# Nginx config for SPA + API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


