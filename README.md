# Toriq Tools

E-commerce storefront + CMS for **Toriq Tools** (toriqtools.com) — Next.js, Prisma/PostgreSQL, Cloudflare R2.

## Local development

```bash
# Postgres for this project only (host port 5433)
docker run -d --name toriq-tools-dev-db --restart unless-stopped \
  -e POSTGRES_PASSWORD=<pw from .env.local> -e POSTGRES_DB=toriq_tools \
  -p 127.0.0.1:5433:5432 -v toriq_tools_dev_pgdata:/var/lib/postgresql/data postgres:15-alpine

cp .env.local .env            # Prisma CLI reads .env
npx prisma db push            # same as production entrypoint
npm run seed                  # creates the first super admin only
npm run dev
```

Admin panel: `/admin` (seed admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` env, defaults in `prisma/seed.ts` — change the password after first login).

## Production (VPS, Docker)

```bash
docker compose up -d --build   # app on host port 3001, db container toriq-tools-db
```

Fill the blank keys in `.env.production` (Steadfast, SMTP, R2, Meta CAPI, BDCourier) before deploying.
Backups: see `scripts/BACKUP_GUIDE.md`.
