import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    // 관리자 테이블 별도 인증 시 수정 필요
    // 현재는 JWT payload의 isAdmin 필드 활용
    if (!user?.isAdmin) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }
    return true;
  }
}
