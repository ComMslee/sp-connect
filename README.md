# 통합 포인트 관리 시스템

AWS 클라우드 + Docker 기반 엔터프라이즈급 포인트 적립/사용 관리 플랫폼

## 프로젝트 구조

```
sp-connect/
├── backend/                     # NestJS 백엔드
│   ├── src/
│   │   ├── auth/                # 인증 (JWT, 카카오, 네이버, 통신사 본인인증)
│   │   ├── points/              # 포인트 핵심 로직 (ACID 트랜잭션)
│   │   ├── users/               # 회원 관리
│   │   ├── admin/               # 관리자 대시보드 API
│   │   ├── external/            # 외부 사이트 연동 API
│   │   └── common/              # 공통 가드/필터/인터셉터
│   ├── Dockerfile
│   └── package.json
├── frontend/                    # Next.js 14 프론트엔드
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/           # 로그인 페이지 (모바일 최적화)
│   │   │   ├── member/          # 회원용 페이지
│   │   │   └── admin/           # 관리자 대시보드
│   │   ├── store/               # Zustand 상태관리
│   │   ├── types/               # TypeScript 타입
│   │   └── utils/               # API 클라이언트 (Axios)
│   └── Dockerfile
├── database/
│   └── init.sql                 # PostgreSQL 스키마 + 초기 데이터
├── infra/
│   └── nginx/nginx.conf         # 리버스 프록시 설정
├── docs/
│   └── API_SPEC.md              # API 명세서
├── .github/workflows/
│   └── deploy.yml               # CI/CD (GitHub Actions → AWS ECS)
├── docker-compose.yml           # 로컬 개발 환경
└── .env.example                 # 환경 변수 예시
```

---

## 로컬 환경 실행 가이드

### 사전 요구사항
- Docker Desktop 4.x+
- Node.js 20+ (로컬 개발 시)
- Git

### 1단계: 환경 변수 설정
```bash
cp .env.example .env
```
`.env` 파일을 열어 필수 값을 설정합니다:
```
DB_PASSWORD=your_strong_password
JWT_SECRET=$(openssl rand -base64 64)  # 64자 랜덤 시크릿 생성
```

### 2단계: Docker Compose 실행
```bash
# 전체 서비스 시작 (PostgreSQL + Redis + Backend + Frontend + Nginx)
docker-compose up -d

# 로그 확인
docker-compose logs -f backend
```

### 3단계: 접속
| 서비스 | URL |
|--------|-----|
| 프론트엔드 (회원) | http://localhost:3001/login |
| 프론트엔드 (관리자) | http://localhost:3001/admin/dashboard |
| Swagger API 문서 | http://localhost:3000/api/docs |
| Nginx 통합 | http://localhost:80 |

### 기본 관리자 계정
```
이메일: admin@pointsystem.com
비밀번호: Admin@123!  ← 최초 접속 후 반드시 변경
```

### 서비스 종료
```bash
docker-compose down           # 컨테이너만 종료 (데이터 유지)
docker-compose down -v        # 컨테이너 + 볼륨 삭제 (데이터 초기화)
```

---

## AWS 배포 가이드

### 아키텍처 개요
```
Internet → ALB → ECS Fargate (Backend + Frontend)
                     ↓
               AWS RDS (PostgreSQL) + ElastiCache (Redis)
                     ↓
               ECR (Docker Images)
```

### 1. AWS RDS 설정 (PostgreSQL)

1. **RDS 인스턴스 생성**
   - Engine: PostgreSQL 16
   - Instance: `db.t3.medium` (운영: `db.r6g.large`)
   - Storage: 20GB GP3 (자동 확장 활성화)
   - Multi-AZ: 운영 환경 활성화 권장
   - 암호화: AWS KMS 활성화

2. **보안 그룹 설정**
   ```
   RDS 보안 그룹 인바운드:
   - Port 5432 / Source: ECS 태스크 보안 그룹 ID
   (절대 0.0.0.0/0으로 열지 말 것!)
   ```

3. **DB 초기화**
   ```bash
   # RDS 연결 후 스키마 실행
   psql -h your-rds-endpoint.rds.amazonaws.com -U postgres -d pointdb \
        -f database/init.sql
   ```

4. **백업 설정**
   - 자동 백업: 7일 보관
   - 백업 윈도우: 새벽 3시-4시 (KST)
   - 스냅샷: 배포 전 수동 스냅샷 권장

### 2. Amazon ECR 저장소 생성
```bash
aws ecr create-repository --repository-name point-backend --region ap-northeast-2
aws ecr create-repository --repository-name point-frontend --region ap-northeast-2
```

### 3. ECS Fargate 클러스터 설정

```bash
# 클러스터 생성
aws ecs create-cluster --cluster-name point-management-cluster

# 태스크 정의 등록 (task-definition.json 참고)
aws ecs register-task-definition --cli-input-json file://infra/ecs/backend-task-def.json
aws ecs register-task-definition --cli-input-json file://infra/ecs/frontend-task-def.json

# 서비스 생성
aws ecs create-service \
  --cluster point-management-cluster \
  --service-name point-backend-service \
  --task-definition point-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}"
```

### 4. 보안 그룹 설정 요약

| 보안 그룹 | 인바운드 | 출처 |
|-----------|----------|------|
| ALB-SG | 443, 80 | 0.0.0.0/0 |
| ECS-SG | 3000, 3001 | ALB-SG |
| RDS-SG | 5432 | ECS-SG |
| Redis-SG | 6379 | ECS-SG |

### 5. AWS Secrets Manager (환경 변수 보안 관리)
```bash
# DB 비밀번호 저장
aws secretsmanager create-secret \
  --name "point-management/db-password" \
  --secret-string "your_strong_db_password"

# JWT 시크릿 저장
aws secretsmanager create-secret \
  --name "point-management/jwt-secret" \
  --secret-string "$(openssl rand -base64 64)"
```
ECS 태스크 정의에서 `secrets` 섹션으로 참조합니다.

### 6. 수동 배포 (CI/CD 없이)
```bash
# 1. ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com

# 2. 백엔드 빌드 & 푸시
docker build -t point-backend ./backend
docker tag point-backend:latest \
  <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/point-backend:latest
docker push <account-id>.dkr.ecr.ap-northeast-2.amazonaws.com/point-backend:latest

# 3. ECS 서비스 강제 재배포
aws ecs update-service \
  --cluster point-management-cluster \
  --service point-backend-service \
  --force-new-deployment
```

---

## CI/CD 워크플로우 (GitHub Actions)

`.github/workflows/deploy.yml`에 정의된 자동화 파이프라인:

```
Push to main
    ↓
[1] Test Job
    - PostgreSQL 서비스 컨테이너 실행
    - 단위 테스트 + 커버리지
    ↓
[2] Build & Push Job (테스트 성공 시)
    - Docker 이미지 빌드
    - ECR 푸시 (태그: commit SHA + latest)
    ↓
[3] Deploy Job
    - ECS 태스크 정의 업데이트
    - 백엔드 서비스 배포 (롤링 업데이트)
    - 프론트엔드 서비스 배포
    - 서비스 안정화 대기
```

### GitHub Secrets 설정 필요
```
AWS_ACCESS_KEY_ID          # IAM 사용자 Access Key (최소 권한 원칙)
AWS_SECRET_ACCESS_KEY      # IAM 사용자 Secret Key
NEXT_PUBLIC_API_URL        # 프로덕션 API URL
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | NestJS 10, TypeORM, PostgreSQL 16 |
| Frontend | Next.js 14, React 18, Tailwind CSS, Zustand |
| 인증 | JWT (RS256), Passport.js, 카카오/네이버 OAuth |
| DB | PostgreSQL 16 (AWS RDS), Redis 7 (ElastiCache) |
| 인프라 | Docker, AWS ECS Fargate, ECR, ALB |
| CI/CD | GitHub Actions |
| 모니터링 | Winston 로깅, AWS CloudWatch |

---

## 포인트 트랜잭션 보장 방법

```
모든 포인트 적립/사용은 PostgreSQL SERIALIZABLE 트랜잭션으로 처리됩니다.

1. 비관적 잠금 (SELECT FOR UPDATE)으로 잔액 조회
2. 잔액 검증 (음수 방지, CHECK 제약)
3. 트랜잭션 레코드 + 잔액 업데이트 원자적 실행
4. referenceId 기반 중복 요청 방지 (멱등성)
5. balance_before/balance_after 양방향 검증
```

---

## 본인인증 연동 가이드

현재 **MOCK 모드**로 동작합니다. 실제 서비스 전환 시:

1. NICE평가정보(https://www.niceid.co.kr) 또는 KMC와 계약
2. `.env`에 `TELECOM_PROVIDER=NICE` 설정
3. `NICE_SITE_CODE`, `NICE_SITE_PASSWORD` 입력
4. `backend/src/auth/telecom-auth.service.ts`의 `niceCreateRequest`, `niceVerifyResult` 메서드 구현

---

## 개발 시 자주 사용하는 명령어

```bash
# 백엔드 로컬 실행
cd backend && npm run start:dev

# 프론트엔드 로컬 실행
cd frontend && npm run dev

# 테스트
cd backend && npm run test
cd backend && npm run test:e2e

# DB 마이그레이션
cd backend && npm run migration:run

# 포인트 만료 처리 수동 실행 (개발용)
curl -X POST http://localhost:3000/api/v1/admin/points/expire-now \
  -H "Authorization: Bearer <admin_token>"
```
