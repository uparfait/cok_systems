#!/bin/sh
# Nightly MongoDB backup — dumps the whole database to a compressed archive.
# Run from the project root (where docker-compose.yml and .env live):
#   ./scripts/backup-mongo.sh
# Schedule it with cron (crontab -e):
#   0 2 * * * cd /path/to/cok_systems && ./scripts/backup-mongo.sh >> backups/backup.log 2>&1

set -eu

# Load MONGO_USER / MONGO_PASSWORD from .env
. ./.env 2>/dev/null || { export $(grep -v '^#' .env | xargs); }

STAMP=$(date +%Y-%m-%d_%H-%M)
mkdir -p backups

docker compose exec -T mongo mongodump \
  --username "$MONGO_USER" \
  --password "$MONGO_PASSWORD" \
  --authenticationDatabase admin \
  --archive | gzip > "backups/mongo_${STAMP}.archive.gz"

echo "Backup written: backups/mongo_${STAMP}.archive.gz"

# Keep only the 14 most recent backups
ls -1t backups/mongo_*.archive.gz | tail -n +15 | xargs -r rm --

# Restore example (DESTRUCTIVE — overwrites current data):
#   gunzip -c backups/mongo_YYYY-MM-DD_HH-MM.archive.gz | \
#     docker compose exec -T mongo mongorestore \
#       --username "$MONGO_USER" --password "$MONGO_PASSWORD" \
#       --authenticationDatabase admin --archive --drop
