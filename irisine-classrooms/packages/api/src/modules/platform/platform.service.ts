import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeaturesService } from './features.service';
import { FACULTY_ROLES } from './limits.service';

/** Statuses the owner can set directly. 'DELETED' is only reached through deleteSchool. */
const SCHOOL_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

/** The platform owner's (IT Admin's) control over all schools. */
@Injectable()
export class PlatformService {
  constructor(
    private prisma: PrismaService,
    private features: FeaturesService,
  ) {}

  async stats() {
    const [schools, active, suspended, users, students] = await Promise.all([
      this.prisma.school.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.school.count({ where: { status: 'ACTIVE' } }),
      this.prisma.school.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count(),
      this.prisma.student.count(),
    ]);
    return { schools, activeSchools: active, suspendedSchools: suspended, users, students };
  }

  listSchools(status?: string) {
    return this.prisma.school.findMany({
      where: { status: status || { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, code: true, email: true, city: true, state: true, country: true, status: true, createdAt: true,
        maxStudents: true, maxFaculty: true,
        _count: { select: { users: true, features: true } },
      },
    });
  }

  async getSchool(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: { _count: { select: { users: true, classes: true } } },
    });
    if (!school) throw new NotFoundException('School not found');
    return { ...school, features: await this.features.listForSchool(id) };
  }

  /** Read only: what a school has entered itself. No password or token fields are selected. */
  async people(id: string) {
    if (!(await this.prisma.school.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('School not found');
    }
    const [students, faculty] = await Promise.all([
      this.prisma.student.findMany({
        where: { isActive: true, user: { schoolId: id } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, admissionNo: true, createdAt: true,
          user: { select: { firstName: true, lastName: true, email: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      }),
      this.prisma.user.findMany({
        where: { schoolId: id, role: { in: FACULTY_ROLES } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, createdAt: true },
      }),
    ]);
    return { students, faculty };
  }

  async setSchoolStatus(id: string, status: string, ownSchoolId: string) {
    if (!SCHOOL_STATUSES.includes(status)) throw new BadRequestException('Invalid status');
    return this.changeStatus(id, status, ownSchoolId);
  }

  /**
   * "Delete" hides the school and locks everyone in it out. Its records are kept, so a wrong
   * click can be undone by activating the school again.
   */
  deleteSchool(id: string, ownSchoolId: string) {
    return this.changeStatus(id, 'DELETED', ownSchoolId);
  }

  private async changeStatus(id: string, status: string, ownSchoolId: string) {
    const school = await this.prisma.school.findUnique({ where: { id }, select: { id: true } });
    if (!school) throw new NotFoundException('School not found');
    if (id === ownSchoolId && status !== 'ACTIVE') {
      throw new ForbiddenException('Your own account belongs to this school, so it cannot be suspended or deleted');
    }
    // the school's users are simply refused at the door (JwtStrategy checks status)
    await this.prisma.school.update({ where: { id }, data: { status } });
    this.features.invalidate(id);
    return { id, status };
  }
}
