import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PORTAL_ROLES } from '../auth/portals';

/** Roles that count against a school's faculty limit. */
export const FACULTY_ROLES = PORTAL_ROLES.FACULTY;

/**
 * Per-school caps on students and faculty, set by the platform owner.
 * `null` means unlimited (every school that existed before limits keeps working).
 */
@Injectable()
export class LimitsService {
  constructor(private prisma: PrismaService) {}

  async usage(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { maxStudents: true, maxFaculty: true },
    });
    if (!school) throw new NotFoundException('School not found');
    const [students, faculty] = await Promise.all([
      this.prisma.student.count({ where: { isActive: true, user: { schoolId } } }),
      this.prisma.user.count({ where: { schoolId, isActive: true, role: { in: FACULTY_ROLES } } }),
    ]);
    return { maxStudents: school.maxStudents, maxFaculty: school.maxFaculty, students, faculty };
  }

  /** Throws 403 LIMIT_REACHED if adding `count` more students would pass the school's cap. */
  async assertCanAddStudents(schoolId: string, count = 1) {
    const u = await this.usage(schoolId);
    if (u.maxStudents !== null && u.students + count > u.maxStudents) {
      throw new ForbiddenException({
        code: 'LIMIT_REACHED',
        limit: 'students',
        message: `Student limit reached (${u.students} of ${u.maxStudents}). Ask the platform owner to raise it.`,
      });
    }
  }

  async assertCanAddFaculty(schoolId: string, count = 1) {
    const u = await this.usage(schoolId);
    if (u.maxFaculty !== null && u.faculty + count > u.maxFaculty) {
      throw new ForbiddenException({
        code: 'LIMIT_REACHED',
        limit: 'faculty',
        message: `Faculty limit reached (${u.faculty} of ${u.maxFaculty}). Ask the platform owner to raise it.`,
      });
    }
  }

  async setLimits(schoolId: string, limits: { maxStudents?: number | null; maxFaculty?: number | null }) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) throw new NotFoundException('School not found');
    await this.prisma.school.update({
      where: { id: schoolId },
      data: {
        ...(limits.maxStudents !== undefined && { maxStudents: limits.maxStudents }),
        ...(limits.maxFaculty !== undefined && { maxFaculty: limits.maxFaculty }),
      },
    });
    return this.usage(schoolId);
  }
}
