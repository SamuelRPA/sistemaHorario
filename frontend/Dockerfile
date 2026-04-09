# SPA estática con nginx (contexto de build: carpeta frontend/, p. ej. rama render-frontend).
# Uso local: docker build -f Dockerfile .
# En Render Static Site o Web con nginx: Root Directory = frontend, Branch = rama generada con scripts/render-branches.sh

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
