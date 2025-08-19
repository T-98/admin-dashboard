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
  @IsIn(['createdAt', 'name', 'email'])
  sortBy?: 'createdAt' | 'name' | 'email';

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
  @Type(() => Number)
  @IsInt()
  organizationId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamId?: number;
}
