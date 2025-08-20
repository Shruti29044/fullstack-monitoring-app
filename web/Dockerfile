# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:20 AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# Ensure dev deps (vite) are installed for build
RUN npm ci --include=dev || npm install
COPY . .
# Ensure Vite binary is executable and build using npx
RUN chmod +x node_modules/.bin/vite || true \
  && chmod +x node_modules/vite/bin/vite.js || true \
  && npx vite build

# ---------- Production stage (static files) ----------
FROM nginx:alpine AS prod
WORKDIR /usr/share/nginx/html

# Copy built assets
COPY --from=build /app/dist ./

# Nginx config for SPA + API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


