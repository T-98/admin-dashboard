import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getOrgsByUser(userId: number): Promise<
    {
      organizationId: number;
      role: Role;
      organization: {
        name: string;
      };
    }[]
  > {
    return this.prismaService.userOrganization.findMany({
      where: { userId: userId },
      select: {
        organizationId: true,
        role: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    });
  }
}
