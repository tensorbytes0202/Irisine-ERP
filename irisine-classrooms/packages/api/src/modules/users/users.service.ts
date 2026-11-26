import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { tenantContext } from '../../prisma/tenant-context';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LimitsService, FACULTY_ROLES } from '../platform/limits.service';
import { ConfigService } from '@nestjs/config';
import { isPlatformOwner } from '../auth/platform-owner';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'IT_ADMIN', 'DIRECTOR', 'PRINCIPAL'];
/** Never handed out by any API: IT_ADMIN is set only in the database. */
const UNGRANTABLE_ROLES = ['IT_ADMIN', 'PLATFORM_SUPER_ADMIN'];

type Actor = { role: string; schoolId: string; isOwner?: boolean };

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private limits: LimitsService,
    private config: ConfigService,
  ) {}

  /**
   * Admin and leadership accounts belong to the school Super Admin (or the platform owner).
   * Without this an IT Admin could create a Director with a password of its choice and sign in
   * with far more access.
   */
  private assertMayManage(actor: Actor, role: string) {
    if (ADMIN_ROLES.includes(role) && actor.role !== 'SUPER_ADMIN' && !actor.isOwner) {
      throw new ForbiddenException('Only the school Super Admin can manage admin and leadership accounts');
    }
  }

  /** The school always comes from the logged-in user, never from the request body. */
  async create(dto: CreateUserDto, actor: Actor) {
    if (UNGRANTABLE_ROLES.includes(dto.role)) throw new ForbiddenException('This role cannot be granted here');
    this.assertMayManage(actor, dto.role);
    if (FACULTY_ROLES.includes(dto.role)) await this.limits.assertCanAddFaculty(actor.schoolId);
    const email = dto.email.trim().toLowerCase();
    if (await tenantContext.allSchools(() => this.prisma.user.findUnique({ where: { email } }))) {
      throw new ConflictException('A user with this email already exists');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
        schoolId: actor.schoolId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findAll(schoolId: string, role?: string) {
    return this.prisma.user.findMany({
      where: { schoolId, ...(role && { role }) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        schoolId: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const { firstName, lastName, phone } = dto;
    await this.prisma.user.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
      },
    });
    return this.findById(id);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** A user of the caller's own school, or 404 (never reveals other schools' users). */
  async findInSchool(id: string, schoolId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, schoolId },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        role: true, avatarUrl: true, isActive: true, schoolId: true, createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actor: Actor & { sub: string }) {
    const target = await this.findInSchool(id, actor.schoolId);
    // the owner account is changed by nobody here (it edits its own profile through /users/me)
    if (isPlatformOwner(target, this.config.get<string>('PLATFORM_OWNER_EMAILS'))) {
      throw new ForbiddenException('The platform owner account cannot be changed here');
    }
    this.assertMayManage(actor, target.role);
    if (id === actor.sub && dto.isActive === false) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    // Only these profile fields can change here. Role, school and password are never taken from the
    // request, so an update can neither escalate a role nor move a user to another school.
    const { firstName, lastName, phone, avatarUrl, isActive } = dto;
    if (isActive === true && !target.isActive && FACULTY_ROLES.includes(target.role)) {
      await this.limits.assertCanAddFaculty(actor.schoolId);
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        avatarUrl: true,
        isActive: true,
      },
    });
  }
}
