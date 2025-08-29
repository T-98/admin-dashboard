import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class GetOrgsByUserDto {
  @IsInt()
  @Type(() => Number)
  userId: number;
}
