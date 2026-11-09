# Optional cloud-connected container; no local data volume or offline backend.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3120
CMD ["npm", "run", "start", "--workspace=@rose-jade/web", "--", "--hostname", "0.0.0.0"]
