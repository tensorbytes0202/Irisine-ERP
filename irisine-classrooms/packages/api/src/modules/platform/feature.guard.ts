import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FeaturesService } from './features.service';
import { ROUTE_TO_FEATURE } from './feature-catalog';

/**
 * Global guard: blocks the API of any module the caller's school has not been granted.
 * It reads the controller's route prefix (e.g. 'attendance') and maps it to a feature.
 * - No/invalid token: let it through; JwtAuthGuard on the controller answers 401.
 * - Prefixes that are not in the catalogue (auth, platform, ...) are not gated here.
 * Frontend hiding is only cosmetic: this is the real enforcement.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private features: FeaturesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const prefix = Reflect.getMetadata('path', context.getClass()) as string | undefined;
    const featureKey = prefix ? ROUTE_TO_FEATURE[prefix] : undefined;
    if (!featureKey || featureKey === 'CORE') return true; // core modules are never gated

    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    if (!header?.startsWith('Bearer ')) return true;

    let payload: any;
    try {
      payload = this.jwt.verify(header.slice(7), { secret: this.config.get<string>('JWT_SECRET') });
    } catch {
      return true;
    }
    if (!payload?.schoolId || payload.role === 'PLATFORM_SUPER_ADMIN') return true;

    if (!(await this.features.hasAccess(payload.schoolId, featureKey))) {
      throw new ForbiddenException({
        code: 'FEATURE_NOT_ENABLED',
        feature: featureKey,
        message: 'This module is not enabled for your school',
      });
    }
    return true;
  }
}
