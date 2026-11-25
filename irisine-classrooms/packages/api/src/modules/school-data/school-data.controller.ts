import {
  Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolDataService } from './school-data.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSessionDto } from './dto/create-session.dto';

/** Who may change a school's classes, sections, subjects and sessions. Everyone else only reads. */
const SETUP_ROLES = ['SUPER_ADMIN', 'ADMIN', 'IT_ADMIN', 'DIRECTOR', 'PRINCIPAL', 'ACADEMIC_COORDINATOR'];

@ApiTags('School Data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class SchoolDataController {
  constructor(
    private prisma: PrismaService,
    private schoolDataService: SchoolDataService,
  ) {}

  // ─── Classes ──────────────────────────────────────────────────────────────

  @Get('classes')
  @ApiOperation({ summary: 'List classes (lightweight for dropdowns)' })
  async getClasses(@CurrentUser('schoolId') schoolId: string) {
    return this.prisma.class.findMany({
      where: { schoolId },
      orderBy: { grade: 'asc' },
      select: { id: true, name: true, grade: true },
    });
  }

  @Get('classes/detailed')
  @ApiOperation({ summary: 'List classes with full stats (sections, subjects, counts)' })
  async getClassesDetailed(@CurrentUser('schoolId') schoolId: string) {
    return this.schoolDataService.getClassesWithStats(schoolId);
  }

  @Post('classes')
  @Roles(...SETUP_ROLES)
  @ApiOperation({ summary: 'Create a new class' })
  async createClass(
    @Body() body: { name: string; grade: number },
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.schoolDataService.createClass(body.name, body.grade, schoolId);
  }

  @Patch('classes/:id')
  @Roles(...SETUP_ROLES)
  @ApiOperation({ summary: 'Update a class' })
  async updateClass(
    @Param('id') id: string,
    @Body() body: { name?: string; grade?: number },
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.schoolDataService.updateClass(schoolId, id, body.name, body.grade);
  }

  @Delete('classes/:id')
  @Roles(...SETUP_ROLES)
  @ApiOperation({ summary: 'Delete a class (only if no students)' })
  async deleteClass(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.schoolDataService.deleteClass(schoolId, id);
  }

  // ─── Sections ─────────────────────────────────────────────────────────────

  @Get('sections')
  @ApiOperation({ summary: 'List sections by classId' })
  async getSections(@CurrentUser('schoolId') schoolId: string, @Query('classId') classId?: string) {
    return this.prisma.section.findMany({
      where: { class: { schoolId }, ...(classId && { classId }) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, classId: true, capacity: true },
    });
  }

  @Post('sections')
  @Roles(...SETUP_ROLES)
  @ApiOperation({ summary: 'Create a new section' })
  async createSection(
    @Body() body: { name: string; classId: string; capacity?: number },
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.schoolDataService.createSection(schoolId, body.name, body.classId, body.capacity);
  }

  @Patch('sections/:id')
  @Roles(...SETUP_ROLES)
  @ApiOperation({ summary: 'Update a section' })
  async updateSection(
    @Param('id') id: string,
    @Body() body: { name?: string; capacity?: number },
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.schoolDataService.updateSection(schoolId, id, body.name, body.capacity);
  }

  @Delete('sections/:id')
  @Roles(...SETUP_ROLES)
  @ApiOperation({ summary: 'Delete a section (only if no students)' })
  async deleteSection(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.schoolDataService.deleteSection(schoolId, id);
  }

  // ─── Subjects ─────────────────────────────────────────────────────────────

  @Get('subjects')
  @ApiOperation({ summary: 'List subjects by optional classId' })
  async getSubjects(@CurrentUser('schoolId') schoolId: string, @Query('classId') classId?: string) {
    return this.prisma.subject.findMany({
      where: { class: { schoolId }, ...(classId && { classId }) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, classId: true, isElective: true, description: true },
    });
  }

  @Post('subjects')
  @Roles(...SETUP_ROLES)
  @ApiOperation({ summary: 'Create a new subject' })
  async createSubject(
    @Body() body: { name: string; code: string; classId: string; isElective?: boolean; description?: string },
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.schoolDataService.createSubject(
      schoolId, body.name, body.code, body.classId, body.isElective, body.description,
    );
  }

  @Patch('subjects/:id')
  @Roles(...SETUP_ROLES)
  @ApiOperation({ summary: 'Update a subject' })
  async updateSubject(
    @Param('id') id: string,
    @Body() body: { name?: string; code?: string; isElective?: boolean; description?: string },
    @CurrentUser('schoolId') schoolId: string,
  ) {
    return this.schoolDataService.updateSubject(schoolId, id, body.name, body.code, body.isElective, body.description);
  }

  @Delete('subjects/:id')
  @Roles(...SETUP_ROLES)
  @ApiOperation({ summary: 'Delete a subject' })
  async deleteSubject(@Param('id') id: string, @CurrentUser('schoolId') schoolId: string) {
    return this.schoolDataService.deleteSubject(schoolId, id);
  }

  // ─── Academic Sessions ────────────────────────────────────────────────────

  @Get('academic-sessions')
  @ApiOperation({ summary: 'List academic sessions' })
  async getSessions(@CurrentUser('schoolId') schoolId: string) {
    return this.prisma.academicSession.findMany({
      where: { schoolId },
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
    });
  }

  @Post('academic-sessions')
  @Roles(...SETUP_ROLES)
  @ApiOperation({ summary: 'Open a new academic session (needed before students can be added)' })
  async createSession(@Body() dto: CreateSessionDto, @CurrentUser('schoolId') schoolId: string) {
    return this.schoolDataService.createSession(schoolId, dto);
  }
}
