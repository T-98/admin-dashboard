import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './users/auth/auth.module';
import { UsersService } from './users/users.service';
import { CustomElasticsearchModule } from './elastic-search/elastic-search.module';
import { TeamsModule } from './teams/teams.module';
import * as Joi from 'joi';
import { TeamsService } from './teams/teams.service';
import { InvitesModule } from './invites/invites.module';
import { OrganizationsModule } from './organizations/organizations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
      }),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    CustomElasticsearchModule,
    TeamsModule,
    InvitesModule,
    OrganizationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, UsersService, TeamsService],
})
export class AppModule {}
