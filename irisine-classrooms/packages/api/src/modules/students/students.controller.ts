import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private studentsService: StudentsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'IT_ADMIN', 'ACADEMIC_COORDINATOR')
  create(@Body() dto: CreateStudentDto, @CurrentUser() actor: any) {
    return this.studentsService.create(dto, actor);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'IT_ADMIN', 'DIRECTOR', 'PRINCIPAL', 'ACADEMIC_COORDINATOR', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'ACCOUNTANT')
  findAll(
    @CurrentUser() actor: any,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('academicSessionId') academicSessionId?: string,
  ) {
    return this.studentsService.findAll({ classId, sectionId, academicSessionId }, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.studentsService.findById(id, actor);
  }
}
