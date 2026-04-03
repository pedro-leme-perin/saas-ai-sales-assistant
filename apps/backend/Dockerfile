FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files (context = repo root when no Root Directory set)
COPY apps/backend/package.json ./
COPY apps/backend/pnpm-lock.yaml* ./
COPY apps/backend/prisma/ ./prisma/

# Install dependencies (standalone, no workspace)
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Generate Prisma client
RUN pnpm prisma generate

# Copy all backend source
COPY apps/backend/ .

# Build NestJS
RUN rm -rf dist .tsbuildinfo
RUN pnpm build

# Verify build contains onboarding endpoint
RUN grep -r "completeOnboarding" dist/ | head -3 || echo "WARNING: onboarding endpoint missing"

EXPOSE 3001

CMD ["node", "dist/src/main"]
