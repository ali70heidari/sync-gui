FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run next:build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=49173

RUN apk add --no-cache rsync openssh-client sshpass bash git

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/out ./out
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/package.json ./package.json

EXPOSE 49173

CMD ["node", "-e", "const http = require('http'); const fs = require('fs'); const path = require('path'); const server = http.createServer((req, res) => { let filePath = path.join(__dirname, 'out', req.url === '/' ? 'index.html' : req.url); if (!fs.existsSync(filePath)) filePath = path.join(__dirname, 'out', 'index.html'); const ext = path.extname(filePath); const contentType = ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : 'text/html'; res.writeHead(200, { 'Content-Type': contentType }); fs.createReadStream(filePath).pipe(res); }); server.listen(49173, '0.0.0.0', () => console.log('Sync GUI running on port 49173'));"]
