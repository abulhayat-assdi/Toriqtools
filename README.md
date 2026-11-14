# Toriq Tools

E-commerce storefront + CMS for **Toriq Tools** (toriqtools.com) — Next.js, Prisma/PostgreSQL, Cloudflare R2.

## Local development

```bash
cp .env.local .env            # or edit .env.local directly
createdb toriq_tools          # or: docker exec <pg> createdb -U postgres toriq_tools
npx prisma migrate deploy
npm run seed                  # admin + site settings + categories + policy pages
npm run dev
```

Admin panel: `/admin` (seed admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` env, defaults in `prisma/seed.ts` — change the password after first login).

## Production (VPS, Docker)

```bash
docker compose up -d --build   # app on host port 3001, db container toriq-tools-db
```

Fill the blank keys in `.env.production` (Steadfast, SMTP, R2, Meta CAPI, BDCourier) before deploying.
Backups: see `scripts/BACKUP_GUIDE.md`.
