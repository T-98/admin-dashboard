import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UserSearchService } from './user-search.service';
import { CustomElasticsearchModule } from '../elastic-search/elastic-search.module';

@Module({
  imports: [PrismaModule, CustomElasticsearchModule],
  controllers: [UsersController],
  providers: [UsersService, UserSearchService],
  exports: [UserSearchService],
})
export class UsersModule {}
