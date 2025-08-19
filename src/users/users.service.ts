import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role, InviteStatus, User } from '@prisma/client';
import { UserSearchService } from './user-search.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userSearchService: UserSearchService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashed = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.prismaService.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashed,
      },
    });
    await this.userSearchService.indexUser(user.id);
    return user;
  }

  async deleteUserFromOrg(
    requesterId: number,
    targetUserId: number,
    organizationId: number,
  ) {
    if (requesterId === targetUserId) {
      throw new ForbiddenException('You cannot delete yourself');
    }

    // Step 1: Validate requester is ADMIN or OWNER in the org
    const requesterOrg = await this.prismaService.userOrganization.findFirst({
      where: {
        userId: requesterId,
        organizationId,
        role: { in: [Role.ADMIN, Role.OWNER] },
      },
    });

    if (!requesterOrg) {
      throw new ForbiddenException(
        'You are not authorized to delete users in this organization',
      );
    }

    // Step 2: Validate target user is part of the same org
    const targetOrg = await this.prismaService.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId,
        },
      },
      include: {
        user: true, // This allows us to access `targetOrg.user.email`
      },
    });

    if (!targetOrg) {
      throw new NotFoundException(
        'Target user is not part of this organization',
      );
    }

    // Step 3: Role-based access control
    if (requesterOrg.role === Role.ADMIN && targetOrg.role !== Role.MEMBER) {
      throw new ForbiddenException(
        'Admins can only delete members, not other admins or owners',
      );
    }

    // Step 4: Remove all team memberships for this user in the org
    const orgTeamIds = await this.prismaService.team.findMany({
      where: { organizationId },
      select: { id: true },
    });

    const teamIds = orgTeamIds.map((t) => t.id);

    await this.prismaService.teamMember.deleteMany({
      where: {
        userId: targetUserId,
        teamId: { in: teamIds },
      },
    });

    // Step 5: Remove all invites for this user in this org
    await this.prismaService.invite.deleteMany({
      where: {
        email: targetOrg.user.email,
        organizationId,
        status: InviteStatus.PENDING,
      },
    });

    // Step 6: Remove from UserOrganization (org detachment)
    await this.prismaService.userOrganization.delete({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId,
        },
      },
    });

    // Step 7: If user has no orgs left, delete entirely + remove from ES
    const remainingOrgs = await this.prismaService.userOrganization.count({
      where: { userId: targetUserId },
    });

    if (remainingOrgs === 0) {
      await this.prismaService.user.delete({
        where: { id: targetUserId },
      });

      await this.userSearchService.removeUser(targetUserId);
    }

    return { message: 'User removed successfully' };
  }
}
