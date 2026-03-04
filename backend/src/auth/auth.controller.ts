import {
  Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { TelecomAuthService } from './telecom-auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, TelecomVerifyDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly telecomAuthService: TelecomAuthService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: '회원가입 (본인인증 CI 필수)' })
  @ApiResponse({ status: 201, description: '가입 성공, JWT 토큰 반환' })
  @ApiResponse({ status: 409, description: '이미 가입된 계정' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인 (휴대폰+비밀번호)' })
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
  // 소셜 로그인 (카카오)
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
    const { tokens, isNew } = await this.authService.socialLogin(req.user);
    // 프론트엔드로 토큰 전달 (리다이렉트 또는 쿠키)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(
      `${frontendUrl}/auth/social/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}&isNew=${isNew}`,
    );
  }

  // ============================================================
  // 소셜 로그인 (네이버)
  // ============================================================
  @Get('naver')
  @UseGuards(AuthGuard('naver'))
  @ApiOperation({ summary: '네이버 소셜 로그인 시작' })
  async naverLogin() {}

  @Get('naver/callback')
  @UseGuards(AuthGuard('naver'))
  @ApiOperation({ summary: '네이버 OAuth 콜백' })
  async naverCallback(@Req() req, @Res() res) {
    const { tokens, isNew } = await this.authService.socialLogin(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(
      `${frontendUrl}/auth/social/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}&isNew=${isNew}`,
    );
  }
}
