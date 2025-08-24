import { IsEmail, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Role, TeamRole, InviteStatus } from '@prisma/client';

export class CreateInviteDto {
  @IsEmail()
  email: string;

  @IsEnum(Role)
  orgRole: Role;

  @IsOptional()
  @IsEnum(TeamRole)
  teamRole?: TeamRole;

  @IsOptional()
  @IsEnum(InviteStatus)
  status?: InviteStatus;

  @IsOptional()
  @IsInt()
  invitedUserId?: number;

  @IsInt()
  organizationId: number;

  @IsString()
  organizationName: string;

  @IsOptional()
  @IsInt()
  teamId?: number;

  @IsOptional()
  @IsString()
  teamName?: string;
}
