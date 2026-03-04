import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PointsModule } from '../points/points.module';
import { User } from '../users/entities/user.entity';
import { PointTransaction } from '../points/entities/point-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, PointTransaction]), PointsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
