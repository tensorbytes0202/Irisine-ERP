import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { InvitesService } from './invites.service';
import { FeaturesService, FeatureGrant } from './features.service';
import { FEATURE_KEYS } from './feature-catalog';

export interface CreateSchoolInput {
  schoolName: string;
  adminName: string;
  adminEmail: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  maxStudents?: number | null;
  maxFaculty?: number | null;
  features: FeatureGrant[];
}

/**
 * The platform owner (the "IT Admin" portal) creates a school here: the school, its limits,
 * the modules it may use, and its first Super Admin, who gets a one-time link to set a password.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private invites: InvitesService,
    private features: FeaturesService,
  ) {}

  async createSchool(input: CreateSchoolInput, createdBy: string) {
    const email = input.adminEmail.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('An account with this email already exists');
    }
    if (!input.features?.length) throw new BadRequestException('Choose at least one feature for this school');
    const bad = input.features.map((g) => g.key).filter((k) => !FEATURE_KEYS.includes(k) || k === 'CORE');
    if (bad.length) throw new BadRequestException(`Unknown feature(s): ${bad.join(', ')}`);

    const name = input.schoolName.trim();
    const slug = name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'SCHOOL';
    const code = `${slug}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const [firstName, ...rest] = input.adminName.trim().split(/\s+/);
    const unusable = await bcrypt.hash(InvitesService.unusablePasswordSeed(), 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name, code, email,
          phone: input.phone?.trim() || null,
          address: input.address?.trim() || null,
          city: input.city?.trim() || null,
          state: input.state?.trim() || null,
          country: input.country?.trim() || null,
          website: input.website?.trim() || null,
          maxStudents: input.maxStudents ?? null,
          maxFaculty: input.maxFaculty ?? null,
          status: 'ACTIVE',
        },
      });
      await tx.schoolFeature.createMany({
        data: input.features.map((g) => ({
          schoolId: school.id,
          featureKey: g.key,
          enabled: g.enabled ?? true,
          adminManageable: g.adminManageable ?? false,
          config: (g.config ?? undefined) as any,
          grantedBy: createdBy,
        })),
      });
      const user = await tx.user.create({
        data: {
          email, passwordHash: unusable, firstName, lastName: rest.join(' ') || '-',
          role: 'SUPER_ADMIN', schoolId: school.id, emailVerified: true,
        },
      });
      const token = await this.invites.issue(user.id, tx as any);
      return { schoolId: school.id, token };
    });

    this.features.invalidate(result.schoolId);
    const inviteEmailSent = await this.invites.send(email, name, result.token, 'Your school is ready: set your password');
    // The platform owner also gets the link, so a school can be handed over even if email is not set up.
    return { schoolId: result.schoolId, inviteEmailSent, inviteLink: this.invites.link(result.token) };
  }

  /** New invite for a school's first admin who has not set a password yet. */
  async resendInvite(schoolId: string) {
    const admin = await this.prisma.user.findFirst({ where: { schoolId, role: 'SUPER_ADMIN' }, orderBy: { createdAt: 'asc' } });
    if (!admin) throw new NotFoundException('School admin not found');
    const token = await this.invites.issue(admin.id);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
    const inviteEmailSent = await this.invites.send(admin.email, school?.name ?? 'your school', token);
    return { inviteEmailSent, inviteLink: this.invites.link(token) };
  }
}
