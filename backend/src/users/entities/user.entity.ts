import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, DeleteDateColumn, OneToMany, Index,
} from 'typeorm';
import { PointTransaction } from '../../points/entities/point-transaction.entity';

export enum UserStatus { ACTIVE = 'ACTIVE', INACTIVE = 'INACTIVE', SUSPENDED = 'SUSPENDED', DELETED = 'DELETED' }
export enum AuthProvider { LOCAL = 'LOCAL', KAKAO = 'KAKAO', NAVER = 'NAVER', TELECOM = 'TELECOM' }

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  @Index({ unique: true, where: 'email IS NOT NULL' })
  @Column({ length: 255, nullable: true })
  email: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  phone: string;

  @Column({ name: 'password_hash', length: 255, nullable: true, select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ name: 'auth_provider', type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  authProvider: AuthProvider;

  @Column({ name: 'provider_id', length: 255, nullable: true })
  providerId: string;

  @Index({ unique: true, where: 'ci IS NOT NULL' })
  @Column({ length: 88, nullable: true })
  ci: string;

  @Column({ length: 64, nullable: true })
  di: string;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'point_balance', type: 'int', default: 0 })
  pointBalance: number;

  @OneToMany(() => PointTransaction, (tx) => tx.user)
  transactions: PointTransaction[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
