FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

RUN npm install -g pnpm

# Copy workspace config (root-level files for pnpm workspace resolution)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for dependency resolution
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install workspace dependencies (backend + shared)
RUN pnpm install --no-frozen-lockfile --filter @saas/backend...

# Copy shared package source and build it
COPY packages/shared/ ./packages/shared/
RUN pnpm --filter @saas/shared run build

# Copy backend source
COPY apps/backend/ ./apps/backend/

# Generate Prisma client
WORKDIR /app/apps/backend
RUN pnpm prisma generate

# Clean build
RUN rm -rf dist .tsbuildinfo
RUN pnpm build

# Verify build contains new endpoints
RUN grep -r "completeOnboarding" dist/ | head -3 || echo "WARNING: onboarding endpoint missing"

EXPOSE 3001

CMD ["node", "dist/src/main"]
