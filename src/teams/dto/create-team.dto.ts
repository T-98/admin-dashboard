import { IsInt, IsString } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsInt()
  organizationId: number;
}
