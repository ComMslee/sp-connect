import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { PointSchedulerService } from './point-scheduler.service';
import { PointTransaction } from './entities/point-transaction.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PointTransaction, User])],
  controllers: [PointsController],
  providers: [PointsService, PointSchedulerService],
  exports: [PointsService],
})
export class PointsModule {}
