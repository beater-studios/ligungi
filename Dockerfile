FROM node:24.22.1-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
RUN npm ci --ignore-scripts --no-audit --no-fund && npm run build

FROM node:24.22.1-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    STATIC_DIR=/app/apps/web/dist \
    DATABASE_PATH=/data/ligungi.db
COPY --from=build /app/package.json /app/package-lock.json /app/.npmrc ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server ./apps/server
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
