import { IsEmail, IsInt } from 'class-validator';

export class AcceptInviteDto {
  @IsEmail()
  email: string;

  @IsInt()
  inviteId: number;
}
