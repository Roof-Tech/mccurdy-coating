FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY render.yaml ./
ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000
CMD ["node", "dist/index.cjs"]
