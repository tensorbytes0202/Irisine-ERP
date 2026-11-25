import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LimitsService } from './limits.service';
import { FEATURE_CATALOG, FEATURE_KEYS } from './feature-catalog';

export interface FeatureGrant {
  key: string;
  enabled: boolean;
  adminManageable?: boolean;
  config?: unknown;
}

const CACHE_MS = 10_000;

/**
 * Database-driven feature entitlement. A school can use a feature only if
 *   school is ACTIVE  AND  feature is globally active  AND  platform granted it (enabled)
 *   AND (if the platform let the school admin manage it) the admin switch is on.
 * No row for a school+feature means no access. Nothing about which school gets what is hardcoded.
 */
@Injectable()
export class FeaturesService implements OnModuleInit {
  private readonly logger = new Logger(FeaturesService.name);
  private cache = new Map<string, { at: number; keys: Set<string> }>();

  constructor(
    private prisma: PrismaService,
    private limits: LimitsService,
  ) {}

  /** Keep the feature master table in sync with the catalogue (never touches school grants). */
  async onModuleInit() {
    try {
      for (const f of FEATURE_CATALOG) {
        await this.prisma.feature.upsert({
          where: { key: f.key },
          create: { key: f.key, name: f.name, category: f.category, isCore: !!f.isCore },
          update: { name: f.name, category: f.category, isCore: !!f.isCore },
        });
      }
    } catch (err) {
      this.logger.warn(`Could not sync the feature catalogue (is the database migrated?): ${(err as Error).message}`);
    }
  }

  invalidate(schoolId?: string) {
    if (schoolId) this.cache.delete(schoolId);
    else this.cache.clear();
  }

  /** Feature keys a school can use right now. */
  async effectiveKeys(schoolId: string): Promise<Set<string>> {
    const hit = this.cache.get(schoolId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.keys;

    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { status: true } });
    const keys = new Set<string>();
    if (school?.status === 'ACTIVE') {
      const rows = await this.prisma.schoolFeature.findMany({
        where: { schoolId, enabled: true, feature: { isActive: true } },
        select: { featureKey: true, adminManageable: true, adminEnabled: true },
      });
      for (const r of rows) {
        if (!r.adminManageable || r.adminEnabled) keys.add(r.featureKey);
      }
    }
    this.cache.set(schoolId, { at: Date.now(), keys });
    return keys;
  }

  async hasAccess(schoolId: string, featureKey: string) {
    return (await this.effectiveKeys(schoolId)).has(featureKey);
  }

  // ── Platform owner ────────────────────────────────────────────────

  listCatalog() {
    return this.prisma.feature.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  async listForSchool(schoolId: string) {
    return this.prisma.schoolFeature.findMany({
      where: { schoolId },
      include: { feature: { select: { name: true, category: true, isActive: true } } },
      orderBy: { featureKey: 'asc' },
    });
  }

  private validateKeys(keys: string[]) {
    const bad = keys.filter((k) => !FEATURE_KEYS.includes(k) || k === 'CORE');
    if (bad.length) throw new BadRequestException(`Unknown feature(s): ${bad.join(', ')}`);
  }

  /** Create or update grants for a school. Features not mentioned are left as they are. */
  async setSchoolFeatures(schoolId: string, grants: FeatureGrant[], grantedBy: string) {
    this.validateKeys(grants.map((g) => g.key));
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) throw new NotFoundException('School not found');

    await this.prisma.$transaction(
      grants.map((g) =>
        this.prisma.schoolFeature.upsert({
          where: { schoolId_featureKey: { schoolId, featureKey: g.key } },
          create: {
            schoolId,
            featureKey: g.key,
            enabled: g.enabled,
            adminManageable: g.adminManageable ?? false,
            config: (g.config ?? undefined) as any,
            grantedBy,
          },
          update: {
            enabled: g.enabled,
            ...(g.adminManageable !== undefined && { adminManageable: g.adminManageable }),
            ...(g.config !== undefined && { config: g.config as any }),
            grantedBy,
          },
        }),
      ),
    );
    this.invalidate(schoolId);
    return this.listForSchool(schoolId);
  }

  // ── School side ──────────────────────────────────────────────────

  /** What the school's own users see (for navigation). Core is always on. */
  async myFeatures(schoolId: string) {
    const keys = await this.effectiveKeys(schoolId);
    return { features: ['CORE', ...keys], limits: await this.limits.usage(schoolId) };
  }

  /** Every module the platform granted to this school, including ones its admin switched off. */
  async grantedModules(schoolId: string) {
    const rows = await this.listForSchool(schoolId);
    return rows
      .filter((r) => r.enabled && r.feature.isActive)
      .map((r) => ({
        key: r.featureKey,
        name: r.feature.name,
        category: r.feature.category,
        adminManageable: r.adminManageable,
        adminEnabled: !r.adminManageable || r.adminEnabled,
      }));
  }

  /**
   * A school admin switches a feature on/off. Allowed only for features the platform granted
   * AND marked as admin-manageable. Admins can never grant anything new.
   */
  async adminToggle(schoolId: string, featureKey: string, enabled: boolean) {
    const row = await this.prisma.schoolFeature.findUnique({
      where: { schoolId_featureKey: { schoolId, featureKey } },
    });
    if (!row || !row.enabled) throw new ForbiddenException('This feature has not been granted to your school');
    if (!row.adminManageable) throw new ForbiddenException('The platform owner has not allowed you to manage this feature');
    await this.prisma.schoolFeature.update({ where: { id: row.id }, data: { adminEnabled: enabled } });
    this.invalidate(schoolId);
    return { key: featureKey, enabled };
  }
}
