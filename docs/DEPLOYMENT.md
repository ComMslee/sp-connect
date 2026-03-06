# 배포 가이드

> [← README로 돌아가기](../README.md)

---

## 목차

1. [테스트 서버 배포 (Docker Compose)](#1-테스트-서버-배포-docker-compose)
2. [AWS 배포 가이드](#2-aws-배포-가이드)
3. [CI/CD 자동 배포 (GitHub Actions)](#3-cicd-자동-배포-github-actions)

---

## 1. 테스트 서버 배포 (Docker Compose)

AWS 없이 **일반 리눅스 서버 (VPS, 사내 서버, 클라우드 VM 등)** 에도 그대로 올릴 수 있습니다.
로컬 실행과 방식이 동일하고, 도메인/HTTPS만 추가로 설정하면 됩니다.

### 1-1. 서버 준비

Ubuntu 22.04 기준 (타 리눅스도 동일):

```bash
# 서버에 SSH 접속 후 Docker + Git 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt install -y git
```

### 1-2. 코드 받고 실행

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

### 1-3. 도메인 + HTTPS 설정 (선택사항)

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

### 1-4. 서버 재부팅 시 자동 시작

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

### 1-5. 코드 업데이트 방법

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

## 2. AWS 배포 가이드

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

### 2-1. AWS RDS 생성 (PostgreSQL DB)

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

### 2-2. ECR 이미지 저장소 생성

```bash
aws ecr create-repository --repository-name point-backend  --region ap-northeast-2
aws ecr create-repository --repository-name point-frontend --region ap-northeast-2
```

---

### 2-3. 보안 그룹 설정

각 서비스가 필요한 포트만 열어야 합니다:

| 보안 그룹 | 허용 포트 | 허용 출처 |
|-----------|-----------|-----------|
| ALB-SG | 80, 443 | 0.0.0.0/0 (전체 인터넷) |
| ECS-SG | 3000, 3001 | ALB-SG만 |
| RDS-SG | 5432 | ECS-SG만 |
| Redis-SG | 6379 | ECS-SG만 |

> RDS와 Redis는 인터넷에서 절대 직접 접근하면 안 됩니다.

---

### 2-4. Secrets Manager에 비밀 정보 저장

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

### 2-5. ECS Fargate 서비스 생성

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

### 2-6. 수동 배포 (CI/CD 없이 직접 올리기)

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

## 3. CI/CD 자동 배포 (GitHub Actions)

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
