// user-search.service.ts
import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import type { estypes } from '@elastic/elasticsearch';
import { User } from '@prisma/client';
import { UserSearchDto } from './dto/user-search.dto';
import { PrismaService } from '../../prisma/prisma.service';

type UserDoc = {
  id: number;
  name: string | null;
  email: string;
  createdAt: string; // ISO string stored in ES
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

  async indexUser(user: User) {
    await this.elasticsearchService.index({
      index: 'users',
      id: user.id.toString(),
      document: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
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
      nextCursor,
    } = dto;

    const size = typeof take === 'string' ? parseInt(take, 10) : take;

    const must: estypes.QueryDslQueryContainer[] = [];

    // 🔎 Name/email prefix search (case-insensitive)
    if (q) {
      must.push({
        bool: {
          should: [
            {
              prefix: {
                name: {
                  value: q.toLowerCase(),
                  case_insensitive: true,
                },
              },
            },
            {
              prefix: {
                email: {
                  value: q.toLowerCase(),
                  case_insensitive: true,
                },
              },
            },
          ],
        },
      });
    }

    // 🚧 Invite status filter via DB
    if (inviteStatus) {
      const invites = await this.prismaService.invite.findMany({
        where: {
          status: inviteStatus,
          invitedUserId: { not: null },
        },
        select: { invitedUserId: true },
      });

      const invitedUserIds = invites
        .map((i) => i.invitedUserId)
        .filter((id): id is number => id !== null);

      if (invitedUserIds.length === 0) {
        return { users: [], nextCursor: null, hasMore: false, total: 0 };
      }

      must.push({
        terms: { id: invitedUserIds },
      });
    }

    // 🧭 Sorting logic
    const sortField =
      sortBy === 'name' || sortBy === 'email' ? `${sortBy}.keyword` : sortBy;

    const sort: estypes.SortCombinations[] = [
      { [sortField]: order },
      { id: order },
    ];

    const params: estypes.SearchRequest = {
      index: 'users',
      size,
      sort,
      query: must.length > 0 ? { bool: { must } } : { match_all: {} },
      track_total_hits: true,
    };

    // 🧭 Cursor decoding
    if (nextCursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(nextCursor, 'base64').toString(),
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
    const hasMore = hits.length === size;

    const users: UserDoc[] = hits
      .map((h) => h._source)
      .filter((s): s is UserDoc => Boolean(s));

    const lastHit = hits[hits.length - 1];

    return {
      users,
      nextCursor:
        hasMore && lastHit.sort?.length
          ? Buffer.from(JSON.stringify(lastHit.sort)).toString('base64')
          : null,
      hasMore,
      total,
    };
  }
}
