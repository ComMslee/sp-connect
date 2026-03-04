import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt, IsPositive, IsEnum, IsOptional, IsString,
  MaxLength, IsUUID, Min, IsDateString,
} from 'class-validator';
import { PointSource } from '../entities/point-transaction.entity';

export class EarnPointDto {
  @ApiProperty({ description: '적립 포인트 (양의 정수)', example: 1000 })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: PointSource, description: '포인트 발생 원천', example: PointSource.PURCHASE })
  @IsEnum(PointSource)
  source: PointSource;

  @ApiPropertyOptional({ description: '적립 설명', example: '2024년 겨울 프로모션 포인트' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '외부 참조 ID (중복 적립 방지용)', example: 'ORDER-20241201-001' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenceId?: string;

  @ApiPropertyOptional({ description: '만료일 (ISO 8601)', example: '2025-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: '정책 ID' })
  @IsOptional()
  @IsInt()
  policyId?: number;
}

export class UsePointDto {
  @ApiProperty({ description: '사용 포인트 (양의 정수)', example: 500 })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: '사용 설명', example: '상품 구매 포인트 사용' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '외부 참조 ID', example: 'ORDER-20241201-001' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenceId?: string;
}

export class CancelTransactionDto {
  @ApiProperty({ description: '취소할 트랜잭션 ID', example: 'uuid-...' })
  @IsUUID()
  transactionId: string;

  @ApiPropertyOptional({ description: '취소 사유' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminAdjustPointDto {
  @ApiProperty({ description: '조정 대상 사용자 ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: '조정 포인트 (양수: 지급, 음수 불가 - 차감은 amount+description으로 표현)', example: 500 })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: ['EARN', 'USE'], description: '조정 유형', example: 'EARN' })
  @IsEnum(['EARN', 'USE'])
  adjustType: 'EARN' | 'USE';

  @ApiProperty({ description: '조정 사유 (필수)', example: '이벤트 당첨 포인트 지급' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class PointQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호 (1부터)', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['EARN', 'USE', 'EXPIRE', 'CANCEL', 'ADJUST'], description: '트랜잭션 유형' })
  @IsOptional()
  @IsEnum(['EARN', 'USE', 'EXPIRE', 'CANCEL', 'ADJUST'])
  type?: string;

  @ApiPropertyOptional({ description: '시작일 (ISO 8601)', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일 (ISO 8601)', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
