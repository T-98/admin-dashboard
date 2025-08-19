/* eslint-disable */
// prisma/seed.ts
import { PrismaClient, Role, TeamRole, InviteStatus } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const es = new ElasticClient({ node: 'http://localhost:9200' });

async function main() {
  console.log('🚮 Deleting all DB and ES data...');

  // Clear Elasticsearch index
  try {
    await es.indices.delete({ index: 'users' });
    console.log('🧹 Deleted Elasticsearch index "users"');
  } catch (e: any) {
    if (e.meta?.statusCode !== 404) {
      console.error('❌ Error deleting ES index:', e);
      throw e;
    } else {
      console.log('ℹ️ Elasticsearch index "users" does not exist yet');
    }
  }

  // Recreate index
  await es.indices.create({
    index: 'users',
    body: {
      mappings: {
        properties: {
          id: { type: 'integer' },
          name: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          email: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          createdAt: { type: 'date' },
          organizationIds: { type: 'integer' },
          teamIds: { type: 'integer' },
        },
      },
    },
  });

  // Clear Postgres
  await prisma.invite.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.userOrganization.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('🧪 Seeding fresh data...');

  // Create organizations
  const orgs = await Promise.all(
    Array.from({ length: 5 }).map(() =>
      prisma.organization.create({
        data: { name: faker.company.name() },
      }),
    ),
  );

  // Create teams under each org
  const teams: { id: number; organizationId: number }[] = [];
  for (const org of orgs) {
    const orgTeams = await Promise.all(
      Array.from({ length: faker.number.int({ min: 2, max: 5 }) }).map(() =>
        prisma.team.create({
          data: {
            name: faker.word.words({ count: 2 }),
            organizationId: org.id,
          },
        }),
      ),
    );
    teams.push(...orgTeams);
  }

  // Create users and index into Elasticsearch
  const users: any[] = [];
  for (let i = 0; i < 100; i++) {
    const plainPassword = 'password123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const user = await prisma.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
        password: hashedPassword,
        name: faker.person.fullName(),
      },
    });

    console.log(
      `Created test user: ${user.email} | password: ${plainPassword}`,
    );

    users.push(user);

    const userOrgIds: number[] = [];
    const userTeamIds: number[] = [];

    const orgSample = faker.helpers.arrayElements(
      orgs,
      faker.number.int({ min: 1, max: 3 }),
    );

    for (const org of orgSample) {
      await prisma.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: faker.helpers.arrayElement([
            Role.OWNER,
            Role.ADMIN,
            Role.MEMBER,
          ]),
        },
      });

      userOrgIds.push(org.id);

      const orgTeams = teams.filter((t) => t.organizationId === org.id);
      const teamSample = faker.helpers.arrayElements(
        orgTeams,
        faker.number.int({ min: 1, max: 2 }),
      );

      for (const team of teamSample) {
        await prisma.teamMember.create({
          data: {
            userId: user.id,
            teamId: team.id,
            role: faker.helpers.arrayElement([TeamRole.LEAD, TeamRole.MEMBER]),
          },
        });

        userTeamIds.push(team.id);

        await prisma.invite.create({
          data: {
            email: user.email,
            orgRole: Role.MEMBER,
            teamRole: TeamRole.MEMBER,
            status: faker.helpers.arrayElement([
              InviteStatus.PENDING,
              InviteStatus.ACCEPTED,
              InviteStatus.EXPIRED,
            ]),
            invitedUserId: user.id,
            organizationId: org.id,
            teamId: team.id,
          },
        });
      }
    }

    await es.index({
      index: 'users',
      id: user.id.toString(),
      document: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        organizationIds: userOrgIds,
        teamIds: userTeamIds,
      },
    });
  }

  console.log('✅ Seed complete: Users, orgs, teams, invites, and ES indexed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
