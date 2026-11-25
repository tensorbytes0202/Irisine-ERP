import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LimitsService, FACULTY_ROLES } from '../platform/limits.service';

const PROTECTED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'IT_ADMIN', 'DIRECTOR', 'PRINCIPAL'];

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private limits: LimitsService,
  ) {}

  /**
   * Admin and leadership accounts belong to the school Super Admin alone. Without this an IT Admin
   * could create a Director with a password of its choice and sign in with far more access.
   */
  private isProtected(actorRole: string, targetRole: string) {
    return actorRole !== 'SUPER_ADMIN' && PROTECTED_ROLES.includes(targetRole);
  }

  private assertCanGrant(actorRole: string, targetRole: string) {
    if (targetRole === 'PLATFORM_SUPER_ADMIN') throw new ForbiddenException('This role cannot be granted here');
    if (this.isProtected(actorRole, targetRole)) {
      throw new ForbiddenException('Only the school Super Admin can create admin and leadership accounts');
    }
  }

  /** The school always comes from the logged-in user, never from the request body. */
  async create(dto: CreateUserDto, actor: { role: string; schoolId: string }) {
    this.assertCanGrant(actor.role, dto.role);
    if (FACULTY_ROLES.includes(dto.role)) await this.limits.assertCanAddFaculty(actor.schoolId);
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
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

  async update(id: string, dto: UpdateUserDto, actor: { sub: string; role: string; schoolId: string }) {
    const target = await this.findInSchool(id, actor.schoolId);
    if (this.isProtected(actor.role, target.role)) {
      throw new ForbiddenException('Only the school Super Admin can change admin and leadership accounts');
    }
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
