# Data Collection System backend (forms, projects, submissions) - port 8765
#
# Built from the REPOSITORY ROOT (docker-compose.override.yml, tracked in git,
# sets context: . and dockerfile: dc_backend/Dockerfile for this service;
# docker compose merges it automatically), because the code reaches one folder up
# for two things that live beside it: ../location.min.json, required at
# startup, and ../../geojson-maped/, the map outlines. Inside the image the
# application sits in /app, so those land at / to keep the same relative
# paths. The root .dockerignore keeps everything else out of the context.
FROM node:22-alpine

WORKDIR /app

COPY dc_backend/package*.json ./
RUN npm ci --omit=dev

COPY dc_backend/ ./
COPY location.min.json /location.min.json
COPY geojson-maped/ /geojson-maped/

ENV NODE_ENV=production
EXPOSE 8765

CMD ["node", "main.js"]
