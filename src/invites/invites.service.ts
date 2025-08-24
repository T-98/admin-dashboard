import {
  ForbiddenException,
  NotFoundException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { Role, InviteStatus } from '@prisma/client';
import { AcceptInviteDto } from './dto/invite-accept.dto';
import { UserSearchService } from '../users/user-search.service';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userSearchService: UserSearchService,
  ) {}

  async getInvitesForUsers(userIdsCsv: string) {
    const userIds = userIdsCsv
      .split(',')
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    if (userIds.length === 0) return [];

    const invites = await this.prismaService.invite.findMany({
      where: {
        invitedUserId: { in: userIds },
      },
      select: {
        invitedUserId: true,
        organizationId: true,
        status: true,
        teamId: true,
        createdAt: true,
      },
    });

    return invites;
  }

  async createInvite(requesterId: number, createInviteDto: CreateInviteDto) {
    const {
      email,
      orgRole,
      teamRole,
      status = InviteStatus.PENDING, // Default to PENDING status if not provided
      invitedUserId,
      organizationId,
      teamId,
    } = createInviteDto;

    // ✅ Step 1: Ensure the requester is authorized (ADMIN or OWNER in the organization)
    const requesterOrg = await this.prismaService.userOrganization.findFirst({
      where: {
        userId: requesterId,
        organizationId,
        role: { in: [Role.ADMIN, Role.OWNER] },
      },
    });

    if (!requesterOrg) {
      throw new ForbiddenException(
        'Not authorized to invite in this organization',
      );
    }

    // ✅ Step 2: If it's a team invite, validate that the team belongs to the organization
    // and the invitee is already a member of that organization
    if (teamId && teamRole) {
      const team = await this.prismaService.team.findUnique({
        where: { id: teamId },
      });

      // Defensive check to prevent inviting to a team outside the organization
      if (!team || team.organizationId !== organizationId) {
        throw new ForbiddenException(
          'Team does not belong to this organization',
        );
      }

      // Enforce: Invitee must already be part of the org to receive a team invite
      const invitedUserOrg =
        await this.prismaService.userOrganization.findFirst({
          where: {
            userId: invitedUserId,
            organizationId,
          },
        });

      if (!invitedUserOrg) {
        throw new ForbiddenException(
          'User must be part of the org to be invited to a team',
        );
      }
    }

    // ✅ Step 3: Prevent duplicate PENDING invites to the same org or team
    const existingInvite = await this.prismaService.invite.findFirst({
      where: {
        email,
        organizationId,
        teamId: teamId ?? null, // Null explicitly matches org-level scope if no team
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      throw new ForbiddenException(
        'A pending invite already exists for this user in this scope',
      );
    }

    // ✅ Step 4: Create the invite
    // 🔍 Fetch names for denormalization
    const org = await this.prismaService.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    if (!org) throw new ForbiddenException('Organization not found');

    let teamName: string | undefined = undefined;
    if (teamId) {
      const team = await this.prismaService.team.findUnique({
        where: { id: teamId },
        select: { name: true },
      });
      if (!team) throw new ForbiddenException('Team not found');
      teamName = team.name;
    }
    // This supports both org-level and team-level invites based on presence of teamId/teamRole
    return this.prismaService.invite.create({
      data: {
        email,
        orgRole,
        teamRole,
        status,
        invitedUserId,
        organizationId,
        organizationName: org.name,
        teamId,
        teamName, // can be undefined
      },
    });
  }

  //Update DTO to include inviteID of the invite you want to accept
  async acceptInvite(userId: number, dto: AcceptInviteDto) {
    const { email, inviteId } = dto;

    // Step 1: Look for a pending invite for this email
    const invite = await this.prismaService.invite.findFirst({
      where: {
        email,
        id: inviteId,
        status: InviteStatus.PENDING,
      },
    });

    if (!invite) {
      throw new NotFoundException('No pending invite found for this email');
    }

    // Step 2: Check if user is already part of the org (prevent duplicate join)
    const existingOrg = await this.prismaService.userOrganization.findFirst({
      where: {
        userId,
        organizationId: invite.organizationId,
      },
    });

    if (!existingOrg) {
      // Not part of org yet → add to organization
      await this.prismaService.userOrganization.create({
        data: {
          userId,
          organizationId: invite.organizationId,
          role: invite.orgRole,
        },
      });
    }

    // Step 3: If it's a team invite → check membership
    if (invite.teamId && invite.teamRole) {
      const existingTeam = await this.prismaService.teamMember.findFirst({
        where: {
          userId,
          teamId: invite.teamId,
        },
      });

      if (!existingTeam) {
        // Not part of team yet → add to team
        await this.prismaService.teamMember.create({
          data: {
            userId,
            teamId: invite.teamId,
            role: invite.teamRole,
          },
        });
      }
    }

    // Step 4: Mark invite as accepted
    await this.prismaService.invite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
        invitedUserId: userId,
      },
    });

    // ✅ Step 5: Re-index the user in Elasticsearch
    await this.userSearchService.indexUser(userId);

    return { message: 'Invite accepted successfully' };
  }
}
