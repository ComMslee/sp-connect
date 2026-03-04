# 통합 포인트 관리 시스템

회원 포인트 적립/사용/관리 플랫폼 — Docker로 로컬 실행 또는 테스트 서버/AWS에 배포합니다.

---

## 목차

1. [Docker 설치](#1-docker-설치)
2. [프로젝트 받기](#2-프로젝트-받기)
3. [환경 변수 설정](#3-환경-변수-설정)
4. [실행하기](#4-실행하기)
5. [접속 주소 및 기본 계정](#5-접속-주소-및-기본-계정)
6. [테스트 서버 배포 (Docker Compose)](#6-테스트-서버-배포-docker-compose)
7. [AWS 배포 가이드](#7-aws-배포-가이드)
8. [CI/CD 자동 배포](#8-cicd-자동-배포-github-actions)
9. [자주 쓰는 명령어](#9-자주-쓰는-명령어)
10. [프로젝트 구조](#10-프로젝트-구조)

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
git clone https://github.com/ComMslee/sp-connect.git
cd sp-connect
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

아래처럼 모두 `Up` 상태이면 정상입니다:
```
NAME               STATUS
point_postgres     Up (healthy)
point_redis        Up (healthy)
point_backend      Up (healthy)
point_frontend     Up
point_nginx        Up
```

백엔드 로그 확인 (문제가 있을 때):
```bash
docker-compose logs -f backend
```

서비스 종료:
```bash
docker-compose down          # 종료 (데이터 유지)
docker-compose down -v       # 종료 + DB 데이터까지 삭제 (초기화)
```

---

## 5. 접속 주소 및 기본 계정

실행 후 브라우저에서 접속하세요:

| 용도 | 주소 |
|------|------|
| 회원 화면 | http://localhost:3001/login |
| 관리자 화면 | http://localhost:3001/admin/dashboard |
| API 문서 (Swagger) | http://localhost:3000/api/docs |

**기본 관리자 계정**
```
이메일:   admin@pointsystem.com
비밀번호: Admin@123!
```
> 처음 접속 후 반드시 비밀번호를 변경하세요.

---

## 6. 테스트 서버 배포 (Docker Compose)

AWS 없이 **일반 리눅스 서버 (VPS, 사내 서버, 클라우드 VM 등)** 에도 그대로 올릴 수 있습니다.
로컬 실행과 방식이 동일하고, 도메인/HTTPS만 추가로 설정하면 됩니다.

### 6-1. 서버 준비

Ubuntu 22.04 기준 (타 리눅스도 동일):

```bash
# 서버에 SSH 접속 후 Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Git 설치
sudo apt install -y git
```

### 6-2. 코드 받고 실행

```bash
# 프로젝트 클론
git clone https://github.com/ComMslee/sp-connect.git
cd sp-connect

# 환경 변수 설정
cp .env.example .env
nano .env   # DB_PASSWORD, JWT_SECRET 수정
```

```bash
# 실행 (로컬과 동일)
docker-compose up -d

# 상태 확인
docker-compose ps
```

이것만으로 서버에서 동작합니다. 서버 IP로 접속 가능:
```
http://서버IP:3001       # 프론트엔드
http://서버IP:3000/api/docs  # Swagger
```

---

### 6-3. 도메인 + HTTPS 설정 (선택사항)

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
# 인증서 위치를 nginx가 읽을 수 있도록 복사
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem infra/nginx/certs/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem   infra/nginx/certs/
```

`infra/nginx/nginx.conf`에서 443 HTTPS 블록을 활성화한 뒤:
```bash
docker-compose restart nginx
```

---

### 6-4. 서버 재부팅 시 자동 시작

```bash
# 서버 켜질 때 자동으로 서비스 올라오게 설정
sudo systemctl enable docker

# docker-compose를 systemd 서비스로 등록
sudo tee /etc/systemd/system/point-system.service > /dev/null <<EOF
[Unit]
Description=Point Management System
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/home/ubuntu/sp-connect
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

이제 서버가 재부팅되어도 자동으로 실행됩니다.

---

### 6-5. 코드 업데이트 방법

새 버전을 배포할 때:
```bash
cd sp-connect

# 최신 코드 받기
git pull

# 이미지 다시 빌드 후 재시작
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

## 7. AWS 배포 가이드

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

### 6-1. AWS RDS 생성 (PostgreSQL DB)

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

### 6-2. ECR 이미지 저장소 생성

```bash
aws ecr create-repository --repository-name point-backend  --region ap-northeast-2
aws ecr create-repository --repository-name point-frontend --region ap-northeast-2
```

---

### 6-3. 보안 그룹 설정

각 서비스가 필요한 포트만 열어야 합니다:

| 보안 그룹 | 허용 포트 | 허용 출처 |
|-----------|-----------|-----------|
| ALB-SG | 80, 443 | 0.0.0.0/0 (전체 인터넷) |
| ECS-SG | 3000, 3001 | ALB-SG만 |
| RDS-SG | 5432 | ECS-SG만 |
| Redis-SG | 6379 | ECS-SG만 |

> RDS와 Redis는 인터넷에서 절대 직접 접근하면 안 됩니다.

---

### 6-4. Secrets Manager에 비밀 정보 저장

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

### 6-5. ECS Fargate 서비스 생성

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

### 6-6. 수동 배포 (CI/CD 없이 직접 올리기)

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

## 8. CI/CD 자동 배포 (GitHub Actions)

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

## 9. 자주 쓰는 명령어

```bash
# 전체 재시작
docker-compose restart

# 특정 서비스만 재시작
docker-compose restart backend

# 로그 실시간 확인
docker-compose logs -f backend
docker-compose logs -f frontend

# DB 접속 (로컬)
docker exec -it point_postgres psql -U postgres -d pointdb

# 이미지 새로 빌드 (코드 변경 후)
docker-compose up -d --build backend
```

---

## 10. 프로젝트 구조

```
sp-connect/
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
│       ├── member/           # 회원용 화면 (포인트 조회/사용)
│       └── admin/            # 관리자 화면 (대시보드, 회원관리)
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

## 기술 스택

| 영역 | 기술 |
|------|------|
| 백엔드 | NestJS, TypeORM, PostgreSQL |
| 프론트엔드 | Next.js 14, Tailwind CSS, Zustand |
| 인증 | JWT, 카카오/네이버 OAuth, NICE 본인인증 |
| 인프라 | Docker, AWS ECS Fargate, RDS, ElastiCache |
| CI/CD | GitHub Actions |
