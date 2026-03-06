-- ============================================================
-- 통합 포인트 관리 시스템 - PostgreSQL 초기화 스크립트
-- ============================================================

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM 타입 정의
-- ============================================================
CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE auth_provider AS ENUM ('LOCAL', 'KAKAO', 'NAVER', 'TELECOM');
CREATE TYPE point_transaction_type AS ENUM ('EARN', 'USE', 'EXPIRE', 'CANCEL', 'ADJUST');
CREATE TYPE point_transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE point_source AS ENUM ('SIGNUP_BONUS', 'PURCHASE', 'REVIEW', 'EVENT', 'EXTERNAL_API', 'ADMIN_ADJUST', 'REFERRAL');

-- ============================================================
-- 사용자 테이블
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(50)  NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,          -- 로그인 식별자 (필수)
    phone           VARCHAR(20)  NOT NULL UNIQUE,          -- 본인인증으로 획득
    password_hash   VARCHAR(255) NOT NULL,                 -- 모든 회원 필수 (소셜도 비밀번호 보유)
    status          user_status  NOT NULL DEFAULT 'ACTIVE',
    auth_provider   auth_provider NOT NULL DEFAULT 'LOCAL', -- 항상 LOCAL (소셜은 user_social_providers)
    ci              VARCHAR(88)  UNIQUE,                   -- 본인인증 CI (88자 고정)
    di              VARCHAR(64),                           -- 중복가입 확인 DI
    is_verified     BOOLEAN      NOT NULL DEFAULT FALSE,   -- 본인인증 완료 여부
    point_balance   INTEGER      NOT NULL DEFAULT 0 CHECK (point_balance >= 0),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

COMMENT ON COLUMN users.email IS '로그인 식별자 - 이메일+비밀번호 로그인';
COMMENT ON COLUMN users.ci IS '통신사 본인인증 연계정보 - 동일인 식별 키';
COMMENT ON COLUMN users.di IS '사이트별 중복가입 확인 정보';

-- ============================================================
-- 포인트 정책 테이블
-- ============================================================
CREATE TABLE point_policies (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    expiry_days         INTEGER      CHECK (expiry_days > 0),    -- NULL이면 만료 없음
    is_default          BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN point_policies.expiry_days IS 'NULL이면 만료 없음, 양수이면 적립일로부터 N일 후 만료';

-- ============================================================
-- 포인트 트랜잭션 테이블 (핵심)
-- ============================================================
CREATE TABLE point_transactions (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type            point_transaction_type NOT NULL,
    status          point_transaction_status NOT NULL DEFAULT 'PENDING',
    source          point_source    NOT NULL,
    amount          INTEGER         NOT NULL CHECK (amount > 0),
    balance_before  INTEGER         NOT NULL CHECK (balance_before >= 0),
    balance_after   INTEGER         NOT NULL CHECK (balance_after >= 0),
    description     VARCHAR(500),
    reference_id    VARCHAR(255),                           -- 외부 연동 참조 ID
    external_site   VARCHAR(100),                          -- 외부 사이트 식별자
    policy_id       INTEGER         REFERENCES point_policies(id),
    expires_at      TIMESTAMPTZ,
    parent_id       UUID            REFERENCES point_transactions(id), -- 취소/조정 시 원본 참조
    metadata        JSONB           DEFAULT '{}',          -- 추가 메타데이터
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by      UUID            REFERENCES users(id),  -- 관리자가 수동 조정 시
    CONSTRAINT chk_balance CHECK (
        (type IN ('EARN', 'ADJUST') AND balance_after = balance_before + amount)
        OR (type IN ('USE', 'EXPIRE', 'CANCEL') AND balance_after = balance_before - amount)
    )
);

COMMENT ON TABLE point_transactions IS '포인트 적립/사용/만료/취소 이력 - 절대 수정/삭제 금지';
COMMENT ON COLUMN point_transactions.balance_before IS '트랜잭션 처리 전 잔액';
COMMENT ON COLUMN point_transactions.balance_after IS '트랜잭션 처리 후 잔액';

-- ============================================================
-- 포인트 만료 스케줄 테이블
-- ============================================================
CREATE TABLE point_expiry_schedules (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID        NOT NULL REFERENCES users(id),
    transaction_id      UUID        NOT NULL REFERENCES point_transactions(id),
    amount              INTEGER     NOT NULL CHECK (amount > 0),
    remaining_amount    INTEGER     NOT NULL CHECK (remaining_amount >= 0),
    expires_at          TIMESTAMPTZ NOT NULL,
    is_expired          BOOLEAN     NOT NULL DEFAULT FALSE,
    expired_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 외부 연동 사이트 테이블
-- ============================================================
CREATE TABLE external_sites (
    id              SERIAL      PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    site_key        VARCHAR(50)  UNIQUE NOT NULL,          -- 고유 식별 키
    api_key         VARCHAR(255) NOT NULL,                 -- 암호화된 API 키
    api_secret      VARCHAR(255) NOT NULL,                 -- 암호화된 시크릿
    webhook_url     VARCHAR(500),
    allowed_ips     TEXT[],                                -- IP 화이트리스트
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    daily_limit     INTEGER,                               -- 일일 포인트 한도
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 관리자 테이블
-- ============================================================
CREATE TABLE admins (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('SUPER', 'MANAGER', 'OPERATOR')),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 인증 세션/리프레시 토큰 테이블
-- ============================================================
CREATE TABLE refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
    admin_id    UUID        REFERENCES admins(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_one_subject CHECK (
        (user_id IS NOT NULL AND admin_id IS NULL) OR
        (user_id IS NULL AND admin_id IS NOT NULL)
    )
);

-- ============================================================
-- 소셜 계정 연동 테이블 (카카오/네이버 → 기존 계정 연결)
-- ============================================================
CREATE TABLE user_social_providers (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider     VARCHAR(10) NOT NULL,                     -- 'KAKAO' | 'NAVER'
    provider_id  VARCHAR(255) NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_provider UNIQUE(provider, provider_id),  -- 동일 소셜 계정은 한 유저에만
    CONSTRAINT uq_user_provider UNIQUE(user_id, provider)  -- 유저당 플랫폼별 하나
);

COMMENT ON TABLE user_social_providers IS '카카오/네이버 소셜 연동 - 기존 계정의 추가 로그인 수단';

-- ============================================================
-- 감사 로그 테이블
-- ============================================================
CREATE TABLE audit_logs (
    id          BIGSERIAL   PRIMARY KEY,
    actor_id    UUID,                                      -- 작업자 ID (관리자/시스템)
    actor_type  VARCHAR(20)  NOT NULL,                     -- 'ADMIN', 'USER', 'SYSTEM'
    action      VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id   VARCHAR(255),
    old_value   JSONB,
    new_value   JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 인덱스
-- ============================================================
-- users
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_ci ON users(ci) WHERE ci IS NOT NULL;
CREATE INDEX idx_usp_user_id ON user_social_providers(user_id);
CREATE INDEX idx_usp_provider ON user_social_providers(provider, provider_id);
CREATE INDEX idx_users_status ON users(status);

-- point_transactions
CREATE INDEX idx_pt_user_id ON point_transactions(user_id);
CREATE INDEX idx_pt_created_at ON point_transactions(created_at DESC);
CREATE INDEX idx_pt_user_created ON point_transactions(user_id, created_at DESC);
CREATE INDEX idx_pt_type ON point_transactions(type);
CREATE INDEX idx_pt_status ON point_transactions(status);
CREATE INDEX idx_pt_expires_at ON point_transactions(expires_at) WHERE expires_at IS NOT NULL AND status = 'COMPLETED';
CREATE INDEX idx_pt_external_site ON point_transactions(external_site) WHERE external_site IS NOT NULL;
CREATE INDEX idx_pt_reference_id ON point_transactions(reference_id) WHERE reference_id IS NOT NULL;

-- point_expiry_schedules
CREATE INDEX idx_pes_user_id ON point_expiry_schedules(user_id);
CREATE INDEX idx_pes_expires_at ON point_expiry_schedules(expires_at) WHERE is_expired = FALSE;

-- audit_logs
CREATE INDEX idx_al_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_al_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- 자동 updated_at 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_point_transactions_updated_at BEFORE UPDATE ON point_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_point_policies_updated_at BEFORE UPDATE ON point_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_external_sites_updated_at BEFORE UPDATE ON external_sites FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_admins_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 기본 데이터 삽입
-- ============================================================

-- 기본 포인트 정책 (1년 만료)
INSERT INTO point_policies (name, description, expiry_days, is_default, is_active)
VALUES
    ('기본 정책 (365일)', '기본 포인트 만료 정책 - 적립일로부터 365일', 365, TRUE, TRUE),
    ('무제한 정책', '만료 없는 포인트 정책', NULL, FALSE, TRUE),
    ('단기 정책 (90일)', '90일 단기 만료 포인트', 90, FALSE, TRUE);

-- 기본 슈퍼 관리자 (비밀번호: Admin@123! - 최초 접속 후 반드시 변경)
INSERT INTO admins (username, email, password_hash, role)
VALUES ('superadmin', 'admin@pointsystem.com',
        crypt('Admin@123!', gen_salt('bf', 12)), 'SUPER');

-- ============================================================
-- 테스트 계정 10개 (비밀번호: Test1234!)
-- ============================================================
INSERT INTO users (name, email, phone, password_hash, status, auth_provider, is_verified, point_balance) VALUES
    ('테스트사용자1',  'test1@test.com',  '010-0000-0001', crypt('Test1234!', gen_salt('bf', 12)), 'ACTIVE', 'LOCAL', TRUE,      0),
    ('테스트사용자2',  'test2@test.com',  '010-0000-0002', crypt('Test1234!', gen_salt('bf', 12)), 'ACTIVE', 'LOCAL', TRUE,      0),
    ('테스트사용자3',  'test3@test.com',  '010-0000-0003', crypt('Test1234!', gen_salt('bf', 12)), 'ACTIVE', 'LOCAL', TRUE,      0),
    ('테스트사용자4',  'test4@test.com',  '010-0000-0004', crypt('Test1234!', gen_salt('bf', 12)), 'ACTIVE', 'LOCAL', TRUE,   5000),
    ('테스트사용자5',  'test5@test.com',  '010-0000-0005', crypt('Test1234!', gen_salt('bf', 12)), 'ACTIVE', 'LOCAL', TRUE,   5000),
    ('테스트사용자6',  'test6@test.com',  '010-0000-0006', crypt('Test1234!', gen_salt('bf', 12)), 'ACTIVE', 'LOCAL', TRUE,   5000),
    ('테스트사용자7',  'test7@test.com',  '010-0000-0007', crypt('Test1234!', gen_salt('bf', 12)), 'ACTIVE', 'LOCAL', TRUE,  15000),
    ('테스트사용자8',  'test8@test.com',  '010-0000-0008', crypt('Test1234!', gen_salt('bf', 12)), 'ACTIVE', 'LOCAL', TRUE,  15000),
    ('테스트사용자9',  'test9@test.com',  '010-0000-0009', crypt('Test1234!', gen_salt('bf', 12)), 'SUSPENDED', 'LOCAL', TRUE, 3000),
    ('테스트사용자10', 'test10@test.com', '010-0000-0010', crypt('Test1234!', gen_salt('bf', 12)), 'ACTIVE', 'LOCAL', TRUE, 100000);
