/**
 * 외부 사이트 연동 API
 * - 헤더: X-API-Key + X-Site-Key 인증
 * - 모든 요청에 idempotencyKey(referenceId) 필수 권장
 */
import {
  Controller, Post, Get, Body, Param, Headers, UnauthorizedException,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ExternalService } from './external.service';
import { ExternalEarnDto, ExternalUseDto, ExternalBalanceQueryDto } from './dto/external.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('external')
@ApiHeader({ name: 'X-API-Key', required: true, description: '외부 연동 API 키' })
@ApiHeader({ name: 'X-Site-Key', required: true, description: '사이트 식별 키' })
@UseGuards(ApiKeyGuard)
@Controller('external')
export class ExternalController {
  constructor(private readonly externalService: ExternalService) {}

  /**
   * POST /api/v1/external/points/earn
   * 외부 사이트에서 포인트 적립 요청
   */
  @Post('points/earn')
  @Throttle({ default: { ttl: 60000, limit: 300 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[외부연동] 포인트 적립',
    description: '외부 사이트에서 특정 회원에게 포인트를 적립합니다.\n\n' +
      '`referenceId`는 외부 시스템의 트랜잭션 ID로, **중복 요청 방지**를 위해 반드시 고유한 값을 사용해야 합니다.',
  })
  @ApiResponse({ status: 201, description: '포인트 적립 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청 (잔액 부족, 유효하지 않은 사용자 등)' })
  @ApiResponse({ status: 401, description: '인증 실패 (API 키 오류)' })
  @ApiResponse({ status: 409, description: '중복 요청 (referenceId 이미 처리됨)' })
  @ApiResponse({ status: 429, description: 'Rate limit 초과' })
  async earnPoints(
    @Body() dto: ExternalEarnDto,
    @Headers('x-site-key') siteKey: string,
  ) {
    return this.externalService.earnPoints(siteKey, dto);
  }

  /**
   * POST /api/v1/external/points/use
   * 외부 사이트에서 포인트 사용 요청
   */
  @Post('points/use')
  @Throttle({ default: { ttl: 60000, limit: 300 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[외부연동] 포인트 사용',
    description: '외부 사이트에서 특정 회원의 포인트를 사용합니다.\n\n잔액 부족 시 400 오류를 반환합니다.',
  })
  @ApiResponse({ status: 200, description: '포인트 사용 성공, 사용 후 잔액 반환' })
  @ApiResponse({ status: 400, description: '잔액 부족 또는 잘못된 요청' })
  async usePoints(
    @Body() dto: ExternalUseDto,
    @Headers('x-site-key') siteKey: string,
  ) {
    return this.externalService.usePoints(siteKey, dto);
  }

  /**
   * GET /api/v1/external/users/:userKey/balance
   * 특정 회원 포인트 잔액 조회
   */
  @Get('users/:userKey/balance')
  @ApiOperation({
    summary: '[외부연동] 회원 포인트 잔액 조회',
    description: '`userKey`는 회원 UUID 또는 휴대폰 번호(01012345678 형식)를 사용할 수 있습니다.',
  })
  @ApiParam({ name: 'userKey', description: '회원 UUID 또는 휴대폰 번호' })
  @ApiResponse({ status: 200, description: '잔액 정보 반환' })
  @ApiResponse({ status: 404, description: '회원 없음' })
  async getBalance(
    @Param('userKey') userKey: string,
    @Headers('x-site-key') siteKey: string,
  ) {
    return this.externalService.getBalance(siteKey, userKey);
  }

  /**
   * GET /api/v1/external/points/:referenceId/status
   * 포인트 트랜잭션 상태 조회 (멱등성 확인)
   */
  @Get('points/:referenceId/status')
  @ApiOperation({
    summary: '[외부연동] 트랜잭션 상태 조회',
    description: 'referenceId로 트랜잭션 처리 상태를 조회합니다. 중복 요청 여부 확인에 사용합니다.',
  })
  @ApiParam({ name: 'referenceId', description: '외부 연동 참조 ID' })
  async getTransactionStatus(
    @Param('referenceId') referenceId: string,
    @Headers('x-site-key') siteKey: string,
  ) {
    return this.externalService.getTransactionStatus(siteKey, referenceId);
  }
}
