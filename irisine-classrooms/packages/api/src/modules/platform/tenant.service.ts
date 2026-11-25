import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface Actor {
  sub: string;
  role: string;
  schoolId: string;
}

/**
 * Central tenant checks. A record that belongs to another school is reported as "not found"
 * (never "forbidden"), so ids of other schools cannot even be probed.
 * Ownership is resolved through the owning relation (class.schoolId, user.schoolId, ...), so
 * nested ids sent by a client are validated too, not only the top-level one.
 */
@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async classInSchool(id: string, schoolId: string) {
    const row = await this.prisma.class.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!row) throw new NotFoundException('Class not found');
  }

  async sectionInSchool(id: string, schoolId: string, classId?: string) {
    const row = await this.prisma.section.findFirst({
      where: { id, ...(classId && { classId }), class: { schoolId } },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Section not found');
  }

  async sessionInSchool(id: string, schoolId: string) {
    const row = await this.prisma.academicSession.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!row) throw new NotFoundException('Academic session not found');
  }

  async feeHeadInSchool(id: string, schoolId: string) {
    const row = await this.prisma.feeHead.findFirst({ where: { id, class: { schoolId } }, select: { id: true } });
    if (!row) throw new NotFoundException('Fee head not found');
  }

  async studentInSchool(id: string, schoolId: string) {
    const row = await this.prisma.student.findFirst({
      where: { id, user: { schoolId } },
      select: { id: true, userId: true },
    });
    if (!row) throw new NotFoundException('Student not found');
    return row;
  }

  /**
   * Same school AND, for students/parents, only their own record
   * (a student sees themselves, a parent sees their linked children).
   */
  async assertCanViewStudent(actor: Actor, studentId: string) {
    const student = await this.studentInSchool(studentId, actor.schoolId);
    if (actor.role === 'STUDENT' && student.userId !== actor.sub) {
      throw new ForbiddenException('You can only view your own records');
    }
    if (actor.role === 'PARENT') {
      const link = await this.prisma.guardian.findFirst({ where: { studentId, userId: actor.sub }, select: { id: true } });
      if (!link) throw new ForbiddenException('You can only view your own children');
    }
    return student;
  }
}
