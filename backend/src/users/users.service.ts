import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      select: ['id', 'name', 'phone', 'email', 'status', 'pointBalance', 'isVerified', 'authProvider', 'createdAt'],
    });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }

  async updateProfile(id: string, data: { email?: string }): Promise<User> {
    await this.userRepo.update(id, data);
    return this.findById(id);
  }
}
