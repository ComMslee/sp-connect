/**
 * 통신사 본인인증 서비스 (Mock + 실제 연동 가이드)
 *
 * 실제 서비스에서는 아래 기관 중 하나와 계약 필요:
 * - NICE평가정보: https://www.niceid.co.kr
 * - KMC(한국모바일인증): https://www.kmcert.com
 * - SKT/KT/LG U+ 직접 연동
 *
 * 연동 방식: 표준 PASS 인증 (행정안전부 공인)
 */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface TelecomVerifyResult {
  success: boolean;
  name: string;
  phone: string;
  birthDate: string;      // YYYYMMDD
  gender: 'M' | 'F';
  ci: string;             // 연계정보 (88자)
  di: string;             // 중복가입확인정보 (64자)
  nationality: 'DOMESTIC' | 'FOREIGN';
}

@Injectable()
export class TelecomAuthService {
  private readonly logger = new Logger(TelecomAuthService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 본인인증 URL 생성 (팝업/리다이렉트용)
   * - 실제 운영 시 NICE/KMC의 SDK를 사용하여 암호화된 요청 데이터 생성
   */
  async createVerifyRequest(returnUrl: string): Promise<{ url: string; encData: string }> {
    const provider = this.configService.get('TELECOM_PROVIDER', 'MOCK');

    if (provider === 'MOCK') {
      return this.mockCreateRequest(returnUrl);
    }

    // NICE 실제 연동 예시
    if (provider === 'NICE') {
      return this.niceCreateRequest(returnUrl);
    }

    throw new BadRequestException('지원하지 않는 인증 제공자입니다.');
  }

  /**
   * 인증 결과 처리
   * - 팝업/리다이렉트 완료 후 암호화된 응답 데이터 복호화
   */
  async verifyResult(encData: string): Promise<TelecomVerifyResult> {
    const provider = this.configService.get('TELECOM_PROVIDER', 'MOCK');

    if (provider === 'MOCK') {
      return this.mockVerifyResult(encData);
    }

    if (provider === 'NICE') {
      return this.niceVerifyResult(encData);
    }

    throw new BadRequestException('지원하지 않는 인증 제공자입니다.');
  }

  // ============================================================
  // MOCK 구현 (개발/테스트 전용)
  // ============================================================
  private async mockCreateRequest(returnUrl: string): Promise<{ url: string; encData: string }> {
    this.logger.warn('[MOCK] 실제 통신사 인증을 사용하지 않습니다. 개발/테스트 전용입니다.');
    const mockEncData = Buffer.from(
      JSON.stringify({ returnUrl, timestamp: Date.now() }),
    ).toString('base64');

    return {
      url: `${returnUrl}?mock=true`,
      encData: mockEncData,
    };
  }

  private async mockVerifyResult(encData: string): Promise<TelecomVerifyResult> {
    this.logger.warn('[MOCK] 테스트용 본인인증 결과 반환');

    // Mock CI/DI (실제는 동일인 88자 고정값)
    const mockCi = 'A'.repeat(88);
    const mockDi = 'B'.repeat(64);

    return {
      success: true,
      name: '테스트사용자',
      phone: '01099999999',
      birthDate: '19900101',
      gender: 'M',
      ci: mockCi,
      di: mockDi,
      nationality: 'DOMESTIC',
    };
  }

  // ============================================================
  // NICE 실제 연동 (계약 후 활성화)
  // ============================================================
  private async niceCreateRequest(returnUrl: string): Promise<{ url: string; encData: string }> {
    /**
     * NICE 본인인증 연동 절차:
     * 1. NICE로부터 사이트 코드, 사이트 패스워드 발급받기
     * 2. NICE SDK(Node.js) 또는 직접 AES128 CBC 암호화 구현
     * 3. 요청 데이터 암호화 후 NICE 서버로 전송
     *
     * 실제 코드 (NICE SDK 사용 시):
     * const nice = new NiceID(siteCode, sitePassword);
     * const encData = await nice.encrypt(requestData);
     */
    const siteCode = this.configService.get('NICE_SITE_CODE');
    const sitePassword = this.configService.get('NICE_SITE_PASSWORD');

    if (!siteCode || !sitePassword) {
      throw new BadRequestException('NICE 인증 설정이 누락되었습니다.');
    }

    // 실제 구현은 NICE SDK 문서 참고
    throw new Error('NICE 실제 연동 구현 필요 - NICE SDK 설치 후 구현');
  }

  private async niceVerifyResult(encData: string): Promise<TelecomVerifyResult> {
    // NICE 응답 복호화 구현 필요
    throw new Error('NICE 응답 복호화 구현 필요');
  }
}
