import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, Length, Matches, IsPhoneNumber } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '홍길동' })
  @IsString()
  @Length(2, 50)
  name: string;

  @ApiProperty({ description: '휴대폰 번호', example: '01012345678' })
  @IsString()
  @Matches(/^01[0-9]{8,9}$/, { message: '올바른 휴대폰 번호를 입력해주세요' })
  phone: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

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
}

export class LoginDto {
  @ApiProperty({ description: '휴대폰 번호', example: '01012345678' })
  @IsString()
  phone: string;

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
