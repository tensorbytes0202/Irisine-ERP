import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { tenantContext } from '../../prisma/tenant-context';

/** Runs after JwtAuthGuard, which sets `isOwner` from the database role and the server setting. */
@Injectable()
export class PlatformOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.switchToHttp().getRequest().user?.isOwner !== true) {
      throw new ForbiddenException('Only the platform owner can manage schools');
    }
    tenantContext.setSchool(undefined); // the owner's screens work across all schools
    return true;
  }
}
