import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

/**
 * Reusable email + password authentication function
 * @param prisma PrismaService instance
 * @param email User email
 * @param password Plain text password
 * @returns The user object if credentials are valid
 * @throws UnauthorizedException if invalid
 */
export async function authenticateUser(
  prisma: PrismaService,
  email: string,
  password: string,
) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new UnauthorizedException('Invalid credentials');
  }

  return user;
}
