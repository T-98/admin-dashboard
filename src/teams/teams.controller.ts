import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { authenticateUser } from '../common-authenticator';

@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly prismaService: PrismaService,
  ) {}

  @Post()
  async createTeam(
    @Body() dto: CreateTeamDto,
    @Headers('x-email') email: string,
    @Headers('x-password') password: string,
  ) {
    if (!email || !password)
      throw new UnauthorizedException('Missing credentials');

    const user = await authenticateUser(this.prismaService, email, password);

    return this.teamsService.createTeam(user.id, dto);
  }

  @Get(':userId')
  async getTeamsByUser(
    @Headers('x-email') email: string,
    @Headers('x-password') password: string,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    if (!email || !password)
      throw new UnauthorizedException('Missing credentials');

    //We don't need the returned user here as this is just for authentication
    // the passed in userId is the user whose teams we want to get. Anyone
    // can request someone's team memberships
    await authenticateUser(this.prismaService, email, password);

    return this.teamsService.getTeamsByUser(userId);
  }
}
