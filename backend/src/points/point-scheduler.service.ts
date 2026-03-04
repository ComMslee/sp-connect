import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PointsService } from './points.service';

@Injectable()
export class PointSchedulerService {
  private readonly logger = new Logger(PointSchedulerService.name);

  constructor(private readonly pointsService: PointsService) {}

  /**
   * 매일 새벽 2시에 만료 포인트 처리
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: 'Asia/Seoul' })
  async handleExpiredPoints() {
    this.logger.log('Running scheduled expired points job...');
    try {
      await this.pointsService.processExpiredPoints();
    } catch (err) {
      this.logger.error(`Expired points job failed: ${err.message}`, err.stack);
    }
  }
}
