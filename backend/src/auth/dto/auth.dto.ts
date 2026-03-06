import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, Length, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '홍길동' })
  @IsString()
  @Length(2, 50)
  name: string;

  @ApiProperty({ description: '휴대폰 번호 (본인인증에서 획득)', example: '01012345678' })
  @IsString()
  @Matches(/^01[0-9]{8,9}$/, { message: '올바른 휴대폰 번호를 입력해주세요' })
  phone: string;

  @ApiProperty({ description: '이메일 (로그인 식별자)', example: 'user@example.com' })
  @IsEmail({}, { message: '올바른 이메일 주소를 입력해주세요' })
  email: string;

  @ApiProperty({ description: '비밀번호 (8자 이상, 영문+숫자+특수문자)', example: 'Secure@123' })
  @IsString()
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: '비밀번호는 8자 이상, 영문+숫자+특수문자를 포함해야 합니다',
  })
  password: string;

  @ApiProperty({ description: '통신사 본인인증 CI (88자)', example: 'abc123...' })
  @IsString()
  @Length(88, 88)
  ci: string;

  @ApiPropertyOptional({ description: '통신사 본인인증 DI (64자)' })
  @IsOptional()
  @IsString()
  @Length(64, 64)
  di?: string;

  @ApiPropertyOptional({
    description: '소셜 연동 임시 토큰 — 소셜에서 가입 시 전달. 가입 완료 후 소셜 계정 자동 연결',
  })
  @IsOptional()
  @IsString()
  socialToken?: string;
}

export class LoginDto {
  @ApiProperty({ description: '이메일 (로그인 식별자)', example: 'user@example.com' })
  @IsEmail({}, { message: '올바른 이메일 주소를 입력해주세요' })
  email: string;

  @ApiProperty({ example: 'Secure@123' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: '리프레시 토큰' })
  @IsString()
  refreshToken: string;
}

export class TelecomVerifyDto {
  @ApiProperty({ description: '통신사 인증 요청 Token (NICE, KMC 등에서 발급)', example: 'enc_data_...' })
  @IsString()
  encData: string;

  @ApiPropertyOptional({ description: '통신사 구분', example: 'NICE' })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class SocialLinkDto {
  @ApiProperty({ description: '소셜 연동 임시 토큰 (소셜 로그인 미연결 시 발급, 10분 유효)' })
  @IsString()
  socialToken: string;
}
