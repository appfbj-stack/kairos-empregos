FROM node:22-alpine AS builder
WORKDIR /app

# Dependências pra bcrypt/native modules (se necessário no futuro)
RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle
RUN npm run build

# ---- runtime ----
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache openssl
RUN addgroup -g 1001 -S kairos && adduser -S kairos -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/package.json ./package.json

# Storage local
RUN mkdir -p /app/storage && chown -R kairos:kairos /app
USER kairos

ENV NODE_ENV=production
ENV PORT=8031

EXPOSE 8031

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8031/health || exit 1

CMD ["node", "dist/server.js"]