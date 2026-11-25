import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** Roles an actor may hand out. Admin-level roles can only be created by a school SUPER_ADMIN. */
  private assertCanGrant(actorRole: string, targetRole: string) {
    const ADMIN_ROLES = ['SUPER_ADMIN', 'IT_ADMIN', 'ADMIN', 'PLATFORM_SUPER_ADMIN'];
    if (targetRole === 'PLATFORM_SUPER_ADMIN') throw new ForbiddenException('This role cannot be granted here');
    if (ADMIN_ROLES.includes(targetRole) && actorRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only the school Super Admin can create admin accounts');
    }
  }

  /** The school always comes from the logged-in user, never from the request body. */
  async create(dto: CreateUserDto, actor: { role: string; schoolId: string }) {
    this.assertCanGrant(actor.role, dto.role);
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
    if (actor.role !== 'SUPER_ADMIN' && ['SUPER_ADMIN', 'IT_ADMIN', 'ADMIN'].includes(target.role)) {
      throw new ForbiddenException('Only the school Super Admin can change admin accounts');
    }
    if (id === actor.sub && dto.isActive === false) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    // Only these profile fields can change here. Role, school and password are never taken from the
    // request, so an update can neither escalate a role nor move a user to another school.
    const { firstName, lastName, phone, avatarUrl, isActive } = dto;
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
