import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * 소셜 계정 연동 테이블
 * 카카오/네이버 OAuth를 기존 회원 계정(email+password)의 추가 로그인 수단으로 연결
 * - 한 유저가 카카오 + 네이버 모두 연결 가능
 * - 동일 소셜 계정(provider + providerId)은 하나의 유저에만 연결 가능
 */
@Entity('user_social_providers')
@Unique('uq_provider', ['provider', 'providerId'])
@Unique('uq_user_provider', ['userId', 'provider'])
export class UserSocialProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** 'KAKAO' | 'NAVER' */
  @Column({ length: 10 })
  provider: string;

  /** 해당 플랫폼에서 발급한 고유 사용자 ID */
  @Column({ name: 'provider_id', length: 255 })
  providerId: string;

  @CreateDateColumn({ name: 'connected_at', type: 'timestamptz' })
  connectedAt: Date;
}
