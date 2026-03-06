# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SP-Connect is a point management system with NestJS backend, Next.js 14 frontend, PostgreSQL, and Redis, orchestrated via Docker Compose. All documentation and UI are in Korean.

## Development Commands

### Docker (primary development method)
```bash
docker-compose up -d              # Start all 5 services
docker-compose down               # Stop (preserve data)
docker-compose down -v            # Stop + delete all data
docker-compose logs -f backend    # View backend logs
docker exec -it point_postgres psql -U postgres -d pointdb  # DB shell
```

### Backend (NestJS)
```bash
cd backend
npm run start:dev         # Dev server with watch (port 3000)
npm run build             # Production build
npm run lint              # ESLint
npm test                  # Jest unit tests
npm run test:e2e          # E2E tests
npm run migration:run     # Run TypeORM migrations
```

### Frontend (Next.js 14)
```bash
cd frontend
npm run dev               # Dev server (port 3001)
npm run build             # Production build (standalone output)
npm run lint              # ESLint + Next.js linting
```

### Screenshots
```bash
npm run screenshots       # Root-level Playwright screenshot generation
```

## Architecture

```
User → Nginx (80/443) → Frontend (3001) + Backend (3000)
                                           ↓
                                    PostgreSQL (5432) + Redis (6379)
```

### Backend Structure (`backend/src/`)
- **auth/** - Email+password login, social OAuth (Kakao/Naver), NICE phone verification. Passport strategies for JWT, Kakao, Naver.
- **points/** - Core point transactions (EARN/USE/EXPIRE). Uses SERIALIZABLE isolation with pessimistic locking (`FOR UPDATE`). Double-entry bookkeeping (balance_before/balance_after). Idempotent via `referenceId`.
- **users/** - User CRUD
- **admin/** - Admin dashboard APIs (separate JWT auth from member auth)
- **external/** - External API integration (X-API-Key + X-Site-Key header auth)
- **common/** - Guards, filters, interceptors. Global response wrapper: `{ success, data, timestamp }`

### Frontend Structure (`frontend/src/`)
- **App Router** with route groups: `/login`, `/register`, `/member/*`, `/admin/*`
- **State:** Zustand with localStorage persistence (separate member/admin stores)
- **API Client:** Axios with JWT refresh interceptors
- **Route Protection:** Next.js middleware checks cookies
- **UI:** Tailwind CSS + Radix UI primitives + Recharts

### Database
- PostgreSQL 16 with UUID primary keys
- `synchronize: false` — use migrations only
- Key tables: `users`, `user_social_providers`, `point_transactions`, `point_policies`, `point_expiry_schedules`, `external_sites`, `admins`, `audit_logs`
- Compound indexes on `(user_id, created_at DESC)`
- Init scripts in `database/`

### Auth System
- All users have LOCAL accounts (email + password required)
- Social providers (Kakao/Naver) are **additive** — linked via `user_social_providers` table
- Registration flow: NICE phone verification → email/password setup
- Dual JWT systems: member tokens vs admin tokens (completely separate)
- Refresh tokens stored in Redis
- NICE_MOCK_MODE env var enables mock phone verification in development

## Conventions

- **Path aliases:** `@/*` → `src/*` in both backend and frontend
- **Backend files:** `kebab-case` filenames, DTOs suffixed with `Dto`, entities with `.entity.ts`, guards with `.guard.ts`
- **Validation:** class-validator decorators on DTOs (backend), Zod schemas (frontend)
- **API prefix:** `/api/v1`
- **Swagger:** Available at `/api/docs` (dev/staging only)
- **Password rules:** 8+ chars, alphanumeric + special characters
- **Docker builds:** Multi-stage with non-root users (uid 1001)
- **Rate limiting:** 60/min general, 10/min auth endpoints, 100/min per IP (Throttler)

## Environment Setup

Copy `.env.example` to `.env` and fill in required values. Key variables include DB credentials, Redis config, JWT secrets, OAuth client IDs/secrets, and NICE API credentials.
