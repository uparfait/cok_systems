# Deploying COK Systems on the AOS server

The stack: **nginx** (serves the React app + proxies APIs, the only public
container) → **backend** :2026 and **em-backend** :2027 (internal) →
**mongo** (internal, persistent volume). **certbot** renews the HTTPS
certificate automatically.

Replace `ksesm.kigalicity.gov.rw` with your real domain wherever it appears
(this file, `.env`, and both files in `frontend/nginx/`).

---

## 1. Prepare the server (once)

```bash
# Install Docker + Compose plugin
curl -fsSL https://get.docker.com | sh

# Open the only two public ports
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

Also check the AOS control panel for a network-level firewall — ports 80 and
443 must be open there too.

## 2. Get the project onto the server

```bash
git clone <your-repo-url> cok_systems
cd cok_systems
```

## 3. Create the real .env

```bash
cp .env.example .env
chmod 600 .env
openssl rand -hex 32   # run once per secret, paste values into .env
nano .env              # fill in MONGO_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET,
                       # COOKIE_SECRET, and set FRONTEND_URL to your real domain
```

## 4. First start (HTTP only)

```bash
docker compose up -d --build
```

Check everything is running: `docker compose ps` (all services "Up"), and
`docker compose logs backend` / `em-backend` for "Database connected".
At this point `http://<server-ip>` should show the login page.

## 5. Point DNS at the server

Ask whoever manages your domain's DNS zone to add:

- **Type:** A, **Name:** `ksesm`, **Value:** `<server public IP>`, **TTL:** 3600

Wait until `nslookup ksesm.kigalicity.gov.rw` returns the server IP.

## 6. Issue the HTTPS certificate

```bash
docker compose run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  -d ksesm.kigalicity.gov.rw \
  --email it@kigalicity.gov.rw --agree-tos --no-eff-email
```

Success looks like: "Successfully received certificate".

## 7. Switch nginx to HTTPS

```bash
cd frontend/nginx
mv default.conf default-http.conf.disabled
mv default-ssl.conf.disabled default.conf
cd ../..
docker compose restart frontend
```

Open `https://ksesm.kigalicity.gov.rw` — padlock, no warnings. Port 80 now
redirects to HTTPS. Renewal is automatic (the certbot container checks twice
a day; nginx reloads every 6 h to pick up renewed certificates).

## 8. Set up nightly database backups

```bash
chmod +x scripts/backup-mongo.sh
./scripts/backup-mongo.sh          # test it once
crontab -e                         # then add:
# 0 2 * * * cd /path/to/cok_systems && ./scripts/backup-mongo.sh >> backups/backup.log 2>&1
```

Backups land in `backups/` (14 most recent kept). Copy them off the server
periodically. Restore instructions are at the bottom of the script.

---

## Day-2 operations

| Task | Command |
|---|---|
| Deploy a code update | `git pull && docker compose up -d --build` |
| View logs | `docker compose logs -f backend` (or `em-backend`, `frontend`) |
| Restart one service | `docker compose restart backend` |
| Stop everything | `docker compose down` (data survives — it lives in volumes) |
| Check disk usage | `docker system df`; clean old images: `docker image prune -f` |

## Notes

- The first user accounts must exist in the database. Since this deployment
  starts with an **empty** MongoDB (it does not copy your Atlas data), either
  seed an initial admin user, or migrate the Atlas data once:
  `mongodump` against Atlas, then `mongorestore` into the container
  (same pattern as the restore example in `scripts/backup-mongo.sh`).
- Uploaded files persist in the `backend_uploads` / `em_uploads` volumes.
- The database is never exposed publicly — only nginx listens on the host.
