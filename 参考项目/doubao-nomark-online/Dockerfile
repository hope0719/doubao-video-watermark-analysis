# Stage 1: Build
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Install dependencies with the committed bun lockfile
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the Next.js standalone output
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
