# Deployment Guidance

## Introduction

### Purpose

This guide walks you through deploying the IKAZE(Ikaze) application from start to finish. It is written for system administrators, DevOps engineers, and developers who need to set up the system on a Linux server using Docker. Follow the steps in order for a first-time deployment. Later sections help with day-to-day maintenance, backups, and fixing common problems.

### Scope

This guide covers the full production deployment of three services: the main backend API, the event management backend API, and the React frontend. It also covers the MongoDB database, SSL certificate setup, automated backups, and basic troubleshooting.

---

## System Overview

### Architecture Overview

The application runs inside Docker containers and talks to each other over a private Docker network. Only one container is exposed to the public internet.

```
Public Internet
      |
      v
  nginx (frontend container) -- listens on ports 80 and 443
      |
      +--- proxies /cok/api      --> backend  :2026
      +--- proxies /cok/api/v1   --> em-backend :2027
      +--- proxies /uploads      --> backend  :2026
      +--- proxies /socket.io    --> backend  :2026
      +--- serves React files    --> inside the same container
      |
      v
  mongo --- this only reachable inside Docker, never exposed publicly
```

The domain name (for example `uat-ikaze.kigalicity.gov.rw`) points to the server's public IP address. The nginx container handles the HTTPS encryption and forwards requests to the backend services.

### Technology Stack

| Part | What it uses |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Radix UI |
| Main backend | Node.js 22, Express.js v5, MongoDB with Mongoose, Socket.IO, JWT |
| Event backend | Node.js 22, Express.js v5, MongoDB with Mongoose, JWT, QR code generation |
| Database | MongoDB v7 |
| Reverse proxy | nginx (Alpine) |
| SSL certificates | Let's Encrypt via certbot |
| Container runtime | Docker and Docker Compose |

---

## Deployment Prerequisites

### Hardware Requirements

- A virtual private server or physical server with at least 4 CPU cores and 8 GB of RAM. 50 GB (for now 75 GB used) of disk space is enough for the operating system, Docker images, and database storage. More space is recommended if large files expected to be uploaded.

### Software Requirements

- Ubuntu 22.04 or later (other Linux distributions also should work)
- Docker Engine and the Docker Compose plugin
- Git
- A terminal with `sudo` access
- Open ports 80 and 443 on the server's firewall and any external network firewall

### Required Accounts and Access

- Access to your organization's DNS manager to create an A record for your domain
- An email address for the HTTPS certificate (Let's Encrypt uses this for expiry warnings)
- SSH access to the server

---

## Environment Configuration

### Environment Variables

Each service reads its settings from environment variables. In production these are set inside `docker-compose.yml`. During local development they are set in `.env` files.

**Main backend (`backend/`)**

| Variable | Purpose | Example |
|----------|---------|---------|
| `NODE_ENV` | Tells the app it is running in production | `production` |
| `PORT` | The port the backend listens on inside Docker | `2026` |
| `conne_string` | Full MongoDB connection string for the main database | `mongodb://user:pass@mongo:27017/cok?authSource=admin` |
| `JWT_SECRET` | Secret key used to sign access tokens | A long random string |
| `JWT_REFRESH_SECRET` | Secret key used to sign refresh tokens | A long random string |
| `COOKIE_SECRET` | Secret key used to sign session cookies | A long random string |
| `CLIENT_URL_SET` | The public domain of the frontend (used for CORS) | `uat-ikaze.kigalicity.gov.rw` |

**Event backend (`em_backend/`)**

| Variable | Purpose | Example |
|---|---|---|
| `NODE_ENV` | Tells the app it is running in production | `production` |
| `PORT` | The port the event backend listens on inside Docker | `2027` |
| `DATABASE_URL2` | MongoDB connection string for the event database | `mongodb://user:pass@mongo:27017/COK_EVENT_MNG?authSource=admin` |
| `DATABASE_NAME2` | Name of the event database | `COK_EVENT_MNG` |
| `FRONTEND_URL` | Public domain of the frontend | `https://uat-ikaze.kigalicity.gov.rw` |
| `CORS_ORIGIN` | Which origins are allowed to call the API | `https://uat-ikaze.kigalicity.gov.rw` |
| `JWT_SECRET` | Secret key for signing event tokens | A long random string |

**Secrets generation**

Use this command on the server to generate a strong random secret:

```bash
openssl rand -hex 32
```

Run it once for `JWT_SECRET`, once for `JWT_REFRESH_SECRET`, and once for `COOKIE_SECRET`. Paste the results into `docker-compose.yml` under the `backend` service environment section.

### Configuration Files

docker file for each folder(frontend , backend and em_backend) plus overall docker-composer  to configure all

The most important files you will touch during deployment:

- `docker-compose.yml` -- Defines all services, networks, volumes, and environment variables for production
- `frontend/nginx/default.conf` -- The nginx rules that route traffic between the frontend and the two backends
- `default` (in the project root) -- The external nginx configuration that handles the real public HTTPS traffic and redirects HTTP to HTTPS
- `backend/main.js` -- The main backend entry point that connects to MongoDB and starts the server
- `em_backend/server.js` -- The event backend entry point
- `frontend/Dockerfile` -- Builds the React app and packages it with nginx

---
       
## Database Configuration

### MongoDB Setup

The application uses a single MongoDB server with two separate databases:

- `cok` -- Used by the main backend for users, parking, service delivery, feedback, and audit logs
- `COK_EVENT_MNG` -- Used by the event backend for events, rooms, bookings, and attendance

MongoDB runs inside Docker as the `mongo` service. It creates the username and password on first start using the values in `docker-compose.yml`. The databases are created automatically the first time the backends write data to them.

### First-Time Database Content

The databases start out empty. You need to create the first admin user inside the application after deployment, or load an existing MongoDB dump. If you have data from another environment, use `mongodump` to create a backup and `mongorestore` to load it into the production database.

---

## Deployment Steps

### Backend Deployment

1. Install Docker and Docker Compose on the server:

```bash
curl -fsSL https://get.docker.com | sh
```

2. Allow the required ports through the firewall:

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

3. Clone the project repository onto the server:

```bash
git clone <your-repo-url> cok_systems
cd cok_systems
```

4. Open `docker-compose.yml` and change the hardcoded secrets. Replace the example JWT secrets, cookie secret, and MongoDB password with your own values. Replace `uat-ikaze.kigalicity.gov.rw` with your real domain name wherever it appears.

5. Start the services for the first time:

```bash
docker compose up -d --build
```

6. Verify all services are running:

```bash
docker compose ps
```

All five services (`mongo`, `backend`, `em-backend`, `frontend`, `certbot`) should show as "Up". Check the backend logs:

```bash
docker compose logs backend
docker compose logs em-backend
```

Look for the line `Database connected.` in both logs. At this point `http://<server-ip>` should load the login page.

### Frontend Deployment

The frontend is built automatically as part of `docker compose up --build`. The Dockerfile has two stages:

1. The build stage installs dependencies and runs `npm run build` to create the React production bundle in the `dist/` folder
2. The runtime stage copies the bundle into an nginx container and starts nginx

No separate frontend deployment step is needed. The nginx configuration is mounted as a volume from `frontend/nginx/`, so you can change routing rules without rebuilding the image.

### Database Migration

If you need to move data from another environment:

1. On the source server, create a dump:

```bash
docker compose exec -T mongo mongodump \
  --username CoK-IkazeSys \
  --password <mongo-password> \
  --authenticationDatabase admin \
  --archive | gzip > cok_backup.archive.gz
```

2. Copy the file to the new server.

3. On the new server, restore it:

```bash
gunzip -c cok_backup.archive.gz | \
  docker compose exec -T mongo mongorestore \
    --username CoK-IkazeSys \
    --password <mongo-password> \
    --authenticationDatabase admin \
    --archive --drop
```

The `--drop` flag removes existing data before restoring, so only use it if you want to replace everything.

### Service Startup

After the first deployment, normal updates and restarts work like this:

- Restart everything: `docker compose restart`
- Restart one service only: `docker compose restart backend`
- Stop everything (data is safe in Docker volumes): `docker compose down`
- Start again later: `docker compose up -d`

---

## Post-Deployment Verification

### Health Checks

Once all containers are running, check that each service is healthy:

```bash
docker compose ps
```

Each service should show as "Up" and the `mongo` service should show its healthcheck passing.

Quick API test:

```bash
curl https://your-domain.com/cok/api
```

You should receive a JSON response or a 404 from the backend, which means the proxy is working.

### Functional Testing

1. Open `https://your-domain.com` in a browser and confirm the login page loads
2. Log in with a valid user account
3. Check the main dashboard loads without JavaScript errors
4. Go to the event management section and confirm events load
5. Test the smart parking dashboard if you have gate officer credentials
6. Test file uploads if your workflow uses them

### Log Verification

```bash
# Tail logs for all services
docker compose logs -f

# Follow only the backend
docker compose logs -f backend

# Follow only the event backend
docker compose logs -f em-backend

# Check nginx access logs (inside the frontend container)
docker compose exec frontend cat /var/log/nginx/access.log
```

Look for database connection errors, failed API calls, or certificate warnings on startup.

---

## Backup and Recovery

### Database Backup

Use the included script to create a compressed backup of the entire MongoDB database:

```bash
chmod +x scripts/backup-mongo.sh
./scripts/backup-mongo.sh
```

The script creates a timestamped file in the `backups/` folder. It keeps only the 14 most recent backups to save space.

Set up automatic nightly backups with cron:

```bash
crontab -e
```

Add this line:

```
0 2 * * * cd /path/to/cok_systems && ./scripts/backup-mongo.sh >> backups/backup.log 2>&1
```

This runs every night at 2 AM. Copy the backup files to a separate server or cloud storage on a regular basis.

### Restore Procedure

To restore from a backup:

```bash
gunzip -c backups/mongo_2026-07-24_02-00.archive.gz | \
  docker compose exec -T mongo mongorestore \
    --username CoK-IkazeSys \
    --password <mongo-password> \
    --authenticationDatabase admin \
    --archive --drop
```

Replace the filename and password with your own. The `--drop` flag erases the current database before restoring. Do not run this on a live system while users are active unless you mean to revert to the backup point.

---

## Troubleshooting

### Common Issues

**Containers will not start**

Run `docker compose ps` to see which service failed. Then run `docker compose logs <service-name>` for the failing service. Common causes are wrong environment variables, missing Docker volumes, or a MongoDB connection string mismatch.

**Database connection refused**

Check that the MongoDB container is healthy:

```bash
docker compose ps mongo
docker compose logs mongo
```

Make sure the connection string in `docker-compose.yml` matches the MongoDB username and password. If you changed the password, update it in the compose file and restart the backends.

**Login page shows but API calls fail**

This means the frontend can reach nginx, but nginx cannot reach the backends. Check that all backend containers are running and that the ports match the nginx proxy rules in `frontend/nginx/default.conf`.

**HTTPS certificate errors**

Make sure port 80 is accessible from the internet. The certbot container needs it temporarily to prove you own the domain. If the certificate was not issued, check `docker compose logs certbot`.

**File uploads fail after restart**

Uploaded files are stored in Docker volumes named `backend_uploads` and `em_uploads`. As long as these volumes exist, files survive restarts. If you ran `docker compose down -v`, the volumes were deleted and uploads are gone.

### Log Locations

| What | Where to find it |
|---|---|
| Backend application logs | `docker compose logs backend` |
| Event backend logs | `docker compose logs em-backend` |
| Frontend / nginx logs | `docker compose logs frontend` |
| Certificate renewal logs | `docker compose logs certbot` |
| MongoDB logs | `docker compose logs mongo` |
| Backup script logs | `backups/backup.log` |

### Recovery Steps

1. If a backend crashes on startup, check for missing environment variables in `docker-compose.yml`
2. If MongoDB data is corrupted, restore from the most recent backup
3. If nginx serves old files, restart the frontend container: `docker compose restart frontend`
4. If the server runs out of disk space, clean old Docker images: `docker image prune -f`

---

## Maintenance

### Updating the Application

Two environments run side by side on the server, each a separate Docker Compose project with its own network, containers, MongoDB, volumes, `.env` files and public hosts, so nothing of one can touch the other:

| Stack | Branch | Checkout | Compose project | Public hosts |
|---|---|---|---|---|
| `ikaze` (production) | `ikaze` | the folder the script is in | `cok-systems` | `ikaze.kigalicity.gov.rw` |
| `uat-ikaze` (acceptance) | `uat` | the sibling folder `<checkout>-uat` (cloned automatically) | `cok-systems-uat` | `uat-ikaze`, `uatps-ikaze`, `uate-ikaze`, `dcms.kigalicity.gov.rw` |

Production has no direct backend hosts: users, shared links, public forms and the data feed all go through the frontend host, whose nginx proxies the three APIs to the production containers. The `main` branch is no longer deployed.

One script does the whole update. Run it from the production checkout:

```bash
cd /path/to/cok_systems
sudo ./update-deploy.sh                # both stacks, UAT first
sudo ./update-deploy.sh --ikaze        # production only
sudo ./update-deploy.sh --uat-ikaze    # UAT only
sudo ./update-deploy.sh --ikaze-fresh  # production with empty databases (backed up first)
sudo ./update-deploy.sh --uat-ikaze-fresh
sudo ./update-deploy.sh --all-fresh
```

Other options: `--no-pull` keeps the code as it is, `--no-build` restarts without rebuilding images, `--keep-env` leaves the `.env` files untouched, `--dry-run` prints what would change and changes nothing, `--admin-email=<email>` answers the first-user question without a prompt. The script is `update-deploy.sh` with its parts in `deploy/`.

For each stack it: puts the checkout on its branch and pulls (cloning it the first time); copies `docker-compose.yml` and the three `.env` files from production when missing and gives them the stack's own values (see below); with `-fresh`, backs production up to `backups/` and removes the stack's mongo container and data volume, keeping the upload volumes; starts mongo if needed and rebuilds and restarts the services; reads the container addresses, waits for every container (printing its logs when it crashes), checks the sign-in settings and shows the backends' `[AUTH CHECK]` report; for production only, when the accounts database is empty, asks for an email and copies that person from the UAT database (account, role and department, activated); writes the stack's nginx file. Then nginx is tested and restarted once and every public URL is verified.

**Nginx.** One generated file per stack in `/etc/nginx/sites-available` (`ikaze`, `uat-ikaze`), each `proxy_pass` pointing at that stack's container addresses, plus `default` holding only the port 80 redirect for every host. Previous files are kept as `.bak.<date>` and restored if the test fails. Container addresses change when a container is recreated, so run the script again after any manual restart.

**The `.env` files.** They are git-ignored and never come through git. On every run the script sets each stack's values, so a file copied from a development machine or from the other stack is corrected on the spot:

| File | Keys set |
|---|---|
| `backend/.env` | `conne_string` to the stack's mongo (`cok`), `CLIENT_URL_SET` to the stack's frontend host, `JWT_SECRET` |
| `em_backend/.env` | `DATABASE_URL2` to the stack's mongo (`COK_EVENT_MNG`), `DATABASE_NAME2`, `COK_DB_NAME=cok`, `CORS_ORIGIN` and `FRONTEND_URL` to the stack's frontend host, `JWT_SECRET` |
| `dc_backend/.env` | `conne_string` to the stack's mongo (`data_collection_system`), `COK_DB_NAME=cok`, `CLIENT_URL_SET` to the stack's frontend host, `JWT_SECRET` |

The mongo user and password come from `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD` in the stack's `docker-compose.yml`, URL-encoded. Each stack has one `JWT_SECRET` shared by its three backends and different from the other stack's; a missing, default or shared secret is replaced by a new random one (everyone signed in on that stack signs in again). Replaced lines are kept as `# previous:`, changed files as `.env.bak.<date>`, Windows line endings are removed, and a second run changes nothing.

**Sign-in on the event and data collection backends.** These two never issue tokens. They verify the main backend's token with the same `JWT_SECRET` and read the account from the `cok` database on their own Mongo connection, which is why the values above must agree within a stack. Each backend prints `[AUTH CHECK]` lines at startup saying which database it reads accounts from and how many users it sees (zero means the wrong server or an empty database), and the refusal sent to the browser carries the reason.

**Databases of the two stacks: `db.sh`.** Works straight on the mongo containers with `mongosh`, `mongodump` and `mongorestore`:

```bash
sudo ./db.sh --list-db --source all                 # or uat / ikaze: databases, collections, documents, size
sudo ./db.sh --copy-db-data --from uat --to ikaze --db-name 'cok,COK_EVENT_MNG'
```

A copy streams each database from one container to the other under the same name. A database missing on the destination is created; on an existing one the documents are added and documents with the same `_id` are kept as they are on the destination. `--replace` drops each destination database first so it becomes an exact copy. Copying into production first dumps the destination database to `backups/` in the production checkout. `--dry-run` shows the plan without copying.
**The Data Collection System image** is built from the repository root (not from `dc_backend/`) because it ships `location.min.json` and `geojson-maped/`, which sit beside that folder. `docker-compose.override.yml` (tracked) sets that build context and the root `.dockerignore` keeps everything else out. Keep both files in the repository or the container fails at startup with "Cannot find module '../../../location.min.json'".
### Monitoring

Use these commands to check the health of the system:

```bash
# See which containers are running and their status
docker compose ps

# Check how much disk space Docker is using
docker system df

# Watch backend logs in real time for errors
docker compose logs -f backend

# Check MongoDB storage usage
docker compose exec mongo mongosh --eval "db.stats()"
```

No advanced monitoring dashboard is installed by default. You can add one later using a tool like Prometheus and Grafana if needed.

### Regular Maintenance Tasks

- Review logs weekly for errors or slow requests
- Copy backup files off the server at least once a month
- Update Docker base images every few months with `docker compose pull` followed by `docker compose up -d --build`
- Check certificate expiry: `docker compose logs certbot` should show successful renewals
- Clean up old Docker images and build cache periodically: `docker system prune -f`

---

## Appendices

### Important Commands

| Task | Command |
|---|---|
| Start all services | `docker compose up -d --build` |
| Stop all services | `docker compose down` |
| Restart one service | `docker compose restart backend` |
| View all logs | `docker compose logs -f` |
| View backend logs | `docker compose logs -f backend` |
| Check running containers | `docker compose ps` |
| Run database backup | `./scripts/backup-mongo.sh` |
| Disable the old HTTP config and enable HTTPS | `cd frontend/nginx && mv default.conf default-http.conf.disabled && mv default-ssl.conf.disabled default.conf && cd ../.. && docker compose restart frontend` |
| Issue a new HTTPS certificate | `docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d your-domain.com --email your@email.com --agree-tos --no-eff-email` |

### Contacts


- **Production Domain**: uat-ikaze.kigalicity.gov.rw

### Version History


