import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalController } from './external.controller';
import { ExternalService } from './external.service';
import { PointsModule } from '../points/points.module';
import { User } from '../users/entities/user.entity';
import { PointTransaction } from '../points/entities/point-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, PointTransaction]), PointsModule],
  controllers: [ExternalController],
  providers: [ExternalService],
})
export class ExternalModule {}
