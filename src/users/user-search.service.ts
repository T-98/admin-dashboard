// user-search.service.ts
import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import type { estypes } from '@elastic/elasticsearch';
import { InviteStatus } from '@prisma/client';
import { UserSearchDto } from './dto/user-search.dto';
import { PrismaService } from '../../prisma/prisma.service';

type UserDoc = {
  id: number;
  name: string | null;
  email: string;
  createdAt: string; // ISO string stored in ES
};

type MinimalInvite = {
  organizationId: number;
  organizationName: string | null;
  teamId: number | null;
  teamName: string | null;
  status: InviteStatus;
  invitedUserId: number | null;
};

@Injectable()
export class UserSearchService {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly prismaService: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      await this.elasticsearchService.ping();
      console.log('✅ ES connected');
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      console.error('❌ Elasticsearch not reachable:', e.message);
    }
  }

  async indexUser(userId: number) {
    // Fetch base user data
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    // Fetch all org memberships (id + name)
    const userOrgs = await this.prismaService.userOrganization.findMany({
      where: { userId },
      select: {
        organizationId: true,
        organization: { select: { name: true } },
      },
    });

    const organizationIds = userOrgs.map((o) => o.organizationId);
    const organizationNames = userOrgs.map((o) => o.organization.name);

    // Fetch all team memberships (id + name)
    const userTeams = await this.prismaService.teamMember.findMany({
      where: { userId },
      select: {
        teamId: true,
        team: { select: { name: true } },
      },
    });

    const teamIds = userTeams.map((t) => t.teamId);
    const teamNames = userTeams.map((t) => t.team.name);

    // Index into Elasticsearch
    await this.elasticsearchService.index({
      index: 'users',
      id: user.id.toString(),
      document: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        organizationIds,
        organizationNames,
        teamIds,
        teamNames,
      },
    });
  }

  async removeUser(userId: number) {
    await this.elasticsearchService.delete({
      index: 'users',
      id: userId.toString(),
    });
  }

  async searchUsers(dto: UserSearchDto) {
    const {
      q,
      sortBy = 'createdAt',
      order = 'desc',
      take = '10',
      inviteStatus,
      nextCursor: encodedCursor,
      organizationName,
      teamName,
    } = dto;

    const size = typeof take === 'string' ? parseInt(take, 10) : take;
    const must: estypes.QueryDslQueryContainer[] = [];

    let inviteUserIds: number[] = [];
    if (inviteStatus) {
      const invites = await this.prismaService.invite.findMany({
        where: { status: inviteStatus, invitedUserId: { not: null } },
        select: { invitedUserId: true },
      });
      inviteUserIds = invites
        .map((i) => i.invitedUserId)
        .filter((id): id is number => id !== null);
      if (inviteUserIds.length === 0) {
        return { users: [], nextCursor: null, hasMore: false, total: 0 };
      }
      must.push({ terms: { id: inviteUserIds } });
    }

    if (organizationName) {
      must.push({ terms: { 'organizationNames.keyword': [organizationName] } });
    }

    if (teamName) {
      must.push({ terms: { 'teamNames.keyword': [teamName] } });
    }

    let query: estypes.QueryDslQueryContainer;
    let sort: estypes.SortCombinations[];

    if (q && sortBy === 'mostRelevant') {
      query = {
        bool: {
          must: [
            ...must,
            {
              multi_match: {
                query: q.toLowerCase(),
                type: 'phrase_prefix',
                fields: ['name', 'email'],
              },
            },
          ],
        },
      };
      sort = [{ _score: { order: 'desc' } }, { id: { order: 'desc' } }];
    } else {
      if (q) {
        must.push({
          bool: {
            should: [
              {
                prefix: {
                  name: { value: q.toLowerCase(), case_insensitive: true },
                },
              },
              {
                prefix: {
                  email: { value: q.toLowerCase(), case_insensitive: true },
                },
              },
            ],
          },
        });
      }
      const sortField = ['name', 'email'].includes(sortBy)
        ? `${sortBy}.keyword`
        : sortBy;
      sort = [{ [sortField]: order }, { id: order }];
      query = must.length > 0 ? { bool: { must } } : { match_all: {} };
    }

    const params: estypes.SearchRequest = {
      index: 'users',
      size,
      sort,
      query,
      track_total_hits: true,
    };

    if (encodedCursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(encodedCursor, 'base64').toString(),
        );
        if (Array.isArray(decoded)) {
          (
            params as estypes.SearchRequest & {
              search_after?: Array<string | number>;
            }
          ).search_after = decoded;
        }
      } catch (err) {
        console.warn('Invalid cursor:', err);
      }
    }

    const result = await this.elasticsearchService.search<UserDoc>(params);
    const hits = result.hits.hits;
    const total =
      typeof result.hits.total === 'object' ? result.hits.total.value : 0;
    const users: UserDoc[] = hits
      .map((h) => h._source)
      .filter((s): s is UserDoc => Boolean(s));
    const userIds = users.map((u) => u.id);

    const invites = await this.prismaService.invite.findMany({
      where: { invitedUserId: { in: userIds } },
      select: {
        invitedUserId: true,
        status: true,
        organizationId: true,
        organizationName: true,
        teamId: true,
        teamName: true,
      },
    });

    const inviteMap: Record<number, MinimalInvite[]> = {};
    for (const i of invites) {
      if (!inviteMap[i.invitedUserId!]) inviteMap[i.invitedUserId!] = [];
      inviteMap[i.invitedUserId!].push(i);
    }

    const orgMemberships = await this.prismaService.userOrganization.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        role: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });

    const teamMemberships = await this.prismaService.teamMember.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
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

    const orgMap: Record<number, any[]> = {};
    const teamMap: Record<number, any[]> = {};

    for (const userId of userIds) {
      const orgs: any[] = [];
      const teams: any[] = [];

      const orgIdsSeen = new Set<number>();
      const teamIdsSeen = new Set<number>();

      for (const m of orgMemberships.filter((m) => m.userId === userId)) {
        orgs.push({
          orgId: m.organizationId,
          name: m.organization.name,
          role: m.role,
          organizationInviteStatus: inviteMap[userId]?.find(
            (i) => i.organizationId === m.organizationId && !i.teamId,
          )?.status,
        });
        orgIdsSeen.add(m.organizationId);
      }

      const extraOrgInvites = (inviteMap[userId] ?? []).filter(
        (i) =>
          i.organizationId && !i.teamId && !orgIdsSeen.has(i.organizationId),
      );

      for (const i of extraOrgInvites) {
        orgs.push({
          orgId: i.organizationId,
          name: i.organizationName ?? '',
          role: undefined,
          organizationInviteStatus: i.status,
        });
      }

      for (const m of teamMemberships.filter((m) => m.userId === userId)) {
        teams.push({
          teamId: m.teamId,
          name: m.team.name,
          role: m.role,
          orgId: m.team.organizationId,
          teamInviteStatus: inviteMap[userId]?.find(
            (i) => i.teamId === m.teamId,
          )?.status,
        });
        teamIdsSeen.add(m.teamId);
      }

      const extraTeamInvites = (inviteMap[userId] ?? []).filter(
        (i) => i.teamId && !teamIdsSeen.has(i.teamId),
      );

      for (const i of extraTeamInvites) {
        teams.push({
          teamId: i.teamId!,
          name: i.teamName ?? '',
          role: undefined,
          orgId: i.organizationId,
          teamInviteStatus: i.status,
        });
      }

      orgMap[userId] = orgs;
      teamMap[userId] = teams;
    }

    const enrichedUsers = users.map((u) => ({
      ...u,
      orgs: orgMap[u.id] ?? [],
      teams: teamMap[u.id] ?? [],
    }));

    const lastHit = hits[hits.length - 1];
    const nextCursor =
      hits.length > 0 &&
      lastHit?.sort?.length &&
      users.length + (encodedCursor ? size : 0) < total
        ? Buffer.from(JSON.stringify(lastHit.sort)).toString('base64')
        : null;

    return {
      users: enrichedUsers,
      nextCursor,
      hasMore: !!nextCursor,
      total,
    };
  }
}
