# ---------- Stage 1: build the React app ----------
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./


COPY . .     
COPY .env .env       

# Socket.io must connect to the same origin in production (nginx proxies
# /socket.io to the backend). Without this, SocketContext falls back to a
# hardcoded external URL.
ARG VITE_SOCKET_URL=/
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm install

RUN npm run build

# ---------- Stage 2: serve with nginx ----------
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Baked-in default config (docker-compose mounts ./frontend/nginx over this,
# so config changes on the server do not require a rebuild)
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
