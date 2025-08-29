import {
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';
import { authenticateUser } from '../common-authenticator';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get(':userId')
  async getOrgsByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Headers('x-email') email: string,
    @Headers('x-password') password: string,
  ) {
    if (!email || !password)
      throw new UnauthorizedException('Missing credentials');

    //We don't need the returned user here as this is just for authentication
    // the passed in userId is the user whose orgs we want to get. Anyone
    // can request someone's org memberships
    await authenticateUser(this.prismaService, email, password);
    return this.organizationsService.getOrgsByUser(userId);
  }
}
