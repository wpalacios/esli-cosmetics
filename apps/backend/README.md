# Esli Cosmetics Backend API

A modern NestJS backend API with Prisma ORM for the Esli Cosmetics POS and inventory management system.

## 🚀 Tech Stack

- **Framework**: NestJS 11.x (latest)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with Prisma ORM 6.x
- **Authentication**: JWT with refresh tokens
- **Authorization**: RBAC (Role-Based Access Control)
- **Validation**: class-validator + class-transformer
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest (unit + e2e)

## 📁 Project Structure

```
src/
├── common/                 # Shared services and utilities
│   └── prisma/            # Prisma service and database client
├── config/                # Configuration files
├── modules/               # Feature modules
│   ├── auth/             # Authentication and authorization
│   ├── users/            # User management
│   ├── roles/            # Role management  
│   ├── permissions/      # Permission management
│   └── [other modules]   # Products, inventory, orders, etc.

├── tools/                  # @Tool classes (inventory, quotes, …)
├── services/               # QuoteBuilderService
└── api/                    # HTTP client to /api/v1 (service account)
├── app.controller.ts     # Root controller (health checks)
├── app.module.ts         # Root module
└── main.ts              # Application entry point

prisma/
├── schema.prisma         # Prisma schema
├── migrations/           # Database migrations
└── seed.ts              # Database seeding
```

## 🛠️ Setup and Development

### Prerequisites

- Node.js 22.x or higher
- pnpm 10.x or higher
- PostgreSQL database

### Environment Variables

Create a `.env` file in the backend directory (copy from `env.example`):

**⚠️ IMPORTANT: Authentication Secrets**

The following secrets **MUST** be the same across all developers and environments, or authentication will fail:

- `JWT_SECRET` - Used to sign/verify access tokens
- `JWT_REFRESH_SECRET` - Used to sign/verify refresh tokens

**Generate secure secrets:**
```bash
# Generate all secrets at once
node scripts/generate-secrets.js

# Or generate individually
node scripts/generate-secrets.js jwt-secret
node scripts/generate-secrets.js jwt-refresh-secret
```

**Alternative methods:**
```bash
# Using OpenSSL (for hex format - 64 characters)
openssl rand -hex 32

# Using OpenSSL (for base64 format - 44 characters)
openssl rand -base64 32

# Using Node.js directly
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The value `965f16c097fd63c131a84f6e57cd60b9` you saw is a **32-byte hex string** (64 hex characters), which is equivalent to 32 bytes of cryptographically secure random data. This format provides excellent security for session encryption.

**Example `.env` file:**

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/esli_cosmetics_dev?schema=public"

# JWT
JWT_SECRET="your-jwt-secret-key-here"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-refresh-jwt-secret-key-here"
JWT_REFRESH_EXPIRES_IN="7d"

# Application
PORT=3001
NODE_ENV="development"

# Prisma Studio
PRISMA_STUDIO_PORT=5555

# Optional: Prisma connection pool (when DATABASE_URL has no connection_limit / pool_timeout)
# DATABASE_CONNECTION_LIMIT=12
# DATABASE_POOL_TIMEOUT=20
```

### Database connection pool (production)

Prisma uses a client-side pool. If `DATABASE_URL` does not set `connection_limit`, the backend injects a default (see `DEFAULT_CONNECTION_LIMIT` in `src/common/prisma/prisma.service.ts`). **Set an explicit limit for production** so it fits your Postgres `max_connections` and any other clients (e.g. `DATABASE_CONNECTION_LIMIT=15` on Render).

You can also append query parameters to `DATABASE_URL` directly, for example `connection_limit=15&pool_timeout=20`. Optional env **`DATABASE_POOL_TIMEOUT`** adds `pool_timeout` to the URL when it is not already present (seconds; helps brief spikes after you raise `connection_limit`).

For **Supabase**, prefer the **pooled** connection string (often port `6543`) with Prisma’s pooler parameters (`pgbouncer=true`, etc.) per [Prisma docs](https://www.prisma.io/docs/orm/overview/databases/supabase), and keep `connection_limit` aligned with that setup.

In the Supabase dashboard, **max client connections** (e.g. 400) is how many clients may connect to the pooler. **Connection pool size** (e.g. 30 on Small compute) is how many connections the pooler opens to Postgres for a given database user—this is the hard cap to respect across all consumers. For a **single** Nest/Node API process, set `DATABASE_CONNECTION_LIMIT` (or `connection_limit` on the URL) to roughly **15–20** so concurrent Prisma work stays under that pool size with headroom; if you run **multiple** backend instances or other services against the same pool, lower the per-process limit or increase pool size in Supabase so the **sum** stays below the configured pool size.

### Installation

From the monorepo root:

```bash
# Install all dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Seed the database
pnpm db:seed
```

### Development

```bash
# Start development server
pnpm dev:backend

# Or run all apps concurrently
pnpm dev
```

The API will be available at:
- **API**: http://localhost:3001/api/v1
- **Swagger Docs**: http://localhost:3001/api/docs
- **Health Check**: http://localhost:3001/api

### Database Management

```bash
# Generate Prisma client after schema changes
pnpm db:generate

# Create and apply new migration
pnpm db:migrate

# Reset database (dev only)
pnpm db:reset

# Open Prisma Studio
pnpm db:studio

# Seed database with initial data
pnpm db:seed
```

## 🔐 Authentication & Authorization

The API uses JWT tokens with refresh token rotation:

1. **Login**: `POST /api/v1/auth/login`
2. **Register**: `POST /api/v1/auth/register`
3. **Refresh**: `POST /api/v1/auth/refresh`
4. **Profile**: `POST /api/v1/auth/me`

### Default Roles

- **admin**: Full system access
- **store_manager**: Branch management and operations
- **sales_rep**: Sales and customer operations

### Default Admin User

After running the seed:
- **Email**: admin@esli-cosmetics.com
- **Note**: Implement password authentication in production

## 📚 API Documentation

Interactive API documentation is available at `/api/docs` when running the server.

### Key Endpoints

```
# Authentication
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/refresh
POST   /api/v1/auth/me

# User Management  
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id

# Role Management
GET    /api/v1/roles
POST   /api/v1/roles
GET    /api/v1/roles/:id
PATCH  /api/v1/roles/:id
DELETE /api/v1/roles/:id
POST   /api/v1/roles/:id/permissions

# Permission Management
GET    /api/v1/permissions
POST   /api/v1/permissions
GET    /api/v1/permissions/:id
PATCH  /api/v1/permissions/:id
DELETE /api/v1/permissions/:id

```

## 🧪 Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov

# Watch mode
pnpm test:watch
```

## 🚢 Production Deployment

### Build

```bash
pnpm build
```

### Environment

Ensure production environment variables are set:

```bash
DATABASE_URL="your-production-database-url"
JWT_SECRET="strong-production-jwt-secret"
JWT_REFRESH_SECRET="strong-production-refresh-secret"
NODE_ENV="production"
PORT=3001
```

### Start

The compiled entry file is `dist/src/main.js` (Nest/TypeScript may emit under `dist/src/` depending on the build). From `apps/backend`:

```bash
pnpm start:prod
# equivalent: node dist/src/main.js
```

---

### DigitalOcean Droplet (Ubuntu) — full guide

This documents a typical **single Droplet** setup: Nginx, TLS (Let’s Encrypt), PostgreSQL on the same host or a managed database, and **pnpm** from the monorepo root. **Prerequisites:** root or sudo SSH access, **Node 22+** and **pnpm 10+** (see the repo root `packageManager` / `engines`).

#### 1. System packages and firewall (UFW)

```bash
apt update && apt upgrade -y
apt install -y git ufw curl ca-certificates gnupg
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

**Important for HTTPS:** Let’s Encrypt must reach your server on **port 80** (HTTP-01). If you use a **DigitalOcean Cloud Firewall**, add inbound **HTTP 80** and **HTTPS 443** from the internet; otherwise certbot can fail with a **connection timeout** even when UFW is correct.

#### 2. Node.js 22 and pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
corepack enable
corepack prepare pnpm@10.17.1 --activate
pnpm -v
```

#### 3. PostgreSQL (on Droplet) — optional if using Managed DB

```bash
apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER esli WITH PASSWORD 'STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE esli OWNER esli;"
```

Use a `DATABASE_URL` like `postgresql://esli:STRONG_PASSWORD@127.0.0.1:5432/esli?schema=public` (or your managed-DB URL; often append `?sslmode=require` for DO Managed PostgreSQL). Do not expose Postgres `5432` to the public internet in UFW or the cloud firewall.

#### 4. Clone and install

```bash
mkdir -p /var/www
cd /var/www
git clone <YOUR_REPO_URL> esli-cosmetics
cd esli-cosmetics
git checkout main   # or your release branch
pnpm install --frozen-lockfile
```

#### 5. Environment file

Create `apps/backend/.env` (or set variables via your process manager) with at least: `NODE_ENV=production`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`. Generate strong secrets, for example:

```bash
openssl rand -base64 48
```

#### 6. Build and database migrations

From the **monorepo root**:

```bash
cd /var/www/esli-cosmetics
export $(grep -v '^#' apps/backend/.env | xargs)   # load .env in shell; adjust if you use a different method
pnpm --filter @esli/backend run build
pnpm --filter @esli/backend run db:migrate
```

#### 7. Process manager (PM2) — use the real `main` path

Work from `apps/backend` after a successful build. The entry is **`dist/src/main.js`**, not `dist/main.js`.

```bash
cd /var/www/esli-cosmetics/apps/backend
export $(grep -v '^#' .env | xargs)
npm install -g pm2
pm2 start dist/src/main.js --name esli-api
pm2 save
pm2 startup systemd -u root --hp /root
```

Run the one-time command `pm2 startup` prints, then `pm2 save` again as instructed.

**Smoke test (on the server):**

```bash
curl -sS "http://127.0.0.1:3001/api"    # or your chosen PORT; path depends on your routes
```

#### 8. Nginx reverse proxy

```bash
apt install -y nginx
```

Example site (`/etc/nginx/sites-available/esli-api`):

```nginx
server {
  listen 80;
  server_name api.eslicosmetics.com;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
ln -sf /etc/nginx/sites-available/esli-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

#### 9. DNS (Namecheap or any provider)

Create an **A record** for the API host (e.g. **Host** `api` if your registrar uses relative names) pointing to the Droplet’s **public IPv4**. Wait until the name resolves:

```bash
dig +short api.eslicosmetics.com A
```

If the record is missing, Let’s Encrypt reports **NXDOMAIN**. If the A record points to a different server than the one running Nginx, validation will also fail.

#### 10. TLS (Certbot, Let’s Encrypt)

**Requires** port 80 reachable from the internet (UFW + any cloud firewall). `server_name` must match the certificate name.

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.eslicosmetics.com
```

| Symptom | What to check |
|--------|----------------|
| **NXDOMAIN** for your API host | A record for `api` (or FQDN) not created or not propagated |
| **Connection / timeout** on port 80 to your Droplet IP | UFW, DigitalOcean Cloud Firewall, wrong Droplet IP in DNS, or Nginx not listening on 80 |
| **Wrong host** | `dig` output must match `curl -4 ifconfig.me` (or the Droplet’s public IP) on the same machine as Nginx |

#### 11. CORS and production frontends

`src/main.ts` may list only `localhost` origins. For a browser app on a real domain, add your **production** origins to CORS (or an env-based allowlist) and redeploy, then point the web app’s public API base URL to `https://<your-api-hostname>`.

#### 12. Deploy / update BACKEND code on the Droplet (repeatable)

After you merge or push changes to the branch the server tracks, ship them to DigitalOcean with this loop.

**1. SSH into the Droplet**

```bash
ssh root@YOUR_DROPLET_IP
```

(Use your real user, IP, and SSH key.)

**2. Pull the latest code**

```bash
cd /var/www/esli-cosmetics
git fetch origin
git checkout main          # or production / your release branch
git pull origin main
```

Ensure `git pull` works on the server (deploy key or credentials for private repos).

**3. Install dependencies (monorepo root)**

```bash
cd /var/www/esli-cosmetics
pnpm install --frozen-lockfile
```

**4. Build the backend**

```bash
pnpm --filter @esli/backend run build
```

**5. Run database migrations** (whenever Prisma migrations changed)

Load `DATABASE_URL` (and any other Prisma env) from the backend `.env`:

```bash
cd /var/www/esli-cosmetics/apps/backend
set -a && . ./.env && set +a
cd /var/www/esli-cosmetics
pnpm --filter @esli/backend run db:migrate
```

Alternatively: `export $(grep -v '^#' apps/backend/.env | xargs)` from the monorepo root before `db:migrate`.

**6. Restart the Node process (PM2)**

```bash
pm2 restart esli-api
```

If the process was registered under another name, run `pm2 list` and `pm2 restart <name>`.

**7. Verify**

```bash
curl -sS http://127.0.0.1:3001/api/v1
pm2 logs esli-api --lines 30
```

**One-shot block** (after SSH, if you are already on the correct branch and only need `pull`):

```bash
cd /var/www/esli-cosmetics
git pull
pnpm install --frozen-lockfile
pnpm --filter @esli/backend run build
cd apps/backend && set -a && . ./.env && set +a && cd ../..
pnpm --filter @esli/backend run db:migrate
pm2 restart esli-api
```

**Notes**

- You usually do **not** need to edit `apps/backend/.env` for routine code updates—only when secrets or URLs change.
- **`db:migrate`** applies pending migrations safely in production (`prisma migrate deploy`). Skip only if this deploy includes **no** migration changes (it is still safe to run).
- **Automation (optional):** add a GitHub Action (or similar) that SSHs into the Droplet and runs the same commands, or a small `deploy.sh` on the server.

---

## 🔒 Security Features

- JWT token authentication with refresh tokens
- Role-based access control (RBAC)
- Input validation and sanitization
- SQL injection protection via Prisma
- CORS configuration
- Rate limiting (to be implemented)
- Request logging (to be implemented)

## 📝 Development Guidelines

- Use TypeScript strict mode (no `any` types)
- Follow NestJS conventions and patterns
- Implement proper error handling
- Write unit tests for services
- Document complex business logic
- Use DTOs for request/response validation
- Implement soft delete for all entities
- Use Prisma transactions for complex operations

## 🤝 Contributing

1. Create a feature branch
2. Implement changes with tests
3. Ensure all tests pass
4. Update documentation if needed
5. Submit a pull request

## 📄 License

Private - Esli Cosmetics
