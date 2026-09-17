ARG NODE_IMAGE=node:24.16.0-bookworm-slim

FROM ${NODE_IMAGE} AS toolchain
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate
WORKDIR /app

FROM toolchain AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY shared/types/package.json shared/types/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM dependencies AS build
ARG SOURCE_REVISION
ARG FRONTEND_URL=http://localhost:3000
ARG API_URL=http://api:3003
# Intentionally public synthetic login inputs, consumed only during next build.
ARG NEXT_PUBLIC_SHOWCASE_DEMO_EMAIL
ARG NEXT_PUBLIC_SHOWCASE_DEMO_PASSWORD
ENV NEXT_PUBLIC_SHOWCASE_DEMO_EMAIL=${NEXT_PUBLIC_SHOWCASE_DEMO_EMAIL}
ENV NEXT_PUBLIC_SHOWCASE_DEMO_PASSWORD=${NEXT_PUBLIC_SHOWCASE_DEMO_PASSWORD}
ENV DOCKER_STANDALONE_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV FRONTEND_URL=${FRONTEND_URL}
ENV API_URL=${API_URL}
COPY . .
RUN test -n "${SOURCE_REVISION}"
RUN pnpm build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @club/api deploy --prod --legacy /out/api

FROM node:24.16.0-bookworm-slim AS runtime
ARG SOURCE_REVISION
LABEL org.opencontainers.image.revision=${SOURCE_REVISION}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /out/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /out/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /out/api/dist ./apps/api/dist
RUN mkdir -p /app/uploads /app/private-uploads && \
    chown node:node /app/uploads /app/private-uploads

USER node
EXPOSE 3000 3003
CMD ["node", "apps/web/server.js"]
