FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --no-frozen-lockfile

COPY . .

# Force clean build — remove stale incremental build artifacts
RUN rm -rf dist tsconfig.tsbuildinfo .tsbuildinfo

# Cache bust: 2026-04-03-force-clean
RUN pnpm prisma generate
RUN pnpm build

# Verify build output contains onboarding endpoint
RUN grep -r "completeOnboarding\|current/onboarding" dist/ || echo "WARNING: onboarding endpoint not found in build output"

EXPOSE 3001

CMD ["node", "dist/src/main"]
