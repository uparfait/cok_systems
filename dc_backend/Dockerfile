# Data Collection System backend (forms, projects, submissions) - port 8765
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 8765

CMD ["node", "main.js"]
