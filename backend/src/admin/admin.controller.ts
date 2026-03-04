import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminAdjustPointDto } from '../points/dto/point.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('admin')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** 대시보드 통계 */
  @Get('dashboard/stats')
  @ApiOperation({ summary: '[관리자] 대시보드 핵심 지표' })
  async getDashboardStats(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.adminService.getDashboardStats(startDate, endDate);
  }

  /** 회원 목록 조회 */
  @Get('users')
  @ApiOperation({ summary: '[관리자] 회원 목록 조회 (필터/페이지네이션)' })
  async getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getUsers({ page, limit, search, status });
  }

  /** 특정 회원 상세 */
  @Get('users/:userId')
  @ApiOperation({ summary: '[관리자] 특정 회원 상세 조회' })
  @ApiParam({ name: 'userId', description: '회원 UUID' })
  async getUserDetail(@Param('userId') userId: string) {
    return this.adminService.getUserDetail(userId);
  }

  /** 회원 상태 변경 */
  @Patch('users/:userId/status')
  @ApiOperation({ summary: '[관리자] 회원 상태 변경 (활성/정지/탈퇴)' })
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() body: { status: string; reason?: string },
    @Request() req,
  ) {
    return this.adminService.updateUserStatus(userId, body.status, body.reason, req.user.id);
  }

  /** 포인트 수동 조정 */
  @Post('points/adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[관리자] 포인트 수동 지급/차감' })
  async adjustPoints(@Body() dto: AdminAdjustPointDto, @Request() req) {
    return this.adminService.adjustPoints(dto, req.user.id);
  }

  /** 전체 포인트 이력 조회 */
  @Get('points/history')
  @ApiOperation({ summary: '[관리자] 포인트 이력 조회 (사용자별/기간별/유형별 필터)' })
  async getPointHistory(
    @Query('page') page = 1,
    @Query('limit') limit = 30,
    @Query('userId') userId?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('source') source?: string,
  ) {
    return this.adminService.getPointHistory({ page, limit, userId, type, startDate, endDate, source });
  }

  /** 포인트 정책 목록 */
  @Get('policies')
  @ApiOperation({ summary: '[관리자] 포인트 정책 목록' })
  async getPolicies() {
    return this.adminService.getPolicies();
  }

  /** 포인트 정책 생성/수정 */
  @Post('policies')
  @ApiOperation({ summary: '[관리자] 포인트 정책 생성' })
  async createPolicy(@Body() body: any) {
    return this.adminService.createPolicy(body);
  }

  /** 외부 연동 사이트 목록 */
  @Get('external-sites')
  @ApiOperation({ summary: '[관리자] 외부 연동 사이트 목록' })
  async getExternalSites() {
    return this.adminService.getExternalSites();
  }

  /** 외부 연동 사이트 등록 */
  @Post('external-sites')
  @ApiOperation({ summary: '[관리자] 외부 연동 사이트 등록 및 API 키 발급' })
  async createExternalSite(@Body() body: any) {
    return this.adminService.createExternalSite(body);
  }
}
