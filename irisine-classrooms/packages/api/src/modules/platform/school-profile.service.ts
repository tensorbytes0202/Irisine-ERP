import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSchoolProfileDto } from './dto/school-profile.dto';

const PROFILE = {
  id: true, name: true, code: true, email: true, phone: true, address: true,
  city: true, state: true, country: true, website: true, status: true,
} as const;

/** The caller's own school. The id always comes from the login, never from the request. */
@Injectable()
export class SchoolProfileService {
  constructor(private prisma: PrismaService) {}

  async get(schoolId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: PROFILE });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  update(schoolId: string, dto: UpdateSchoolProfileDto) {
    const { name, email, phone, address, city, state, country, website } = dto;
    return this.prisma.school.update({
      where: { id: schoolId },
      data: { name, email, phone, address, city, state, country, website },
      select: PROFILE,
    });
  }
}
