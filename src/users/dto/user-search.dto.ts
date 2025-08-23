// user-search.dto.ts
import {
  IsOptional,
  IsIn,
  IsString,
  IsNumberString,
  IsEnum,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InviteStatus } from '@prisma/client';

export class UserSearchDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['createdAt', 'name', 'email', 'mostRelevant'])
  sortBy?: 'createdAt' | 'name' | 'email' | 'mostRelevant';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsNumberString()
  take?: string;

  @IsOptional()
  @IsEnum(InviteStatus)
  inviteStatus?: InviteStatus;

  @IsOptional()
  @IsString()
  nextCursor?: string;

  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsOptional()
  @IsString()
  teamName?: string;
}
