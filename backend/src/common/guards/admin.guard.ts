import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    /**
     * request.user는 JwtStrategy.validate()의 반환값:
     *   - 관리자 토큰: { ...Admin엔티티, isAdmin: true }  → AdminGuard 통과
     *   - 회원 토큰:   User 엔티티 (isAdmin 필드 없음)    → ForbiddenException (403)
     *   - 토큰 없음:   JwtAuthGuard가 먼저 401 반환       → 여기까지 오지 않음
     *
     * ※ 이 가드는 반드시 JwtAuthGuard 뒤에 사용해야 합니다.
     *   @UseGuards(JwtAuthGuard, AdminGuard)
     */
    if (!user?.isAdmin) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }
    return true;
  }
}
