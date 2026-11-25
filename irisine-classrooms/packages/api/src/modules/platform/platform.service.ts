import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { FeaturesService } from './features.service';

const SCHOOL_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

@Injectable()
export class PlatformService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private features: FeaturesService,
  ) {}

  /** Platform owner login. Separate table, short-lived token, no refresh token. */
  async login(emailRaw: string, password: string) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email: emailRaw.trim().toLowerCase() } });
    const ok = admin?.isActive && (await bcrypt.compare(password, admin.passwordHash));
    if (!admin || !ok) throw new UnauthorizedException('Invalid credentials');
    const accessToken = this.jwt.sign(
      { sub: admin.id, email: admin.email, role: 'PLATFORM_SUPER_ADMIN' },
      { expiresIn: '1h' },
    );
    return { accessToken, user: { id: admin.id, email: admin.email, name: admin.name, role: 'PLATFORM_SUPER_ADMIN', portal: 'PLATFORM' } };
  }

  async stats() {
    const [schools, active, suspended, users, students] = await Promise.all([
      this.prisma.school.count(),
      this.prisma.school.count({ where: { status: 'ACTIVE' } }),
      this.prisma.school.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count(),
      this.prisma.student.count(),
    ]);
    return { schools, activeSchools: active, suspendedSchools: suspended, users, students };
  }

  listSchools(status?: string) {
    return this.prisma.school.findMany({
      where: status ? { status } : {},
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

  async setSchoolStatus(id: string, status: string) {
    if (!SCHOOL_STATUSES.includes(status)) throw new BadRequestException('Invalid status');
    const school = await this.prisma.school.findUnique({ where: { id }, select: { id: true } });
    if (!school) throw new NotFoundException('School not found');
    // data is kept; the school's users are simply refused at the door (JwtStrategy checks status)
    await this.prisma.school.update({ where: { id }, data: { status } });
    this.features.invalidate(id);
    return { id, status };
  }
}
