# JavaQuest site production image (ticket #24).
# Build with podman, never Docker: `podman build -f Containerfile -t javaquest-site .`
# Coolify (Docker) can build the same file by pointing its Dockerfile setting
# at `Containerfile`. Runtime line pinned by digest (ticket: reproducible
# build on the locked runtime line; ADR-0001 pins Next.js 16.4.3 exactly).
ARG NODE_IMAGE=docker.io/library/node:24-bookworm-slim@sha256:e1582112fb9f152ed38eefcd712efc93fee1becb519fdfa57574d5e07eaa5e7d

# ---- deps: reproducible install from the lockfile ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: full production build (typecheck included) ----
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: standalone server only, non-root ----
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# RUNNER_URL and RUNNER_KEY stay unset here on purpose: both are
# server-side Coolify configuration (#26), never baked into the image and
# never exposed to the browser bundle (lib/server/env.ts, ADR-0002).
RUN groupadd -r javaquest && useradd -r -g javaquest javaquest
COPY --from=builder --chown=javaquest:javaquest /app/.next/standalone ./
COPY --from=builder --chown=javaquest:javaquest /app/.next/static ./.next/static
COPY --from=builder --chown=javaquest:javaquest /app/public ./public
USER javaquest
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
