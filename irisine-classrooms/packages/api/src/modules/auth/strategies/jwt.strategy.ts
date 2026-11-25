import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { isItAdminRoute } from '../it-admin-scope';
import { isPlatformOwner } from '../platform-owner';

/**
 * Every request re-checks the account in the database, so a deactivated user, a changed role
 * or a suspended school takes effect immediately instead of waiting for the token to expire.
 * The role used by the app always comes from the database, never from the token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true, schoolId: true, school: { select: { status: true } } },
    });
    if (!user || !user.isActive || user.school.status !== 'ACTIVE') throw new UnauthorizedException();
    if (user.role === 'IT_ADMIN' && !isItAdminRoute(req.route?.path ?? req.path ?? '')) {
      throw new ForbiddenException('The IT Admin account cannot use this module');
    }
    const isOwner = isPlatformOwner(user, this.config.get<string>('PLATFORM_OWNER_EMAILS'));
    return { sub: user.id, email: user.email, role: user.role, schoolId: user.schoolId, isOwner };
  }
}
