FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm prisma generate
RUN pnpm build

EXPOSE 3001

CMD ["node", "dist/src/main"]