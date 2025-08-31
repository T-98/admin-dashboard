import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserAuthDto } from './dto/user-auth-dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() userAuthDto: UserAuthDto): Promise<{
    userId: number;
    name: string;
    email: string;
    password: string;
  }> {
    return await this.authService.login(userAuthDto);
  }
}
