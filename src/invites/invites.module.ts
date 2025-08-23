import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { UserSearchService } from '../users/user-search.service';
import { CustomElasticsearchModule } from '../elastic-search/elastic-search.module';

@Module({
  imports: [CustomElasticsearchModule],
  controllers: [InvitesController],
  providers: [InvitesService, PrismaService, UserSearchService],
})
export class InvitesModule {}
