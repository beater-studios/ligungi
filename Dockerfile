FROM node:26.13.0-alpine AS build
# Git commit of the build; .git is not in the context, so the deploy passes it in.
ARG LIGUNGI_COMMIT=dev
# Public site token of Cloudflare Web Analytics; empty means no analytics and no cookie notice.
ARG VITE_CF_ANALYTICS_TOKEN=
ENV LIGUNGI_COMMIT=$LIGUNGI_COMMIT \
    VITE_CF_ANALYTICS_TOKEN=$VITE_CF_ANALYTICS_TOKEN
WORKDIR /app
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
RUN npm ci --ignore-scripts --no-audit --no-fund && npm run build

FROM node:26.13.0-alpine
ARG LIGUNGI_COMMIT=dev
LABEL org.opencontainers.image.title="ligungi" \
      org.opencontainers.image.source="https://github.com/beater-studios/ligungi" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.revision="$LIGUNGI_COMMIT"
WORKDIR /app
ENV LIGUNGI_COMMIT=$LIGUNGI_COMMIT \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    STATIC_DIR=/app/apps/web/dist \
    DATABASE_PATH=/data/ligungi.db
COPY --from=build /app/package.json /app/package-lock.json /app/.npmrc ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/scripts/build-info.ts ./scripts/build-info.ts
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist
# Production dependencies of the server only (the equivalent of a pruned tree). Then the npm cache and the
# package managers themselves are removed: the server never needs them at runtime.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund --workspace @ligungi/server --include-workspace-root=false \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
       /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-* /root/.npm /tmp/* \
    && mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4000
CMD ["node", "--disable-warning=ExperimentalWarning", "apps/server/src/main.ts"]
