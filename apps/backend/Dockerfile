FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml* ./
COPY prisma/ ./prisma/

# Install dependencies (standalone, no workspace)
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Generate Prisma client
RUN pnpm prisma generate

# Copy all backend source
COPY . .

# Build NestJS
RUN rm -rf dist .tsbuildinfo
RUN pnpm build

# Verify build contains onboarding endpoint
RUN grep -r "completeOnboarding" dist/ | head -3 || echo "WARNING: onboarding endpoint missing"

EXPOSE 3001

CMD ["node", "dist/src/main"]
