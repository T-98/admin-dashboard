import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { authenticateUser } from '../common-authenticator';
import { AcceptInviteDto } from './dto/invite-accept.dto';

@Controller('invites')
export class InvitesController {
  constructor(
    private readonly invitesService: InvitesService,
    private readonly prismaService: PrismaService,
  ) {}

  @Post()
  async createInvite(
    @Body() createInviteDto: CreateInviteDto,
    @Headers('x-email') email: string,
    @Headers('x-password') password: string,
  ) {
    // 🚫 Validate requester credentials
    if (!email || !password) {
      throw new UnauthorizedException('Missing credentials');
    }

    // ✅ Authenticate the user
    const requester = await authenticateUser(
      this.prismaService,
      email,
      password,
    );

    // ✅ Delegate to service
    return this.invitesService.createInvite(requester.id, createInviteDto);
  }

  @Post('accept')
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Headers('x-email') email: string,
    @Headers('x-password') password: string,
  ) {
    if (!email || !password)
      throw new UnauthorizedException('Missing credentials');
    const user = await authenticateUser(this.prismaService, email, password);
    return this.invitesService.acceptInvite(user.id, dto);
  }
}
