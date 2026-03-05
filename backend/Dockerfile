# ────────────────────────────────────────────────
# Stage 1: 빌드
# ────────────────────────────────────────────────
FROM node:20-alpine AS builder

# bcrypt 네이티브 모듈 컴파일에 필요한 빌드 도구
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 의존성 설치 (캐시 최적화)
COPY package*.json ./
RUN npm install

# 소스 복사 및 빌드
COPY . .
RUN npm run build

# 프로덕션 의존성만 남기기 (bcrypt 등 네이티브 모듈 재컴파일 포함)
RUN npm install --omit=dev

# ────────────────────────────────────────────────
# Stage 2: 런타임
# ────────────────────────────────────────────────
FROM node:20-alpine AS runner

# 보안: 비루트 사용자
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

WORKDIR /app

# 빌드 결과물 및 의존성 복사
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs package.json ./

# 로그 디렉토리
RUN mkdir -p /app/logs && chown -R nestjs:nodejs /app/logs

USER nestjs

EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1', (r) => process.exit(r.statusCode < 500 ? 0 : 1))"

CMD ["node", "dist/main"]
