# Main backend (auth, service delivery, smart parking, feedback) — port 2026
FROM node:22-alpine

WORKDIR /app

# Install production dependencies first (cached unless package.json changes)
COPY package*.json ./

RUN npm install

RUN npm ci --omit=dev

# Copy application source
COPY . .

ENV NODE_ENV=production
EXPOSE 2026

CMD ["node", "main.js"]
