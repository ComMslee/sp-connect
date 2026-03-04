import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { PointTransaction, TransactionType } from '../points/entities/point-transaction.entity';
import { PointsService } from '../points/points.service';
import { AdminAdjustPointDto } from '../points/dto/point.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(PointTransaction) private readonly txRepo: Repository<PointTransaction>,
    private readonly dataSource: DataSource,
    private readonly pointsService: PointsService,
  ) {}

  async getDashboardStats(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate + 'T23:59:59Z') : new Date();

    const [totalUsers, activeUsers, stats] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { status: UserStatus.ACTIVE } }),
      this.dataSource.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'EARN' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) AS total_earned,
          COALESCE(SUM(CASE WHEN type = 'USE' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) AS total_used,
          COALESCE(SUM(CASE WHEN type = 'EXPIRE' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) AS total_expired,
          COUNT(CASE WHEN type = 'EARN' AND status = 'COMPLETED' THEN 1 END) AS earn_count,
          COUNT(CASE WHEN type = 'USE' AND status = 'COMPLETED' THEN 1 END) AS use_count
        FROM point_transactions
        WHERE created_at BETWEEN $1 AND $2
      `, [start, end]),
    ]);

    const totalBalance = await this.dataSource
      .query('SELECT COALESCE(SUM(point_balance), 0) AS total_balance FROM users WHERE status = $1', ['ACTIVE']);

    return {
      period: { startDate: start, endDate: end },
      users: { total: totalUsers, active: activeUsers },
      points: {
        totalEarned: parseInt(stats[0]?.total_earned || '0'),
        totalUsed: parseInt(stats[0]?.total_used || '0'),
        totalExpired: parseInt(stats[0]?.total_expired || '0'),
        totalBalance: parseInt(totalBalance[0]?.total_balance || '0'),
        earnCount: parseInt(stats[0]?.earn_count || '0'),
        useCount: parseInt(stats[0]?.use_count || '0'),
      },
    };
  }

  async getUsers(params: { page: number; limit: number; search?: string; status?: string }) {
    const { page, limit, search, status } = params;
    const qb = this.userRepo.createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.phone', 'u.email', 'u.status', 'u.pointBalance', 'u.isVerified', 'u.createdAt'])
      .orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.andWhere('(u.name ILIKE :s OR u.phone LIKE :s2 OR u.email ILIKE :s)', {
        s: `%${search}%`, s2: `%${search}%`,
      });
    }
    if (status) qb.andWhere('u.status = :status', { status });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'name', 'phone', 'email', 'status', 'pointBalance', 'isVerified', 'authProvider', 'createdAt'],
    });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    const recentTx = await this.txRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return { user, recentTransactions: recentTx };
  }

  async updateUserStatus(userId: string, status: string, reason?: string, adminId?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    await this.userRepo.update(userId, { status: status as UserStatus });
    this.logger.log(`Admin ${adminId} changed user ${userId} status to ${status}: ${reason}`);
    return { userId, status };
  }

  async adjustPoints(dto: AdminAdjustPointDto, adminId: string) {
    return this.pointsService.adminAdjust(dto, adminId);
  }

  async getPointHistory(params: any) {
    const { page = 1, limit = 30, userId, type, startDate, endDate, source } = params;
    const qb = this.txRepo.createQueryBuilder('tx')
      .leftJoinAndSelect('tx.user', 'u')
      .select(['tx', 'u.id', 'u.name', 'u.phone'])
      .orderBy('tx.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (userId) qb.andWhere('tx.user_id = :userId', { userId });
    if (type) qb.andWhere('tx.type = :type', { type });
    if (source) qb.andWhere('tx.source = :source', { source });
    if (startDate) qb.andWhere('tx.created_at >= :startDate', { startDate });
    if (endDate) qb.andWhere('tx.created_at <= :endDate', { endDate: endDate + 'T23:59:59Z' });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPolicies() {
    return this.dataSource.query('SELECT * FROM point_policies ORDER BY id');
  }

  async createPolicy(data: any) {
    const result = await this.dataSource.query(
      'INSERT INTO point_policies (name, description, expiry_days, is_default, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [data.name, data.description, data.expiryDays || null, data.isDefault || false, true],
    );
    return result[0];
  }

  async getExternalSites() {
    return this.dataSource.query('SELECT id, name, site_key, allowed_ips, is_active, daily_limit, created_at FROM external_sites ORDER BY id');
  }

  async createExternalSite(data: any) {
    const crypto = require('crypto');
    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiSecret = crypto.randomBytes(32).toString('hex');

    const result = await this.dataSource.query(
      `INSERT INTO external_sites (name, site_key, api_key, api_secret, webhook_url, daily_limit)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, site_key, daily_limit`,
      [data.name, data.siteKey, apiKey, apiSecret, data.webhookUrl, data.dailyLimit],
    );

    return { ...result[0], apiKey, apiSecret, warning: '시크릿은 최초 1회만 제공됩니다. 안전하게 보관하세요.' };
  }
}
