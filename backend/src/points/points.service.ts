import {
  Injectable, BadRequestException, NotFoundException,
  ConflictException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { PointTransaction, TransactionType, TransactionStatus, PointSource } from './entities/point-transaction.entity';
import { User } from '../users/entities/user.entity';
import { EarnPointDto, UsePointDto, CancelTransactionDto, AdminAdjustPointDto, PointQueryDto } from './dto/point.dto';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    @InjectRepository(PointTransaction)
    private readonly txRepo: Repository<PointTransaction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 포인트 적립 (DB 트랜잭션 보장)
   * - Serializable 격리 수준으로 동시성 문제 방지
   * - referenceId 중복 체크로 멱등성 보장
   */
  async earnPoints(userId: string, dto: EarnPointDto): Promise<PointTransaction> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager: EntityManager) => {
      // 1. 중복 referenceId 체크 (멱등성)
      if (dto.referenceId) {
        const existing = await manager.findOne(PointTransaction, {
          where: { userId, referenceId: dto.referenceId, status: TransactionStatus.COMPLETED },
        });
        if (existing) {
          this.logger.warn(`Duplicate earn request: userId=${userId}, referenceId=${dto.referenceId}`);
          throw new ConflictException(`이미 처리된 요청입니다 (referenceId: ${dto.referenceId})`);
        }
      }

      // 2. 비관적 잠금으로 사용자 잔액 조회
      const user = await manager
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :id AND u.status = :status', { id: userId, status: 'ACTIVE' })
        .getOne();

      if (!user) throw new NotFoundException('활성 사용자를 찾을 수 없습니다.');

      const balanceBefore = user.pointBalance;
      const balanceAfter = balanceBefore + dto.amount;

      // 3. 만료일 계산 (policy 기반 또는 직접 지정)
      let expiresAt: Date | null = null;
      if (dto.expiresAt) {
        expiresAt = new Date(dto.expiresAt);
      }

      // 4. 트랜잭션 레코드 생성
      const tx = manager.create(PointTransaction, {
        userId,
        type: TransactionType.EARN,
        status: TransactionStatus.COMPLETED,
        source: dto.source,
        amount: dto.amount,
        balanceBefore,
        balanceAfter,
        description: dto.description,
        referenceId: dto.referenceId,
        policyId: dto.policyId,
        expiresAt,
      });
      const savedTx = await manager.save(tx);

      // 5. 사용자 잔액 업데이트
      await manager.update(User, userId, { pointBalance: balanceAfter });

      this.logger.log(
        `Earned ${dto.amount}pts for user ${userId}: ${balanceBefore} -> ${balanceAfter}`,
      );
      return savedTx;
    });
  }

  /**
   * 포인트 사용 (DB 트랜잭션 보장)
   * - 잔액 부족 시 원자적으로 실패
   */
  async usePoints(userId: string, dto: UsePointDto): Promise<PointTransaction> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager: EntityManager) => {
      // 1. 중복 referenceId 체크
      if (dto.referenceId) {
        const existing = await manager.findOne(PointTransaction, {
          where: { userId, referenceId: dto.referenceId, status: TransactionStatus.COMPLETED },
        });
        if (existing) throw new ConflictException(`이미 처리된 요청입니다 (referenceId: ${dto.referenceId})`);
      }

      // 2. 비관적 잠금으로 잔액 조회
      const user = await manager
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :id AND u.status = :status', { id: userId, status: 'ACTIVE' })
        .getOne();

      if (!user) throw new NotFoundException('활성 사용자를 찾을 수 없습니다.');
      if (user.pointBalance < dto.amount) {
        throw new BadRequestException(
          `포인트 잔액이 부족합니다. (보유: ${user.pointBalance}, 사용 요청: ${dto.amount})`,
        );
      }

      const balanceBefore = user.pointBalance;
      const balanceAfter = balanceBefore - dto.amount;

      // 3. 트랜잭션 레코드 생성
      const tx = manager.create(PointTransaction, {
        userId,
        type: TransactionType.USE,
        status: TransactionStatus.COMPLETED,
        source: PointSource.PURCHASE,
        amount: dto.amount,
        balanceBefore,
        balanceAfter,
        description: dto.description,
        referenceId: dto.referenceId,
      });
      const savedTx = await manager.save(tx);

      // 4. 사용자 잔액 업데이트
      await manager.update(User, userId, { pointBalance: balanceAfter });

      this.logger.log(
        `Used ${dto.amount}pts for user ${userId}: ${balanceBefore} -> ${balanceAfter}`,
      );
      return savedTx;
    });
  }

  /**
   * 트랜잭션 취소 (적립 취소 또는 사용 취소)
   */
  async cancelTransaction(userId: string, dto: CancelTransactionDto): Promise<PointTransaction> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager: EntityManager) => {
      const originalTx = await manager.findOne(PointTransaction, {
        where: { id: dto.transactionId, userId },
      });
      if (!originalTx) throw new NotFoundException('트랜잭션을 찾을 수 없습니다.');
      if (originalTx.status === TransactionStatus.CANCELLED) {
        throw new BadRequestException('이미 취소된 트랜잭션입니다.');
      }

      const user = await manager
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :id', { id: userId })
        .getOne();

      let balanceBefore = user.pointBalance;
      let balanceAfter: number;
      let cancelType: TransactionType;

      if (originalTx.type === TransactionType.EARN) {
        // 적립 취소: 잔액 차감
        if (user.pointBalance < originalTx.amount) {
          throw new BadRequestException('포인트 잔액이 부족하여 적립 취소가 불가능합니다.');
        }
        balanceAfter = balanceBefore - originalTx.amount;
        cancelType = TransactionType.CANCEL;
      } else if (originalTx.type === TransactionType.USE) {
        // 사용 취소: 잔액 복원
        balanceAfter = balanceBefore + originalTx.amount;
        cancelType = TransactionType.EARN;
      } else {
        throw new BadRequestException('취소 가능한 트랜잭션 유형이 아닙니다.');
      }

      // 원본 트랜잭션 상태 변경
      await manager.update(PointTransaction, dto.transactionId, {
        status: TransactionStatus.CANCELLED,
      });

      // 취소 트랜잭션 생성
      const cancelTx = manager.create(PointTransaction, {
        userId,
        type: cancelType,
        status: TransactionStatus.COMPLETED,
        source: PointSource.ADMIN_ADJUST,
        amount: originalTx.amount,
        balanceBefore,
        balanceAfter,
        description: dto.reason || `트랜잭션 ${dto.transactionId} 취소`,
        parentId: dto.transactionId,
      });
      const savedCancelTx = await manager.save(cancelTx);

      // 잔액 업데이트
      await manager.update(User, userId, { pointBalance: balanceAfter });

      this.logger.log(`Cancelled tx ${dto.transactionId} for user ${userId}`);
      return savedCancelTx;
    });
  }

  /**
   * 관리자 수동 포인트 조정
   */
  async adminAdjust(dto: AdminAdjustPointDto, adminId: string): Promise<PointTransaction> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager: EntityManager) => {
      const user = await manager
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :id', { id: dto.userId })
        .getOne();

      if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

      const balanceBefore = user.pointBalance;
      let balanceAfter: number;
      let txType: TransactionType;

      if (dto.adjustType === 'EARN') {
        balanceAfter = balanceBefore + dto.amount;
        txType = TransactionType.EARN;
      } else {
        if (balanceBefore < dto.amount) throw new BadRequestException('잔액 부족');
        balanceAfter = balanceBefore - dto.amount;
        txType = TransactionType.USE;
      }

      const tx = manager.create(PointTransaction, {
        userId: dto.userId,
        type: txType,
        status: TransactionStatus.COMPLETED,
        source: PointSource.ADMIN_ADJUST,
        amount: dto.amount,
        balanceBefore,
        balanceAfter,
        description: dto.reason,
        createdBy: adminId,
      });
      const savedTx = await manager.save(tx);
      await manager.update(User, dto.userId, { pointBalance: balanceAfter });

      this.logger.log(`Admin ${adminId} adjusted ${dto.amount}pts (${dto.adjustType}) for user ${dto.userId}`);
      return savedTx;
    });
  }

  /**
   * 사용자 포인트 이력 조회 (페이지네이션)
   */
  async getTransactionHistory(userId: string, query: PointQueryDto) {
    const { page = 1, limit = 20, type, startDate, endDate } = query;

    const qb = this.txRepo
      .createQueryBuilder('tx')
      .where('tx.user_id = :userId', { userId })
      .orderBy('tx.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (type) qb.andWhere('tx.type = :type', { type });
    if (startDate) qb.andWhere('tx.created_at >= :startDate', { startDate });
    if (endDate) qb.andWhere('tx.created_at <= :endDate', { endDate: endDate + 'T23:59:59Z' });

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 사용자 잔액 조회
   */
  async getBalance(userId: string): Promise<{ balance: number; userId: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'pointBalance'] });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return { userId, balance: user.pointBalance };
  }

  /**
   * 만료 포인트 일괄 처리 (스케줄러 호출)
   */
  async processExpiredPoints(): Promise<void> {
    this.logger.log('Starting expired points processing...');
    const expiredTxs = await this.txRepo
      .createQueryBuilder('tx')
      .setLock('pessimistic_write')
      .where('tx.expires_at <= NOW()')
      .andWhere('tx.type = :type', { type: TransactionType.EARN })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .getMany();

    for (const tx of expiredTxs) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const user = await manager
            .createQueryBuilder(User, 'u')
            .setLock('pessimistic_write')
            .where('u.id = :id', { id: tx.userId })
            .getOne();

          if (!user || user.pointBalance < tx.amount) return;

          const balanceAfter = user.pointBalance - tx.amount;

          await manager.save(manager.create(PointTransaction, {
            userId: tx.userId,
            type: TransactionType.EXPIRE,
            status: TransactionStatus.COMPLETED,
            source: PointSource.ADMIN_ADJUST,
            amount: tx.amount,
            balanceBefore: user.pointBalance,
            balanceAfter,
            description: `만료 처리 (원본: ${tx.id})`,
            parentId: tx.id,
          }));

          await manager.update(PointTransaction, tx.id, { status: TransactionStatus.CANCELLED });
          await manager.update(User, tx.userId, { pointBalance: balanceAfter });
        });
      } catch (err) {
        this.logger.error(`Failed to expire tx ${tx.id}: ${err.message}`);
      }
    }
    this.logger.log(`Processed ${expiredTxs.length} expired transactions`);
  }
}
