import { IsEmail, IsEnum, IsInt, IsOptional } from 'class-validator';
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

  @IsOptional()
  @IsInt()
  teamId?: number;
}
