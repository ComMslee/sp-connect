import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, DeleteDateColumn, OneToMany, Index,
} from 'typeorm';
import { PointTransaction } from '../../points/entities/point-transaction.entity';

export enum UserStatus { ACTIVE = 'ACTIVE', INACTIVE = 'INACTIVE', SUSPENDED = 'SUSPENDED', DELETED = 'DELETED' }
// 모든 회원은 LOCAL (이메일+비밀번호) — 소셜은 user_social_providers 테이블에서 관리
export enum AuthProvider { LOCAL = 'LOCAL', KAKAO = 'KAKAO', NAVER = 'NAVER', TELECOM = 'TELECOM' }

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  /** 로그인 식별자 — 이메일+비밀번호 방식 */
  @Index({ unique: true })
  @Column({ length: 255 })
  email: string;

  /** 본인인증으로 획득한 전화번호 */
  @Index({ unique: true })
  @Column({ length: 20 })
  phone: string;

  /** 모든 회원 필수 — 소셜 로그인으로 가입해도 비밀번호 보유 */
  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  /** 항상 LOCAL — 소셜은 user_social_providers 테이블로 관리 */
  @Column({ name: 'auth_provider', type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  authProvider: AuthProvider;

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
