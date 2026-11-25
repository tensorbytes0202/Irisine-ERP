import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Every request re-checks the account in the database, so a deactivated user, a changed role
 * or a suspended school takes effect immediately instead of waiting for the token to expire.
 * The role used by the app always comes from the database, never from the token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (payload.role === 'PLATFORM_SUPER_ADMIN') {
      const admin = await this.prisma.platformAdmin.findUnique({ where: { id: payload.sub } });
      if (!admin || !admin.isActive) throw new UnauthorizedException();
      return { sub: admin.id, email: admin.email, role: 'PLATFORM_SUPER_ADMIN', schoolId: null };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true, schoolId: true, school: { select: { status: true } } },
    });
    if (!user || !user.isActive || user.school.status !== 'ACTIVE') throw new UnauthorizedException();
    return { sub: user.id, email: user.email, role: user.role, schoolId: user.schoolId };
  }
}
