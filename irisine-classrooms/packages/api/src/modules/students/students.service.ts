import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { tenantContext } from '../../prisma/tenant-context';
import { Actor, TenantService } from '../platform/tenant.service';
import { InvitesService } from '../platform/invites.service';
import { LimitsService } from '../platform/limits.service';
import { CreateStudentDto } from './dto/create-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private tenant: TenantService,
    private invites: InvitesService,
    private limits: LimitsService,
  ) {}

  async create(dto: CreateStudentDto, actor: Actor) {
    await this.limits.assertCanAddStudents(actor.schoolId);
    // every id the client sends must belong to the caller's own school
    await this.tenant.classInSchool(dto.classId, actor.schoolId);
    await this.tenant.sectionInSchool(dto.sectionId, actor.schoolId, dto.classId);
    await this.tenant.sessionInSchool(dto.academicSessionId, actor.schoolId);

    const email = dto.email.trim().toLowerCase();
    // emails are unique across the whole platform
    if (await tenantContext.allSchools(() => this.prisma.user.findUnique({ where: { email }, select: { id: true } }))) {
      throw new ConflictException('A user with this email already exists');
    }
    // admission numbers only need to be unique inside the school
    const sameNumber = { admissionNo: dto.admissionNo, user: { schoolId: actor.schoolId } };
    if (await this.prisma.student.findFirst({ where: sameNumber, select: { id: true } })) {
      throw new ConflictException(`Admission number "${dto.admissionNo}" is already in use. Please use a different one.`);
    }

    // nobody knows this password; the student sets their own through the emailed invite link
    const passwordHash = await bcrypt.hash(InvitesService.unusablePasswordSeed(), 10);

    const { student, token } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'STUDENT',
          schoolId: actor.schoolId,
        },
      });

      const student = await tx.student.create({
        data: {
          admissionNo: dto.admissionNo,
          userId: user.id,
          classId: dto.classId,
          sectionId: dto.sectionId,
          dateOfBirth: new Date(dto.dateOfBirth),
          gender: dto.gender,
          bloodGroup: dto.bloodGroup,
          addressLine1: dto.addressLine1,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          academicSessionId: dto.academicSessionId,
        },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      });

      const token = await this.invites.issue(user.id, tx as any);
      return { student, token };
    });

    const inviteEmailSent = await this.invites.send(email, 'your school', token);
    // the school also gets the link, so a student can be set up when email is not configured
    return { ...student, inviteEmailSent, inviteLink: this.invites.link(token) };
  }

  /** A new one-time "set your password" link for one of the school's own students. */
  async loginLink(id: string, actor: Actor) {
    const student = await this.prisma.student.findFirst({
      // student accounts only: a link must never set the password of a staff or admin account
      where: { id, isActive: true, user: { schoolId: actor.schoolId, role: 'STUDENT', isActive: true } },
      select: { user: { select: { id: true, email: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    const token = await this.invites.issue(student.user.id);
    const inviteEmailSent = await this.invites.send(student.user.email, 'your school', token);
    return { inviteEmailSent, inviteLink: this.invites.link(token) };
  }

  async findAll(filters: { classId?: string; sectionId?: string; academicSessionId?: string }, actor: Actor) {
    return this.prisma.student.findMany({
      where: {
        user: { schoolId: actor.schoolId },
        isActive: true,
        ...(filters.classId && { classId: filters.classId }),
        ...(filters.sectionId && { sectionId: filters.sectionId }),
        ...(filters.academicSessionId && { academicSessionId: filters.academicSessionId }),
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        class: { select: { id: true, name: true, grade: true } },
        section: { select: { id: true, name: true } },
        guardians: true,
      },
    });
  }

  async findById(id: string, actor: Actor) {
    await this.tenant.assertCanViewStudent(actor, id);
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        class: true,
        section: true,
        guardians: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }
}
