import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '@prisma/client';
import { UserSearchService } from './user-search.service';
import { UserSearchDto } from './dto/user-search.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { authenticateUser } from '../common-authenticator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userSearchService: UserSearchService,
    private readonly prismaService: PrismaService,
  ) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return await this.usersService.create(createUserDto);
  }

  @Get('search')
  async searchUsers(
    @Query() query: UserSearchDto,
    @Headers('x-email') email: string,
    @Headers('x-password') password: string,
  ) {
    if (!email || !password)
      throw new UnauthorizedException('Missing credentials');

    // 👮 Authenticate
    await authenticateUser(this.prismaService, email, password);

    // 🔎 Get user by email
    const user = await this.prismaService.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) throw new UnauthorizedException('User not found');

    // 🔁 Pass userId to searchUsers
    return this.userSearchService.searchUsers(query);
  }
}
