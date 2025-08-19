import { IsEmail } from 'class-validator';

export class AcceptInviteDto {
  @IsEmail()
  email: string;
}
