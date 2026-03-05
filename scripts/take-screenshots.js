/**
 * 페이지 스크린샷 자동 캡쳐 스크립트
 * 사용법: node scripts/take-screenshots.js
 * 실행 전 playwright 설치: npx playwright install chromium
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'images');
const ADMIN_EMAIL = 'admin@pointsystem.com';
const ADMIN_PASS = 'Admin@123!';
const MEMBER_PHONE = '010-0000-0001';
const MEMBER_PASS = 'Test1234!';
const CAPTURE_TIME = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

async function addTimestamp(page, label) {
  await page.evaluate((text) => {
    const existing = document.getElementById('__screenshot-ts');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = '__screenshot-ts';
    div.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999;
      background: rgba(0,0,0,0.72); color: #fff; font-size: 12px;
      padding: 4px 12px; font-family: monospace; letter-spacing: 0.5px;
      display: flex; justify-content: space-between;
    `;
    div.innerHTML = `<span>📸 sp-connect — ${text}</span><span>${new Date().toLocaleString('ko-KR')}</span>`;
    document.body.appendChild(div);
  }, label);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });

  // ── 1. 회원 로그인 페이지 ──────────────────────────────────────
  {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await addTimestamp(page, '회원 로그인');
    await page.screenshot({ path: path.join(OUT_DIR, '01_login.png'), fullPage: false });
    console.log('✅ 01_login.png');
    await page.close();
  }

  // ── 2. 관리자 로그인 페이지 ────────────────────────────────────
  {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await addTimestamp(page, '관리자 로그인');
    await page.screenshot({ path: path.join(OUT_DIR, '02_admin_login.png'), fullPage: false });
    console.log('✅ 02_admin_login.png');
    await page.close();
  }

  // ── 관리자 로그인 (쿠키 세팅) ──────────────────────────────────
  {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/admin/dashboard`, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);

    await addTimestamp(page, '관리자 대시보드');
    await page.screenshot({ path: path.join(OUT_DIR, '03_admin_dashboard.png'), fullPage: false });
    console.log('✅ 03_admin_dashboard.png');

    // ── 3. 회원 관리 ────────────────────────────────────────────
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await addTimestamp(page, '회원 관리');
    await page.screenshot({ path: path.join(OUT_DIR, '04_admin_users.png'), fullPage: false });
    console.log('✅ 04_admin_users.png');

    // ── 4. 포인트 이력 ──────────────────────────────────────────
    await page.goto(`${BASE_URL}/admin/points`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await addTimestamp(page, '포인트 이력');
    await page.screenshot({ path: path.join(OUT_DIR, '05_admin_points.png'), fullPage: false });
    console.log('✅ 05_admin_points.png');

    // ── 5. 정책 설정 ────────────────────────────────────────────
    await page.goto(`${BASE_URL}/admin/policies`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await addTimestamp(page, '정책 설정');
    await page.screenshot({ path: path.join(OUT_DIR, '06_admin_policies.png'), fullPage: false });
    console.log('✅ 06_admin_policies.png');

    // ── 6. 연동 사이트 ──────────────────────────────────────────
    await page.goto(`${BASE_URL}/admin/sites`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await addTimestamp(page, '연동 사이트');
    await page.screenshot({ path: path.join(OUT_DIR, '07_admin_sites.png'), fullPage: false });
    console.log('✅ 07_admin_sites.png');

    await page.close();
  }

  // ── 회원 로그인 후 대시보드 ────────────────────────────────────
  {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="phone"]', MEMBER_PHONE);
    await page.fill('input[name="password"]', MEMBER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/member/dashboard`, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await addTimestamp(page, '회원 대시보드');
    await page.screenshot({ path: path.join(OUT_DIR, '08_member_dashboard.png'), fullPage: false });
    console.log('✅ 08_member_dashboard.png');
    await page.close();
  }

  await browser.close();
  console.log(`\n🎉 스크린샷 저장 완료: ${OUT_DIR}`);
  console.log(`📅 캡쳐 시점: ${CAPTURE_TIME}`);
}

run().catch((e) => { console.error('❌ 오류:', e.message); process.exit(1); });
