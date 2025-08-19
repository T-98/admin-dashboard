import {
  Body,
  Controller,
  Headers,
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
}
