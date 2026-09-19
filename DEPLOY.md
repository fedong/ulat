# Deploying Ulat

Production runs as one Docker Compose stack — the Next.js app (web + `/api/v1`)
with PostgreSQL 16 beside it — on a single VPS managed by Coolify, per
`Ulat_Infrastructure_Decisions.md`. The `Dockerfile` builds a standalone image
that applies migrations on boot and serves on `:3000`; `docker-compose.yml` is
the unit Coolify deploys.

## 1 · Server

Any Ubuntu 24.04 LTS VPS with ≥ 4 vCPU / 8 GB works — the stack is plain
Docker, nothing provider-specific. Pick by price near the Philippines:

- **Recommended: a Singapore-region VPS** — OVHcloud (~S$8–15/mo for the 8 GB
  tier; check the renewal price) or Contabo (~€8/mo incl. their Singapore
  location fee). ~30–50 ms from the Philippines.
- Hetzner (the original pick) is only cheap in its EU/US regions — its
  Singapore location offers dedicated-only at several times the price. An EU
  Hetzner box (~€7–14/mo) also works; the clients' optimistic sync tolerates
  the ~280 ms, but Singapore feels snappier.

Then, whichever box:

- Add your SSH key at creation (no root password), enable the provider's
  backup add-on if offered.
- Install Coolify (their one-liner): `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
  — and open `http://SERVER-IP:8000` immediately to claim the admin account.
- Basic hardening: SSH keys only, `ufw` allowing 22/80/443 (+ 8000 for the
  Coolify UI until it sits behind a domain), unattended-upgrades on.

## 2 · The app in Coolify

1. New project → **Docker Compose** resource, pointed at this repository
   (`docker-compose.yml` at the root, deploys from `main`).
2. Environment variables (Coolify → Environment):

   | Variable | Value |
   | --- | --- |
   | `POSTGRES_PASSWORD` | long random secret |
   | `JWT_SECRET` | 32+ random bytes — rotating it signs everyone out |
   | `NEXT_PUBLIC_APP_URL` | `https://ulat.app` (baked into QR codes/invite links at **build** time) |
   | `PAYMONGO_SECRET_KEY` | live/test secret key; **leave empty to run the built-in payment sandbox** |
   | `PAYMONGO_WEBHOOK_SECRET` | from the PayMongo webhook you create in step 5 |
   | `SEED_DEMO` | `1` on the first deploy if you want the demo accounts, else `0` |
   | `APP_PORT` | leave default; Coolify's proxy targets the service port `3000` |
   | `BACKUP_S3_ENDPOINT` | R2/S3 endpoint, e.g. `https://<account-id>.r2.cloudflarestorage.com` |
   | `BACKUP_S3_ACCESS_KEY_ID` | R2 API token's Access Key ID (Object Read & Write, bucket-scoped) |
   | `BACKUP_S3_SECRET_ACCESS_KEY` | R2 API token's Secret Access Key |
   | `BACKUP_S3_BUCKET` | optional; defaults to `ulat-backups` |

3. Deploy. Boot order is automatic: Postgres healthcheck → app container runs
   `prisma migrate deploy` (retrying while the DB comes up) → optional demo
   seed → serve. Health endpoint: `GET /api/health` (checks the DB; also wired
   as the container HEALTHCHECK — point UptimeRobot at it).

## 3 · Domain (Cloudflare)

- `ulat.app` on Cloudflare free: an `A` record to the server IP.
- Simplest path: **DNS-only (grey cloud)** first, let Coolify issue the
  Let's Encrypt cert for the domain, confirm HTTPS works — then flip the
  record to **Proxied (orange cloud)** and set Cloudflare SSL/TLS to
  **Full (strict)** for CDN + DDoS in front.
- `www` → redirect rule to the apex.

## 4 · Backups (grades must not lose a day)

- **The `backup` service in `docker-compose.yml` does this automatically**:
  `pg_dump` every 6 hours uploaded to the R2 bucket under `pg/`, pruned
  after 14 days. It starts working as soon as the three `BACKUP_S3_*` env
  vars from §2 are set (R2's free 10 GB tier covers this comfortably).
  Without them the container idles in a retry loop and db/app are
  unaffected. Trigger an immediate dump any time:
  `docker compose exec backup sh backup.sh`.
- **Provider snapshots** of the whole VPS: enable the host's auto-backups as
  the disaster-recovery layer. Snapshots alone are not the grade backup —
  the 6-hour dumps are.
- Restore drill (do this once before launch): download the newest dump from
  R2 → `pg_restore` into a scratch Postgres container → check the row
  counts, e.g.
  `docker run -d --name drill -e POSTGRES_PASSWORD=x postgres:16-alpine`,
  `pg_restore -h ... -d postgres --create backup.dump`, then
  `SELECT count(*) FROM "User";`.

## 5 · PayMongo go-live

1. PayMongo dashboard → get the **secret key** (test first, then live) into
   `PAYMONGO_SECRET_KEY` and redeploy.
2. Create a webhook pointed at `https://ulat.app/api/v1/billing/webhook`
   subscribed to `checkout_session.payment.paid`; put its signing secret in
   `PAYMONGO_WEBHOOK_SECRET`.
3. With keys set, checkout redirects to PayMongo's hosted page and the
   webhook settles payments; the in-app sandbox settler switches itself off.
4. Test-mode dry run end to end (test cards / GCash sandbox) before flipping
   to live keys.

## 6 · Mobile app

- Build with `EXPO_PUBLIC_API_URL=https://ulat.app` (EAS build profile env).
- The QR/invite links already point at `NEXT_PUBLIC_APP_URL`; once the domain
  is live, add universal links (Apple `apple-app-site-association`, Android
  `assetlinks.json`) so `https://ulat.app/join/…` opens the app directly.

## 7 · Later (already planned)

- **Amazon SES** for invite/digest email — verify the domain, set SPF, DKIM
  and DMARC **before** the first digest is sent.
- **Expo Push** for mobile notifications; the referral credit's 14-day
  release timer lands with the same job runner.
- **Staging**: a second Coolify resource on the same box from a `staging`
  branch, with its own Postgres and `SEED_DEMO=1`.
- Data privacy (RA 10173): the server already stores the minimum (no student
  emails until a student registers themselves); register with the NPC once
  real school data is on the box, and document the retention policy.

## Local production rehearsal

```bash
POSTGRES_PASSWORD=devpw JWT_SECRET=$(openssl rand -hex 32) \
NEXT_PUBLIC_APP_URL=http://localhost:3000 SEED_DEMO=1 \
docker compose up --build
```

Then `curl localhost:3000/api/health` → `{"ok":true,"db":"up"}`, and the full
suites run against it: `API_URL=http://localhost:3000 npm run api:test` and
`API_URL=http://localhost:3000 node scripts/web-e2e.mjs`.
