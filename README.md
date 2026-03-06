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

**추가 문서:**
- [배포 가이드 (테스트 서버 / AWS / CI·CD)](docs/DEPLOYMENT.md)
- [자주 쓰는 명령어 · 프로젝트 구조 · 기술 스택 · 스크린샷](docs/REFERENCE.md)
- [외부 연동 API 명세서](docs/API_SPEC.md)

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

> 로그 확인, 재시작, 종료 등 자주 쓰는 명령어는 [REFERENCE.md](docs/REFERENCE.md#자주-쓰는-명령어)를 참고하세요.

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
| 관리자 회원관리 | http://localhost:3001/admin/users |
| 관리자 포인트이력 | http://localhost:3001/admin/points |
| 관리자 정책설정 | http://localhost:3001/admin/policies |
| 관리자 연동사이트 | http://localhost:3001/admin/sites |
| API 문서 (Swagger) | http://localhost:3000/api/docs |

**기본 관리자 계정**
```
이메일:   admin@pointsystem.com
비밀번호: Admin@123!
```
> 처음 접속 후 반드시 비밀번호를 변경하세요.
> 관리자와 회원 인증은 완전히 분리되어 있습니다 (토큰 별도 관리).

**테스트 회원 계정 10개** (로그인 화면에서 사용)

로그인 방식: **이메일 + 비밀번호** (비밀번호 공통: `Test1234!`)

| 번호 | 이메일 | 포인트 | 상태 |
|------|--------|--------|------|
| 1~3 | test1@test.com ~ test3@test.com | 0 P | 활성 |
| 4~6 | test4@test.com ~ test6@test.com | 5,000 P | 활성 |
| 7~8 | test7@test.com ~ test8@test.com | 15,000 P | 활성 |
| 9 | test9@test.com | 3,000 P | 정지 (로그인 불가) |
| 10 | test10@test.com | 100,000 P | 활성 |

> DB를 초기화(`docker-compose down -v`)하면 테스트 계정도 자동으로 다시 생성됩니다.
