# Ulat — production image (Coolify deploys this via docker-compose.yml).
# Multi-stage: install → build (standalone Next + Prisma client + bundled
# seed) → slim runner that migrates on boot and serves.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Baked into the client bundle: the public origin for QR codes/invite links.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npx prisma generate \
 && npm run build \
 # The demo seed, bundled to plain JS (only @prisma/client stays external —
 # it must share the runner's generated client + engine).
 && npx esbuild prisma/seed.ts --bundle --platform=node --format=cjs \
      --external:@prisma/client --outfile=prisma/seed.cjs \
 # Self-contained Prisma CLI tree for `migrate deploy` on boot (the CLI's
 # dependency closure is not part of the standalone server bundle).
 && npm install --prefix /prisma-cli --no-audit --no-fund --no-save \
      prisma@"$(node -p "require('/app/node_modules/prisma/package.json').version")"

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
 && groupadd -r ulat && useradd -r -g ulat ulat
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000

# Standalone server + static assets.
COPY --from=build --chown=ulat:ulat /app/.next/standalone ./
COPY --from=build --chown=ulat:ulat /app/.next/static ./.next/static
COPY --from=build --chown=ulat:ulat /app/public ./public

# Schema, migrations, the bundled seed, the generated client + engine, and
# the self-contained Prisma CLI for `migrate deploy` on boot.
COPY --from=build --chown=ulat:ulat /app/prisma ./prisma
COPY --from=build --chown=ulat:ulat /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=ulat:ulat /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build --chown=ulat:ulat /prisma-cli ./prisma-cli

COPY --chown=ulat:ulat docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER ulat
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./entrypoint.sh"]
