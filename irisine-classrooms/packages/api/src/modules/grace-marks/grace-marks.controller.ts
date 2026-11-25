import {
  Controller,
  UseGuards,
  Post,
  Get,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GraceMarksService, CreateGraceMarkDto } from './grace-marks.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'PRINCIPAL', 'ACADEMIC_COORDINATOR', 'CLASS_TEACHER', 'SUBJECT_TEACHER')
@Controller('grace-marks')
export class GraceMarksController {
  constructor(private readonly service: GraceMarksService) {}

  @Post()
  create(@Body() dto: CreateGraceMarkDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('studentId') studentId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.service.findAll({ studentId, subjectId });
  }

  @Get('student/:studentId')
  getStudentGraceMarks(@Param('studentId') studentId: string) {
    return this.service.getStudentGraceMarks(studentId);
  }

  @Get('adjusted')
  calculateAdjustedScore(
    @Query('studentId') studentId: string,
    @Query('subjectId') subjectId: string,
  ) {
    return this.service.calculateAdjustedScore(studentId, subjectId);
  }
}
