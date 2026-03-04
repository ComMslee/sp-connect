import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam,
} from '@nestjs/swagger';
import { PointsService } from './points.service';
import { EarnPointDto, UsePointDto, CancelTransactionDto, PointQueryDto } from './dto/point.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('points')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('balance')
  @ApiOperation({ summary: '내 포인트 잔액 조회' })
  @ApiResponse({ status: 200, description: '잔액 정보 반환' })
  async getMyBalance(@Request() req) {
    return this.pointsService.getBalance(req.user.id);
  }

  @Get('history')
  @ApiOperation({ summary: '내 포인트 이력 조회 (페이지네이션)' })
  @ApiResponse({ status: 200, description: '포인트 이력 목록' })
  async getMyHistory(@Request() req, @Query() query: PointQueryDto) {
    return this.pointsService.getTransactionHistory(req.user.id, query);
  }

  @Post('earn')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '포인트 적립' })
  @ApiResponse({ status: 201, description: '포인트 적립 완료' })
  @ApiResponse({ status: 409, description: '중복 요청 (referenceId 충돌)' })
  async earn(@Request() req, @Body() dto: EarnPointDto) {
    return this.pointsService.earnPoints(req.user.id, dto);
  }

  @Post('use')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '포인트 사용' })
  @ApiResponse({ status: 200, description: '포인트 사용 완료' })
  @ApiResponse({ status: 400, description: '잔액 부족' })
  async use(@Request() req, @Body() dto: UsePointDto) {
    return this.pointsService.usePoints(req.user.id, dto);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '트랜잭션 취소 (사용자 요청)' })
  @ApiResponse({ status: 200, description: '취소 완료' })
  async cancel(@Request() req, @Body() dto: CancelTransactionDto) {
    return this.pointsService.cancelTransaction(req.user.id, dto);
  }

  @Get(':userId/balance')
  @ApiOperation({ summary: '특정 사용자 잔액 조회 (관리자용 - 내부 사용)' })
  @ApiParam({ name: 'userId', description: '사용자 UUID' })
  async getUserBalance(@Param('userId') userId: string) {
    return this.pointsService.getBalance(userId);
  }
}
