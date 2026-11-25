import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { InvitesService } from './invites.service';
import { FeaturesService, FeatureGrant } from './features.service';
import { FEATURE_KEYS } from './feature-catalog';

@Injectable()
export class RegistrationsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private invites: InvitesService,
    private features: FeaturesService,
  ) {}

  /** Public: only stores a PENDING request. Creates no school and no account. */
  async submit(dto: {
    schoolName: string; email: string; phone: string; address: string; city: string; state: string;
    country: string; website?: string; contactPerson: string; requestedFeatures?: string[];
  }) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('An account with this email already exists');
    }
    if (await this.prisma.schoolRegistrationRequest.findFirst({ where: { email, status: 'PENDING' } })) {
      throw new ConflictException('A registration request for this email is already pending');
    }
    const requested = (dto.requestedFeatures ?? []).filter((k) => FEATURE_KEYS.includes(k) && k !== 'CORE');
    const row = await this.prisma.schoolRegistrationRequest.create({
      data: {
        schoolName: dto.schoolName.trim(),
        email,
        phone: dto.phone.trim(),
        address: dto.address.trim(),
        city: dto.city.trim(),
        state: dto.state.trim(),
        country: dto.country.trim(),
        website: dto.website?.trim() || null,
        contactPerson: dto.contactPerson.trim(),
        requestedFeatures: requested,
      },
      select: { id: true, status: true },
    });
    return { id: row.id, status: row.status, message: 'Your request was received. We will contact you after review.' };
  }

  list(status?: string) {
    return this.prisma.schoolRegistrationRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const row = await this.prisma.schoolRegistrationRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Request not found');
    return row;
  }

  /**
   * Approve: creates the school (ACTIVE), grants the chosen features, creates the first
   * SUPER_ADMIN with an unusable password and a one-time invite link. All in one transaction.
   */
  async approve(id: string, grants: FeatureGrant[], reviewer: string) {
    const req = await this.get(id);
    if (req.status !== 'PENDING') throw new BadRequestException(`Request is already ${req.status}`);
    if (!grants?.length) throw new BadRequestException('Choose at least one feature for this school');
    const bad = grants.map((g) => g.key).filter((k) => !FEATURE_KEYS.includes(k) || k === 'CORE');
    if (bad.length) throw new BadRequestException(`Unknown feature(s): ${bad.join(', ')}`);
    if (await this.prisma.user.findUnique({ where: { email: req.email } })) {
      throw new ConflictException('An account with the school email already exists');
    }

    const slug = req.schoolName.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'SCHOOL';
    const code = `${slug}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const [firstName, ...rest] = req.contactPerson.trim().split(/\s+/);
    const unusable = await bcrypt.hash(InvitesService.unusablePasswordSeed(), 10);

    const result = await this.prisma.$transaction(async (tx) => {
      // claim the request first so two reviewers cannot approve it twice
      const claimed = await tx.schoolRegistrationRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedBy: reviewer, reviewedAt: new Date() },
      });
      if (claimed.count !== 1) throw new BadRequestException('Request was already reviewed');

      const school = await tx.school.create({
        data: {
          name: req.schoolName, code, email: req.email, phone: req.phone, address: req.address,
          city: req.city, state: req.state, country: req.country, website: req.website, status: 'ACTIVE',
        },
      });
      await tx.schoolFeature.createMany({
        data: grants.map((g) => ({
          schoolId: school.id,
          featureKey: g.key,
          enabled: g.enabled ?? true,
          adminManageable: g.adminManageable ?? false,
          config: (g.config ?? undefined) as any,
          grantedBy: reviewer,
        })),
      });
      const user = await tx.user.create({
        data: {
          email: req.email, passwordHash: unusable, firstName, lastName: rest.join(' ') || '-',
          role: 'SUPER_ADMIN', schoolId: school.id, emailVerified: true,
        },
      });
      const token = await this.invites.issue(user.id, tx as any);
      await tx.schoolRegistrationRequest.update({ where: { id }, data: { schoolId: school.id } });
      return { schoolId: school.id, userId: user.id, token };
    });

    this.features.invalidate(result.schoolId);
    const emailed = await this.invites.send(req.email, req.schoolName, result.token, 'Your school is approved: set your password');
    return { schoolId: result.schoolId, inviteEmailSent: emailed };
  }

  async reject(id: string, reason: string, reviewer: string) {
    const claimed = await this.prisma.schoolRegistrationRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', rejectionReason: reason, reviewedBy: reviewer, reviewedAt: new Date() },
    });
    if (claimed.count !== 1) throw new BadRequestException('Request not found or already reviewed');
    return { id, status: 'REJECTED' };
  }

  /** New invite for a school's first admin who has not set a password yet. */
  async resendInvite(schoolId: string) {
    const admin = await this.prisma.user.findFirst({ where: { schoolId, role: 'SUPER_ADMIN' }, orderBy: { createdAt: 'asc' } });
    if (!admin) throw new NotFoundException('School admin not found');
    const token = await this.invites.issue(admin.id);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
    return { inviteEmailSent: await this.invites.send(admin.email, school?.name ?? 'your school', token) };
  }
}
