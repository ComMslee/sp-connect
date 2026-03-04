# 통합 포인트 관리 시스템 - API 명세서

> **Swagger UI**: 개발 환경 실행 후 `http://localhost:3000/api/docs` 접속

---

## 인증 방식

| 대상 | 방식 | 헤더/위치 |
|------|------|-----------|
| 회원 | Bearer JWT | `Authorization: Bearer <token>` |
| 관리자 | Bearer JWT (별도 발급) | `Authorization: Bearer <admin_token>` |
| 외부 사이트 | API Key | `X-API-Key: <key>` + `X-Site-Key: <site>` |

---

## 인증 API (`/api/v1/auth`)

### `POST /auth/register` - 회원가입
```json
// Request
{
  "name": "홍길동",
  "phone": "01012345678",
  "email": "user@example.com",
  "password": "Secure@123",
  "ci": "88자_연계정보",
  "di": "64자_중복확인정보"
}
// Response 201
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "name": "홍길동", "phone": "01012345678", "pointBalance": 0 },
    "tokens": { "accessToken": "eyJ...", "refreshToken": "abc...", "expiresIn": "1h" }
  }
}
```

### `POST /auth/login` - 로그인
```json
// Request
{ "phone": "01012345678", "password": "Secure@123" }
// Response 200
{ "success": true, "data": { "user": {...}, "tokens": { "accessToken": "...", "refreshToken": "..." } } }
```

### `GET /auth/telecom/request?returnUrl=` - 본인인증 요청 URL
### `POST /auth/telecom/verify` - 본인인증 결과 처리
### `GET /auth/kakao` - 카카오 소셜 로그인
### `GET /auth/naver` - 네이버 소셜 로그인

---

## 포인트 API (`/api/v1/points`) - JWT 필수

### `GET /points/balance` - 잔액 조회
```json
// Response 200
{ "success": true, "data": { "userId": "uuid", "balance": 5000 } }
```

### `GET /points/history` - 이력 조회
```
Query: page=1, limit=20, type=EARN|USE|EXPIRE, startDate=2024-01-01, endDate=2024-12-31
```
```json
// Response 200
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "type": "EARN",
        "status": "COMPLETED",
        "amount": 1000,
        "balanceBefore": 4000,
        "balanceAfter": 5000,
        "description": "구매 적립",
        "createdAt": "2024-12-01T10:00:00Z"
      }
    ],
    "total": 42, "page": 1, "totalPages": 3
  }
}
```

### `POST /points/earn` - 포인트 적립
```json
// Request
{
  "amount": 1000,
  "source": "PURCHASE",
  "description": "상품 구매 적립",
  "referenceId": "ORDER-20241201-001",
  "expiresAt": "2025-12-31T23:59:59Z"
}
// Response 201 - 트랜잭션 레코드 반환
// Error 409 - referenceId 중복 시
```

### `POST /points/use` - 포인트 사용
```json
// Request
{ "amount": 500, "description": "포인트 결제", "referenceId": "ORDER-20241201-002" }
// Error 400 - 잔액 부족 (balance: 500, requested: 1000)
```

### `POST /points/cancel` - 트랜잭션 취소
```json
// Request
{ "transactionId": "uuid", "reason": "구매 취소로 인한 포인트 환원" }
```

---

## 외부 연동 API (`/api/v1/external`) - API Key 필수

> **필수 헤더**: `X-API-Key: <발급된 키>` + `X-Site-Key: <사이트 식별자>`

### `POST /external/points/earn` - 외부 포인트 적립
```json
// Request
{
  "userKey": "01012345678",          // 전화번호 또는 UUID
  "amount": 1000,
  "referenceId": "EXT-ORDER-001",   // 필수: 외부 시스템 고유 ID (멱등성 보장)
  "description": "외부 구매 적립",
  "expiresAt": "2025-12-31T23:59:59Z"
}
// Response 201
{
  "data": {
    "transactionId": "uuid",
    "userId": "user-uuid",
    "amount": 1000,
    "balanceAfter": 6000,
    "status": "COMPLETED",
    "referenceId": "EXT-ORDER-001"
  }
}
// Error 409 - referenceId 이미 처리됨
```

### `POST /external/points/use` - 외부 포인트 사용
```json
// Request
{ "userKey": "01012345678", "amount": 500, "referenceId": "EXT-USE-001", "description": "포인트 결제" }
```

### `GET /external/users/:userKey/balance` - 잔액 조회
```json
// Response 200
{ "data": { "userId": "uuid", "balance": 5500, "currency": "KRW_POINT" } }
```

### `GET /external/points/:referenceId/status` - 트랜잭션 상태 조회
```json
// Response 200 (멱등성 확인용)
{ "data": { "transactionId": "uuid", "status": "COMPLETED", "amount": 1000, "balanceAfter": 6000 } }
```

---

## 관리자 API (`/api/v1/admin`) - 관리자 JWT 필수

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/admin/dashboard/stats` | 핵심 지표 (기간 파라미터) |
| GET | `/admin/users` | 회원 목록 (search, status, page, limit) |
| GET | `/admin/users/:userId` | 회원 상세 |
| PATCH | `/admin/users/:userId/status` | 회원 상태 변경 |
| POST | `/admin/points/adjust` | 포인트 수동 지급/차감 |
| GET | `/admin/points/history` | 전체 이력 (userId, type, source, 기간) |
| GET | `/admin/policies` | 포인트 정책 목록 |
| POST | `/admin/policies` | 포인트 정책 생성 |
| GET | `/admin/external-sites` | 외부 연동 사이트 목록 |
| POST | `/admin/external-sites` | 연동 사이트 등록 & API 키 발급 |

---

## 에러 코드

| HTTP | 의미 |
|------|------|
| 400 | 잘못된 요청 (잔액 부족, 유효성 검사 실패) |
| 401 | 인증 필요 (토큰 없음/만료) |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 중복 요청 (referenceId 충돌) |
| 429 | Rate limit 초과 |
| 500 | 서버 내부 오류 |

### 에러 응답 형식
```json
{
  "success": false,
  "statusCode": 400,
  "timestamp": "2024-12-01T10:00:00Z",
  "path": "/api/v1/points/use",
  "error": { "message": "포인트 잔액이 부족합니다. (보유: 500, 사용 요청: 1000)" }
}
```
