# 통합 포인트 관리 시스템

회원 포인트 적립/사용/관리 플랫폼 — Docker로 로컬 실행 또는 테스트 서버/AWS에 배포합니다.

---

## 목차

1. [Docker 설치](#1-docker-설치)
2. [프로젝트 받기](#2-프로젝트-받기)
3. [환경 변수 설정](#3-환경-변수-설정)
4. [실행하기](#4-실행하기)
5. [Docker 컨테이너 구성](#5-docker-컨테이너-구성)
6. [접속 주소 및 기본 계정](#6-접속-주소-및-기본-계정)
7. [테스트 서버 배포 (Docker Compose)](#7-테스트-서버-배포-docker-compose)
8. [AWS 배포 가이드](#8-aws-배포-가이드)
9. [CI/CD 자동 배포](#9-cicd-자동-배포-github-actions)
10. [자주 쓰는 명령어](#10-자주-쓰는-명령어)
11. [프로젝트 구조](#11-프로젝트-구조)
12. [기술 스택](#12-기술-스택)

---

## 1. Docker 설치

Docker만 있으면 Node.js, PostgreSQL, Redis를 **따로 설치하지 않아도** 됩니다.

### Windows / Mac
[https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) 에서 **Docker Desktop** 다운로드 후 설치

설치 확인:
```bash
docker --version
# Docker version 25.x.x 이상이면 정상
```

### Ubuntu (Linux)
```bash
# Docker 설치
curl -fsSL https://get.docker.com | sh

# 현재 사용자를 docker 그룹에 추가 (sudo 없이 사용)
sudo usermod -aG docker $USER
newgrp docker

# 설치 확인
docker --version
```

> **Git도 필요합니다.**
> - Windows: [https://git-scm.com](https://git-scm.com) 에서 다운로드
> - Mac: `xcode-select --install`
> - Ubuntu: `sudo apt install git`

---

## 2. 프로젝트 받기

```bash
git clone https://github.com/ComMslee/point-web.git
cd point-web
```

---

## 3. 환경 변수 설정

`.env.example` 파일을 복사해서 `.env` 파일을 만듭니다.

```bash
cp .env.example .env
```

`.env` 파일을 열고 아래 두 가지만 수정하면 로컬 실행이 가능합니다:

```env
DB_PASSWORD=원하는DB비밀번호     # 예: MyPass@1234
JWT_SECRET=랜덤문자열64자이상    # 예: openssl rand -base64 64 로 생성
```

**JWT_SECRET 빠르게 생성하는 법:**
```bash
# Mac / Linux
openssl rand -base64 64

# 위 명령이 없으면 아래 사이트에서 생성
# https://generate-secret.vercel.app/64
```

> 소셜 로그인(카카오/네이버) 및 본인인증은 선택 사항입니다.
> 해당 KEY가 없어도 일반 로그인/포인트 기능은 모두 정상 동작합니다.

---

## 4. 실행하기

```bash
# 모든 서비스 백그라운드 실행 (최초 실행 시 이미지 빌드로 5~10분 소요)
docker-compose up -d
```

실행 상태 확인:
```bash
docker-compose ps
```

아래처럼 모두 `Up (healthy)` 상태이면 정상입니다:
```
NAME             STATUS
point_postgres   Up (healthy)
point_redis      Up (healthy)
point_backend    Up (healthy)
point_frontend   Up (healthy)
point_nginx      Up
```

> 로그 확인, 재시작, 종료 등 자주 쓰는 명령어는 [10절](#10-자주-쓰는-명령어)을 참고하세요.

---

## 5. Docker 컨테이너 구성

`docker-compose up -d`를 실행하면 **5개 컨테이너**가 순서대로 올라옵니다.

### 전체 구조

```
        사용자 (브라우저)
               │
               │ http://localhost
               ▼
       ┌───────────────┐
       │  ⑤  Nginx    │  ← 입구에서 요청을 알맞은 곳으로 안내
       └───┬───────┬───┘
           │       │
      웹화면│       │API 요청 (/api/*)
           ▼       ▼
    ┌─────────┐  ┌───────────────┐
    │ ④ Front │  │  ③ Backend   │  ← 직접 접속도 가능
    │  (화면) │  │  (비즈니스)  │    :3000/api/docs (Swagger)
    │  :3001  │  └───┬───────┬───┘
    └─────────┘      │       │
                 DB  │       │  캐시
                저장 │       │  저장
                     ▼       ▼
              ┌──────────┐ ┌──────────┐
              │ ① Postgres│ │ ② Redis  │
              │ (데이터베이스)│ │ (캐시)   │
              │  :5432   │ │  :6379   │
              └──────────┘ └──────────┘
```

> **시작 순서**: ①②가 준비되면 → ③ 시작 → ③④가 준비되면 → ⑤ 시작

### 컨테이너 역할 요약

| # | 컨테이너 | 한 줄 설명 | 접속 포트 |
|---|----------|-----------|-----------|
| ① | `point_postgres` | 📦 모든 데이터를 영구 저장하는 데이터베이스 | 5432 |
| ② | `point_redis` | ⚡ 로그인 토큰을 빠르게 저장하는 캐시 | 6379 |
| ③ | `point_backend` | 🔧 로그인·포인트 등 모든 기능을 처리하는 API 서버 | 3000 |
| ④ | `point_frontend` | 🖥️ 회원·관리자가 사용하는 웹 화면 | 3001 |
| ⑤ | `point_nginx` | 🚦 요청을 ③④로 나눠 전달하는 관문 | 80, 443 |

---

### ① point_postgres — 데이터베이스

회원 정보, 포인트 이력, 적립 정책 등 **모든 데이터를 영구 저장**합니다.
컨테이너를 재시작하거나 껐다 켜도 데이터는 그대로 유지됩니다.

- **DB 이름**: `pointdb`
- **첫 실행 시**: `database/init.sql`이 자동으로 실행되어 테이블과 테스트 계정 10개가 생성됩니다.
- **데이터 저장**: `postgres_data` 볼륨 (컨테이너 삭제해도 유지)

### ② point_redis — 캐시

로그인 시 발급된 **리프레시 토큰을 임시 저장**합니다.
컨테이너를 재시작하면 저장 내용이 사라집니다 → 사용자는 재로그인이 필요합니다.

### ③ point_backend — API 서버 (핵심)

로그인, 포인트 적립/사용/조회 등 **모든 기능의 처리를 담당**합니다.
DB(①)와 캐시(②)가 정상 기동된 후에 시작됩니다.

- **API 주소**: `http://localhost:3000/api/v1`
- **API 문서**: http://localhost:3000/api/docs (Swagger — 개발 시 유용)
- **로그 저장**: `backend_logs` 볼륨

### ④ point_frontend — 웹 화면

회원과 관리자가 사용하는 **웹 페이지를 제공**합니다.
접속 주소는 [6절](#6-접속-주소-및-기본-계정)을 참고하세요.

### ⑤ point_nginx — 관문 (리버스 프록시)

브라우저에서 들어오는 모든 요청을 받아 **알맞은 컨테이너로 전달**합니다.

- `/api/*` 경로 → **백엔드(③)**로 전달
- 그 외 모든 경로 → **프론트엔드(④)**로 전달

덕분에 사용자는 포트 번호 없이 `http://localhost` 하나로 접속할 수 있습니다.

---

### 데이터 저장 위치 (볼륨)

`docker-compose down`만으로는 데이터가 사라지지 않습니다.
완전히 초기화하려면 `docker-compose down -v`를 사용하세요.

| 볼륨 | 저장 내용 | `down -v` 시 영향 |
|------|-----------|-------------------|
| `postgres_data` | 회원·포인트 전체 데이터 | ⚠️ 모든 데이터 삭제 |
| `redis_data` | 로그인 토큰 (임시) | 재로그인 필요 |
| `backend_logs` | 서버 로그 파일 | 로그 기록 삭제 |

---

## 6. 접속 주소 및 기본 계정

실행 후 브라우저에서 접속하세요:

| 용도 | 주소 |
|------|------|
| 회원 로그인 | http://localhost:3001/login |
| 관리자 로그인 | http://localhost:3001/admin/login |
| 관리자 대시보드 | http://localhost:3001/admin/dashboard |
| API 문서 (Swagger) | http://localhost:3000/api/docs |

**기본 관리자 계정**
```
이메일:   admin@pointsystem.com
비밀번호: Admin@123!
```
> 처음 접속 후 반드시 비밀번호를 변경하세요.
> 관리자와 회원 인증은 완전히 분리되어 있습니다 (토큰 별도 관리).

**테스트 회원 계정 10개** (로그인 화면에서 사용)

비밀번호 공통: `Test1234!`

| 번호 | 전화번호 | 포인트 | 상태 |
|------|----------|--------|------|
| 1~3 | 010-0000-0001 ~ 003 | 0 P | 활성 |
| 4~6 | 010-0000-0004 ~ 006 | 5,000 P | 활성 |
| 7~8 | 010-0000-0007 ~ 008 | 15,000 P | 활성 |
| 9 | 010-0000-0009 | 3,000 P | 정지 (로그인 불가) |
| 10 | 010-0000-0010 | 100,000 P | 활성 |

> DB를 초기화(`docker-compose down -v`)하면 테스트 계정도 자동으로 다시 생성됩니다.

---

## 7. 테스트 서버 배포 (Docker Compose)

AWS 없이 **일반 리눅스 서버 (VPS, 사내 서버, 클라우드 VM 등)** 에도 그대로 올릴 수 있습니다.
로컬 실행과 방식이 동일하고, 도메인/HTTPS만 추가로 설정하면 됩니다.

### 7-1. 서버 준비

Ubuntu 22.04 기준 (타 리눅스도 동일):

```bash
# 서버에 SSH 접속 후 Docker + Git 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt install -y git
```

### 7-2. 코드 받고 실행

```bash
git clone https://github.com/ComMslee/point-web.git
cd point-web
cp .env.example .env
nano .env   # DB_PASSWORD, JWT_SECRET 수정
docker-compose up -d
docker-compose ps
```

서버 IP로 접속 가능:
```
http://서버IP:3001           # 프론트엔드
http://서버IP:3000/api/docs  # Swagger
```

---

### 7-3. 도메인 + HTTPS 설정 (선택사항)

도메인이 있다면 **Certbot(무료 SSL)** 으로 HTTPS를 적용할 수 있습니다.

```bash
# Certbot 설치
sudo apt install -y certbot

# 80포트를 잠깐 비우고 인증서 발급
docker-compose stop nginx
sudo certbot certonly --standalone -d yourdomain.com
docker-compose start nginx
```

발급된 인증서를 Nginx에 연결:
```bash
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem infra/nginx/certs/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem   infra/nginx/certs/
```

`infra/nginx/nginx.conf`에서 443 HTTPS 블록을 활성화한 뒤:
```bash
docker-compose restart nginx
```

---

### 7-4. 서버 재부팅 시 자동 시작

```bash
sudo systemctl enable docker

sudo tee /etc/systemd/system/point-system.service > /dev/null <<EOF
[Unit]
Description=Point Management System
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/home/ubuntu/point-web
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
RemainAfterExit=yes
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable point-system
sudo systemctl start point-system
```

---

### 7-5. 코드 업데이트 방법

```bash
cd point-web
git pull
docker-compose up -d --build
```

---

### 참고: 어떤 서버를 쓸 수 있나요?

| 서버 종류 | 예시 | 비용 |
|-----------|------|------|
| 국내 클라우드 VM | NCloud, KT Cloud, Naver Cloud | 월 1~5만원 |
| 해외 VPS | DigitalOcean, Vultr, Hetzner | 월 $5~20 |
| AWS EC2 (직접) | t3.small 이상 | 월 $15~ |
| 사내 서버 | 물리 서버, NAS | 별도 |

> 최소 사양: CPU 2코어, RAM 2GB, 디스크 20GB 이상 권장

---

## 8. AWS 배포 가이드

### 전체 구조

```
사용자
  │
  ▼
ALB (로드밸런서, HTTPS)
  │
  ├─▶ ECS Fargate - Backend (NestJS)
  │         │
  │         ├─▶ RDS (PostgreSQL)
  │         └─▶ ElastiCache (Redis)
  │
  └─▶ ECS Fargate - Frontend (Next.js)

이미지 저장: ECR (Amazon Container Registry)
```

---

### 8-1. AWS RDS 생성 (PostgreSQL DB)

AWS 콘솔 → **RDS** → **데이터베이스 생성**

| 항목 | 설정값 |
|------|--------|
| 엔진 | PostgreSQL 16 |
| 인스턴스 | `db.t3.medium` (개발) / `db.r6g.large` (운영) |
| 스토리지 | 20GB GP3, 자동 확장 ON |
| DB 이름 | `pointdb` |
| 사용자 | `postgres` |
| Multi-AZ | 운영 환경에서는 활성화 권장 |
| 퍼블릭 액세스 | **아니오** (보안상 필수) |

RDS 생성 후 DB 스키마 초기화:
```bash
psql -h [RDS엔드포인트] -U postgres -d pointdb -f database/init.sql
```

---

### 8-2. ECR 이미지 저장소 생성

```bash
aws ecr create-repository --repository-name point-backend  --region ap-northeast-2
aws ecr create-repository --repository-name point-frontend --region ap-northeast-2
```

---

### 8-3. 보안 그룹 설정

각 서비스가 필요한 포트만 열어야 합니다:

| 보안 그룹 | 허용 포트 | 허용 출처 |
|-----------|-----------|-----------|
| ALB-SG | 80, 443 | 0.0.0.0/0 (전체 인터넷) |
| ECS-SG | 3000, 3001 | ALB-SG만 |
| RDS-SG | 5432 | ECS-SG만 |
| Redis-SG | 6379 | ECS-SG만 |

> RDS와 Redis는 인터넷에서 절대 직접 접근하면 안 됩니다.

---

### 8-4. Secrets Manager에 비밀 정보 저장

DB 비밀번호, JWT 키 등은 환경 변수로 넣지 말고 Secrets Manager에 저장합니다:

```bash
# DB 비밀번호
aws secretsmanager create-secret \
  --name "point/db-password" \
  --secret-string "강력한DB비밀번호"

# JWT 시크릿
aws secretsmanager create-secret \
  --name "point/jwt-secret" \
  --secret-string "$(openssl rand -base64 64)"
```

ECS 태스크 정의의 `secrets` 항목에서 위 이름으로 참조합니다.

---

### 8-5. ECS Fargate 서비스 생성

```bash
# 클러스터 생성
aws ecs create-cluster --cluster-name point-management-cluster

# 서비스 생성 (백엔드)
aws ecs create-service \
  --cluster point-management-cluster \
  --service-name point-backend-service \
  --task-definition point-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration \
    "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}"
```

---

### 8-6. 수동 배포 (CI/CD 없이 직접 올리기)

```bash
# 1) ECR 로그인
aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin \
    [계정ID].dkr.ecr.ap-northeast-2.amazonaws.com

# 2) 백엔드 이미지 빌드 & 업로드
docker build -t point-backend ./backend
docker tag point-backend:latest \
  [계정ID].dkr.ecr.ap-northeast-2.amazonaws.com/point-backend:latest
docker push \
  [계정ID].dkr.ecr.ap-northeast-2.amazonaws.com/point-backend:latest

# 3) ECS 서비스 재배포
aws ecs update-service \
  --cluster point-management-cluster \
  --service point-backend-service \
  --force-new-deployment
```

> 프론트엔드도 동일한 방식으로 `point-frontend` 저장소에 올립니다.

---

## 9. CI/CD 자동 배포 (GitHub Actions)

`main` 브랜치에 push하면 자동으로 테스트 → 빌드 → AWS 배포까지 실행됩니다.

```
main 브랜치에 push
       │
       ▼
  ① 자동 테스트
  (DB 포함 통합 테스트)
       │ 성공 시
       ▼
  ② Docker 이미지 빌드
  ECR에 업로드
       │
       ▼
  ③ ECS 서비스 배포
  (무중단 롤링 업데이트)
```

**GitHub 저장소 → Settings → Secrets에 아래 값 등록 필요:**

| 키 이름 | 설명 |
|---------|------|
| `AWS_ACCESS_KEY_ID` | AWS IAM 사용자 Access Key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM 사용자 Secret Key |
| `NEXT_PUBLIC_API_URL` | 운영 서버 API 주소 (예: `https://api.yourdomain.com/api/v1`) |

> IAM 사용자는 ECR, ECS 권한만 부여하세요 (최소 권한 원칙).

---

## 10. 자주 쓰는 명령어

```bash
# 전체 재시작
docker-compose restart

# 특정 서비스만 재시작
docker-compose restart backend

# 로그 실시간 확인
docker-compose logs -f backend
docker-compose logs -f frontend

# 종료 (데이터 유지)
docker-compose down

# 종료 + DB 데이터까지 삭제 (초기화)
docker-compose down -v

# 이미지 새로 빌드 (코드 변경 후)
docker-compose up -d --build backend

# DB 직접 접속
docker exec -it point_postgres psql -U postgres -d pointdb

# Redis 직접 접속
docker exec -it point_redis redis-cli -a redis_secret
```

---

## 11. 프로젝트 구조

```
point-web/
├── backend/                  # NestJS 백엔드 API 서버
│   └── src/
│       ├── auth/             # 로그인, 소셜 로그인, 본인인증
│       ├── points/           # 포인트 적립/사용/만료 (핵심 로직)
│       ├── users/            # 회원 정보
│       ├── admin/            # 관리자 API
│       └── external/         # 외부 사이트 연동 API
│
├── frontend/                 # Next.js 프론트엔드
│   └── src/app/
│       ├── login/            # 로그인 페이지
│       ├── register/         # 회원가입 (준비 중 - NICE 본인인증 연동 예정)
│       ├── member/           # 회원용 화면 (로그인 필요)
│       │   ├── dashboard/    # 포인트 현황
│       │   ├── earn/         # 포인트 적립 (준비 중)
│       │   ├── use/          # 포인트 사용 (준비 중)
│       │   └── history/      # 포인트 내역 (준비 중)
│       └── admin/            # 관리자 화면 (관리자 로그인 필요)
│           ├── login/        # 관리자 로그인
│           ├── dashboard/    # 대시보드
│           └── users/        # 회원관리
│
├── database/
│   └── init.sql              # DB 테이블 생성 스크립트
│
├── infra/nginx/nginx.conf    # 웹서버 설정
├── docs/API_SPEC.md          # 외부 연동 API 명세서
├── .github/workflows/
│   └── deploy.yml            # 자동 배포 설정
├── docker-compose.yml        # 로컬 전체 실행 설정
└── .env.example              # 환경 변수 예시
```

---

## 12. 기술 스택

| 영역 | 기술 |
|------|------|
| 백엔드 | NestJS, TypeORM, PostgreSQL |
| 프론트엔드 | Next.js 14, Tailwind CSS, Zustand |
| 인증 | JWT, 카카오/네이버 OAuth, NICE 본인인증 |
| 인프라 | Docker, AWS ECS Fargate, RDS, ElastiCache |
| CI/CD | GitHub Actions |
