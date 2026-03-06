import {
  Controller, Post, Get, Delete, Body, Req, Res, Param,
  UseGuards, HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { TelecomAuthService } from './telecom-auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, TelecomVerifyDto, SocialLinkDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly telecomAuthService: TelecomAuthService,
  ) {}

  // ============================================================
  // 회원 가입 / 로그인
  // ============================================================
  @Post('register')
  @ApiOperation({ summary: '회원가입 (본인인증 CI 필수, 이메일+비밀번호)' })
  @ApiResponse({ status: 201, description: '가입 성공, JWT 토큰 반환' })
  @ApiResponse({ status: 409, description: '이미 가입된 계정 (이메일/전화번호/CI 중복)' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '이메일+비밀번호 로그인' })
  @ApiResponse({ status: 200, description: 'JWT 토큰 반환' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'JWT 토큰 갱신' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '로그아웃 (리프레시 토큰 무효화)' })
  async logout(@Req() req) {
    await this.authService.logout(req.user.id);
  }

  // ============================================================
  // 현재 로그인 유저 정보
  // ============================================================
  @Get('me')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '내 정보 조회' })
  async getMe(@Req() req) {
    return this.authService.getMe(req.user.id);
  }

  // ============================================================
  // 소셜 연동 관리
  // ============================================================
  @Get('social/profile')
  @ApiOperation({ summary: '소셜 임시 토큰에서 프로필 조회 (회원가입 pre-fill용)' })
  async getSocialProfile(@Query('token') token: string) {
    return this.authService.getSocialProfile(token);
  }

  @Get('me/socials')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '내 소셜 연동 목록 조회' })
  async getMySocials(@Req() req) {
    return this.authService.getMySocials(req.user.id);
  }

  @Post('social/link')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '소셜 계정 연동 (로그인 후 소셜 연결)' })
  async linkSocial(@Req() req, @Body() dto: SocialLinkDto) {
    await this.authService.linkSocial(req.user.id, dto.socialToken);
    return { message: '소셜 계정이 연동되었습니다.' };
  }

  @Delete('social/unlink/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '소셜 계정 연동 해제' })
  async unlinkSocial(@Req() req, @Param('provider') provider: string) {
    await this.authService.unlinkSocial(req.user.id, provider.toUpperCase());
    return { message: `${provider} 연동이 해제되었습니다.` };
  }

  // ============================================================
  // 본인인증 (통신사)
  // ============================================================
  @Get('telecom/request')
  @ApiOperation({ summary: '본인인증 요청 URL 생성' })
  async telecomRequest(@Query('returnUrl') returnUrl: string) {
    return this.telecomAuthService.createVerifyRequest(returnUrl || 'http://localhost:3001/auth/verify/callback');
  }

  @Post('telecom/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '본인인증 결과 처리' })
  async telecomVerify(@Body() dto: TelecomVerifyDto) {
    return this.telecomAuthService.verifyResult(dto.encData);
  }

  // ============================================================
  // 소셜 로그인 — 카카오
  // ============================================================
  @Get('kakao')
  @UseGuards(AuthGuard('kakao'))
  @ApiOperation({ summary: '카카오 소셜 로그인 시작' })
  async kakaoLogin() {
    // Passport가 카카오 OAuth로 리다이렉트
  }

  @Get('kakao/callback')
  @UseGuards(AuthGuard('kakao'))
  @ApiOperation({ summary: '카카오 OAuth 콜백' })
  async kakaoCallback(@Req() req, @Res() res) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const result = await this.authService.socialLogin(req.user);

    if (result.linked) {
      // Case A: 연결된 계정 → 로그인 완료, 토큰 전달
      return res.redirect(
        `${frontendUrl}/auth/social/callback?token=${result.tokens.accessToken}&refresh=${result.tokens.refreshToken}`,
      );
    } else {
      // Case B: 미연결 → socialTempToken 전달 (가입 또는 기존계정 연동)
      return res.redirect(
        `${frontendUrl}/auth/social/callback?socialToken=${result.socialTempToken}`,
      );
    }
  }

  // ============================================================
  // 소셜 로그인 — 네이버
  // ============================================================
  @Get('naver')
  @UseGuards(AuthGuard('naver'))
  @ApiOperation({ summary: '네이버 소셜 로그인 시작' })
  async naverLogin() {}

  @Get('naver/callback')
  @UseGuards(AuthGuard('naver'))
  @ApiOperation({ summary: '네이버 OAuth 콜백' })
  async naverCallback(@Req() req, @Res() res) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const result = await this.authService.socialLogin(req.user);

    if (result.linked) {
      return res.redirect(
        `${frontendUrl}/auth/social/callback?token=${result.tokens.accessToken}&refresh=${result.tokens.refreshToken}`,
      );
    } else {
      return res.redirect(
        `${frontendUrl}/auth/social/callback?socialToken=${result.socialTempToken}`,
      );
    }
  }
}
