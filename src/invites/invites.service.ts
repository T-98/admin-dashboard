import {
  ForbiddenException,
  NotFoundException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { Role, InviteStatus } from '@prisma/client';
import { AcceptInviteDto } from './dto/invite-accept.dto';

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

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
    const requesterOrg = await this.prisma.userOrganization.findFirst({
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
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
      });

      // Defensive check to prevent inviting to a team outside the organization
      if (!team || team.organizationId !== organizationId) {
        throw new ForbiddenException(
          'Team does not belong to this organization',
        );
      }

      // Enforce: Invitee must already be part of the org to receive a team invite
      const invitedUserOrg = await this.prisma.userOrganization.findFirst({
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
    const existingInvite = await this.prisma.invite.findFirst({
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
    // This supports both org-level and team-level invites based on presence of teamId/teamRole
    return this.prisma.invite.create({
      data: {
        email,
        orgRole,
        teamRole,
        status,
        invitedUserId,
        organizationId,
        teamId,
      },
    });
  }

  async acceptInvite(userId: number, dto: AcceptInviteDto) {
    const { email } = dto;

    // Step 1: Look for a pending invite for this email
    const invite = await this.prisma.invite.findFirst({
      where: {
        email,
        status: InviteStatus.PENDING,
      },
    });

    if (!invite) {
      throw new NotFoundException('No pending invite found for this email');
    }

    // Step 2: Check if user is already part of the org (prevent duplicate join)
    const existingOrg = await this.prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId: invite.organizationId,
      },
    });

    if (!existingOrg) {
      // Not part of org yet → add to organization
      await this.prisma.userOrganization.create({
        data: {
          userId,
          organizationId: invite.organizationId,
          role: invite.orgRole,
        },
      });
    }

    // Step 3: If it's a team invite → check membership
    if (invite.teamId && invite.teamRole) {
      const existingTeam = await this.prisma.teamMember.findFirst({
        where: {
          userId,
          teamId: invite.teamId,
        },
      });

      if (!existingTeam) {
        // Not part of team yet → add to team
        await this.prisma.teamMember.create({
          data: {
            userId,
            teamId: invite.teamId,
            role: invite.teamRole,
          },
        });
      }
    }

    // Step 4: Mark invite as accepted
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
        invitedUserId: userId,
      },
    });

    return { message: 'Invite accepted successfully' };
  }
}
