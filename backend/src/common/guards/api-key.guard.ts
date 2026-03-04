import {
  Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const siteKey = request.headers['x-site-key'];

    if (!apiKey || !siteKey) {
      throw new UnauthorizedException('X-API-Key와 X-Site-Key 헤더가 필요합니다.');
    }

    // TODO: DB에서 external_sites 테이블 검증 (현재는 환경변수 기반 단순 검증)
    const validKey = this.configService.get<string>('EXTERNAL_API_KEY');
    if (apiKey !== validKey) {
      this.logger.warn(`Invalid API key attempt from ${request.ip}`);
      throw new UnauthorizedException('유효하지 않은 API 키입니다.');
    }

    request.siteKey = siteKey;
    return true;
  }
}
