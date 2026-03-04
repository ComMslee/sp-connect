import {
  Injectable, NotFoundException, UnauthorizedException, Logger, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PointsService } from '../points/points.service';
import { User } from '../users/entities/user.entity';
import { PointTransaction } from '../points/entities/point-transaction.entity';
import { ExternalEarnDto, ExternalUseDto } from './dto/external.dto';
import { PointSource } from '../points/entities/point-transaction.entity';

interface ExternalSite {
  id: number;
  name: string;
  siteKey: string;
  isActive: boolean;
  dailyLimit?: number;
}

@Injectable()
export class ExternalService {
  private readonly logger = new Logger(ExternalService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(PointTransaction) private readonly txRepo: Repository<PointTransaction>,
    private readonly pointsService: PointsService,
  ) {}

  /**
   * userKey로 사용자 조회 (UUID 또는 전화번호)
   */
  private async resolveUser(userKey: string): Promise<User> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userKey);
    const user = await this.userRepo.findOne({
      where: isUuid ? { id: userKey } : { phone: userKey },
    });
    if (!user) throw new NotFoundException(`사용자를 찾을 수 없습니다: ${userKey}`);
    return user;
  }

  async earnPoints(siteKey: string, dto: ExternalEarnDto) {
    const user = await this.resolveUser(dto.userKey);

    const tx = await this.pointsService.earnPoints(user.id, {
      amount: dto.amount,
      source: PointSource.EXTERNAL_API,
      description: dto.description || `외부연동 적립 (${siteKey})`,
      referenceId: dto.referenceId,
      expiresAt: dto.expiresAt,
    });

    this.logger.log(`[External:${siteKey}] Earned ${dto.amount}pts for user ${user.id}`);

    return {
      transactionId: tx.id,
      userId: user.id,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      status: tx.status,
      referenceId: dto.referenceId,
    };
  }

  async usePoints(siteKey: string, dto: ExternalUseDto) {
    const user = await this.resolveUser(dto.userKey);

    const tx = await this.pointsService.usePoints(user.id, {
      amount: dto.amount,
      description: dto.description || `외부연동 사용 (${siteKey})`,
      referenceId: dto.referenceId,
    });

    this.logger.log(`[External:${siteKey}] Used ${dto.amount}pts for user ${user.id}`);

    return {
      transactionId: tx.id,
      userId: user.id,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      status: tx.status,
      referenceId: dto.referenceId,
    };
  }

  async getBalance(siteKey: string, userKey: string) {
    const user = await this.resolveUser(userKey);
    return {
      userId: user.id,
      balance: user.pointBalance,
      currency: 'KRW_POINT',
    };
  }

  async getTransactionStatus(siteKey: string, referenceId: string) {
    const tx = await this.txRepo.findOne({
      where: { referenceId, externalSite: siteKey },
    });
    if (!tx) throw new NotFoundException(`트랜잭션을 찾을 수 없습니다: ${referenceId}`);

    return {
      transactionId: tx.id,
      referenceId: tx.referenceId,
      type: tx.type,
      status: tx.status,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      createdAt: tx.createdAt,
    };
  }
}
