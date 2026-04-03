FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files first (Docker layer caching)
COPY package.json ./
COPY prisma/ ./prisma/

# Install dependencies (no workspace, standalone backend)
# --ignore-scripts prevents "prepare" from running before prisma schema is ready
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Generate Prisma client
RUN pnpm prisma generate

# Copy all source code
COPY . .

# Build NestJS
RUN rm -rf dist .tsbuildinfo
RUN pnpm build

# Verify build contains onboarding endpoint
RUN grep -r "completeOnboarding" dist/ | head -3 || echo "WARNING: onboarding endpoint missing"

EXPOSE 3001

CMD ["node", "dist/src/main"]
