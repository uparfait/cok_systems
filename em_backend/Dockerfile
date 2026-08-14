# Event management backend (events, rooms, bookings, actions) — port 2027
FROM node:22-alpine

WORKDIR /app

# Install production dependencies first (cached unless package.json changes)
COPY package*.json ./

RUN npm install

RUN npm ci --omit=dev

# Copy application source
COPY . .
COPY .env .env   

ENV NODE_ENV=production
EXPOSE 2027

CMD ["node", "server.js"]
