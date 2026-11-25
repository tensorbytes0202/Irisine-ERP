import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SchoolDataService {
  constructor(private prisma: PrismaService) {}

  // Every lookup is limited to the caller's school: another school's id is "not found".
  private async ownClass(schoolId: string, id: string) {
    const row = await this.prisma.class.findFirst({ where: { id, schoolId } });
    if (!row) throw new NotFoundException('Class not found');
    return row;
  }

  private async ownSection(schoolId: string, id: string) {
    const row = await this.prisma.section.findFirst({ where: { id, class: { schoolId } } });
    if (!row) throw new NotFoundException('Section not found');
    return row;
  }

  private async ownSubject(schoolId: string, id: string) {
    const row = await this.prisma.subject.findFirst({ where: { id, class: { schoolId } } });
    if (!row) throw new NotFoundException('Subject not found');
    return row;
  }

  async createSession(schoolId: string, dto: { name: string; startDate: string; endDate: string }) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) throw new BadRequestException('The end date must be after the start date');
    const name = dto.name.trim();
    if (await this.prisma.academicSession.findFirst({ where: { schoolId, name } })) {
      throw new ConflictException(`Academic session "${name}" already exists`);
    }
    // the first session of a school becomes the active one
    const active = await this.prisma.academicSession.count({ where: { schoolId, status: 'ACTIVE' } });
    return this.prisma.academicSession.create({
      data: { name, startDate, endDate, schoolId, status: active ? 'UPCOMING' : 'ACTIVE' },
    });
  }

  // ─── Classes ────────────────────────────────────────────────────

  async createClass(name: string, grade: number, schoolId: string) {
    const existing = await this.prisma.class.findUnique({
      where: { grade_schoolId: { grade, schoolId } },
    });
    if (existing) {
      throw new ConflictException(`A class with grade ${grade} already exists for this school`);
    }
    return this.prisma.class.create({
      data: { name, grade, schoolId },
    });
  }

  async updateClass(schoolId: string, id: string, name?: string, grade?: number) {
    await this.ownClass(schoolId, id);
    return this.prisma.class.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(grade !== undefined ? { grade } : {}),
      },
    });
  }

  async deleteClass(schoolId: string, id: string) {
    await this.ownClass(schoolId, id);

    const studentCount = await this.prisma.student.count({ where: { classId: id } });
    if (studentCount > 0) {
      throw new BadRequestException(`Cannot delete class: ${studentCount} student(s) are currently enrolled in this class`);
    }

    await this.prisma.class.delete({ where: { id } });
    return { message: 'Class deleted successfully' };
  }

  async getClassesWithStats(schoolId: string) {
    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      orderBy: { grade: 'asc' },
      include: {
        sections: {
          include: {
            _count: { select: { students: true } },
          },
        },
        subjects: {
          select: { id: true, name: true, code: true, isElective: true },
        },
        _count: { select: { students: true } },
      },
    });

    return classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      grade: cls.grade,
      sectionCount: cls.sections.length,
      studentCount: cls._count.students,
      sections: cls.sections.map((s) => ({
        id: s.id,
        name: s.name,
        capacity: s.capacity,
        studentCount: s._count.students,
      })),
      subjects: cls.subjects,
    }));
  }

  // ─── Sections ───────────────────────────────────────────────────

  async createSection(schoolId: string, name: string, classId: string, capacity?: number) {
    await this.ownClass(schoolId, classId);

    const existing = await this.prisma.section.findUnique({
      where: { name_classId: { name, classId } },
    });
    if (existing) throw new ConflictException(`Section "${name}" already exists in this class`);

    return this.prisma.section.create({
      data: { name, classId, capacity: capacity ?? 40 },
    });
  }

  async updateSection(schoolId: string, id: string, name?: string, capacity?: number) {
    await this.ownSection(schoolId, id);

    return this.prisma.section.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(capacity !== undefined ? { capacity } : {}),
      },
    });
  }

  async deleteSection(schoolId: string, id: string) {
    await this.ownSection(schoolId, id);

    const studentCount = await this.prisma.student.count({ where: { sectionId: id } });
    if (studentCount > 0) {
      throw new BadRequestException(`Cannot delete section: ${studentCount} student(s) are enrolled in this section`);
    }

    await this.prisma.section.delete({ where: { id } });
    return { message: 'Section deleted successfully' };
  }

  // ─── Subjects ───────────────────────────────────────────────────

  async createSubject(schoolId: string, name: string, code: string, classId: string, isElective?: boolean, description?: string) {
    await this.ownClass(schoolId, classId);

    const existing = await this.prisma.subject.findUnique({
      where: { code_classId: { code, classId } },
    });
    if (existing) throw new ConflictException(`Subject with code "${code}" already exists in this class`);

    return this.prisma.subject.create({
      data: { name, code, classId, isElective: isElective ?? false, description },
    });
  }

  async updateSubject(schoolId: string, id: string, name?: string, code?: string, isElective?: boolean, description?: string) {
    await this.ownSubject(schoolId, id);

    return this.prisma.subject.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(isElective !== undefined ? { isElective } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    });
  }

  async deleteSubject(schoolId: string, id: string) {
    await this.ownSubject(schoolId, id);

    // Check if subject has grades (students)
    const gradeCount = await this.prisma.grade.count({ where: { subjectId: id } });
    if (gradeCount > 0) {
      throw new BadRequestException(`Cannot delete subject: it has ${gradeCount} grade record(s) associated`);
    }

    await this.prisma.subject.delete({ where: { id } });
    return { message: 'Subject deleted successfully' };
  }
}
