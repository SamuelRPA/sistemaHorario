# API Node + Prisma (contexto de build: carpeta backend/, p. ej. rama render-backend).
# Uso local: docker build -f Dockerfile .
# En Render: Root Directory = backend, Branch = rama generada con scripts/render-branches.sh

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

RUN npm install -g prisma@5.22.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate

ENV PORT=4000
EXPOSE 4000

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
