import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class GetTeamsByUserDto {
  @IsInt()
  @Type(() => Number)
  userId: number;
}
