import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserAuthDto } from './dto/user-auth-dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly prismaService: PrismaService) {}

  async login(userAuthDto: UserAuthDto): Promise<{
    userId: number;
    name: string;
    email: string;
    password: string;
  }> {
    const user = await this.prismaService.user.findUnique({
      where: { email: userAuthDto.email },
    });

    if (!user || !(await bcrypt.compare(userAuthDto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      password: userAuthDto.password,
    };
  }
}
