import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TransactionType { EARN = 'EARN', USE = 'USE', EXPIRE = 'EXPIRE', CANCEL = 'CANCEL', ADJUST = 'ADJUST' }
export enum TransactionStatus { PENDING = 'PENDING', COMPLETED = 'COMPLETED', FAILED = 'FAILED', CANCELLED = 'CANCELLED' }
export enum PointSource {
  SIGNUP_BONUS = 'SIGNUP_BONUS', PURCHASE = 'PURCHASE', REVIEW = 'REVIEW',
  EVENT = 'EVENT', EXTERNAL_API = 'EXTERNAL_API', ADMIN_ADJUST = 'ADMIN_ADJUST', REFERRAL = 'REFERRAL',
}

@Entity('point_transactions')
@Index(['userId', 'createdAt'])
export class PointTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Column({ type: 'enum', enum: PointSource })
  source: PointSource;

  @Column({ type: 'int' })
  amount: number;

  @Column({ name: 'balance_before', type: 'int' })
  balanceBefore: number;

  @Column({ name: 'balance_after', type: 'int' })
  balanceAfter: number;

  @Column({ length: 500, nullable: true })
  description: string;

  @Index({ where: 'reference_id IS NOT NULL' })
  @Column({ name: 'reference_id', length: 255, nullable: true })
  referenceId: string;

  @Column({ name: 'external_site', length: 100, nullable: true })
  externalSite: string;

  @Column({ name: 'policy_id', nullable: true })
  policyId: number;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
