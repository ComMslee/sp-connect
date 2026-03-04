import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, IsOptional, MaxLength, IsDateString } from 'class-validator';

export class ExternalEarnDto {
  @ApiProperty({
    description: '대상 회원 키 (UUID 또는 휴대폰 번호)',
    example: '01012345678',
  })
  @IsString()
  userKey: string;

  @ApiProperty({
    description: '적립 포인트 (양의 정수)',
    example: 1000,
  })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: '외부 시스템 고유 트랜잭션 ID (중복 방지 필수)',
    example: 'EXT-ORDER-20241201-00123',
  })
  @IsString()
  @MaxLength(255)
  referenceId: string;

  @ApiPropertyOptional({ description: '적립 사유', example: '구매 적립' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '만료일 (ISO 8601)', example: '2025-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: '추가 메타데이터 (JSON)' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ExternalUseDto {
  @ApiProperty({ description: '대상 회원 키 (UUID 또는 휴대폰 번호)', example: '01012345678' })
  @IsString()
  userKey: string;

  @ApiProperty({ description: '사용 포인트 (양의 정수)', example: 500 })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: '외부 시스템 고유 트랜잭션 ID', example: 'EXT-USE-20241201-00456' })
  @IsString()
  @MaxLength(255)
  referenceId: string;

  @ApiPropertyOptional({ description: '사용 사유', example: '포인트 결제' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class ExternalBalanceQueryDto {
  @ApiProperty({ description: '회원 키 (UUID 또는 휴대폰 번호)', example: '01012345678' })
  @IsString()
  userKey: string;
}
