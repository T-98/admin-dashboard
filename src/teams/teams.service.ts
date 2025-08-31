import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamRole } from '@prisma/client';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async createTeam(userId: number, dto: CreateTeamDto) {
    // Fetch all orgs where user is OWNER or ADMIN
    const userOrg = await this.prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId: dto.organizationId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!userOrg) {
      throw new ForbiddenException(
        'You must be an OWNER or ADMIN of this organization to create a team.',
      );
    }

    // Create the team under that org
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        organizationId: dto.organizationId,
      },
    });

    return team;
  }

  async getTeamsByUser(userId: number): Promise<
    {
      teamId: number;
      role: TeamRole;
      team: {
        name: string;
      };
    }[]
  > {
    return this.prisma.teamMember.findMany({
      where: { userId: userId },
      select: {
        teamId: true,
        role: true,
        team: {
          select: {
            name: true,
            organizationId: true,
          },
        },
      },
    });
  }
}
