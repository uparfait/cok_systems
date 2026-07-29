# Deployment Guidance

## Introduction

### Purpose

This guide walks you through deploying the COK Systems(Ikaze) application from start to finish. It is written for system administrators, DevOps engineers, and developers who need to set up the system on a Linux server using Docker. Follow the steps in order for a first-time deployment. Later sections help with day-to-day maintenance, backups, and fixing common problems.

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

To deploy a new version of the code:

```bash
cd /path/to/cok_systems
git pull origin main
docker compose up -d --build
```

The `--build` flag rebuilds only the images that changed. Docker reuses existing layers when possible, so this is usually fast. Verify the deployment with `docker compose ps` and a quick browser test.

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

- **System Owner**: City of Kigali Information Technology Department
- **Email**: cokservicedelivery@gmail.com
- **Production Domain**: uat-ikaze.kigalicity.gov.rw

### Version History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-07-24 | COK Systems Team | Initial deployment guide based on current production setup |
