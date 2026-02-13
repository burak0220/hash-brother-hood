FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["npm", "start"]
