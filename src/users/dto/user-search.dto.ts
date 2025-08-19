import {
  IsOptional,
  IsIn,
  IsString,
  IsNumberString,
  IsEnum,
} from 'class-validator';
import { InviteStatus } from '@prisma/client';

export class UserSearchDto {
  @IsOptional()
  @IsString()
  q?: string; // search query

  @IsOptional()
  @IsIn(['createdAt', 'name'])
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
}
