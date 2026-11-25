import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

interface DefaultSetting {
  key: string;
  value: string;
  category: string;
  label: string;
  type: string;
}

const DEFAULT_SETTINGS: DefaultSetting[] = [
  {
    key: 'school_name',
    value: 'Irisine Classrooms Demo School',
    category: 'GENERAL',
    label: 'School Name',
    type: 'STRING',
  },
  {
    key: 'academic_year',
    value: '2025-26',
    category: 'ACADEMIC',
    label: 'Current Academic Year',
    type: 'STRING',
  },
  {
    key: 'grading_scale',
    value: JSON.stringify({
      'A+': 90,
      A: 80,
      'B+': 70,
      B: 60,
      C: 50,
      D: 40,
      F: 0,
    }),
    category: 'GRADING',
    label: 'Grading Scale (min % per grade)',
    type: 'JSON',
  },
  {
    key: 'attendance_threshold',
    value: '75',
    category: 'ATTENDANCE',
    label: 'Minimum Attendance Threshold (%)',
    type: 'NUMBER',
  },
  {
    key: 'late_penalty_percent',
    value: '2',
    category: 'FEE',
    label: 'Late Fee Penalty (%)',
    type: 'NUMBER',
  },
  {
    key: 'max_class_size',
    value: '40',
    category: 'ACADEMIC',
    label: 'Maximum Class Size',
    type: 'NUMBER',
  },
  {
    key: 'fee_due_day',
    value: '10',
    category: 'FEE',
    label: 'Fee Due Day of Month',
    type: 'NUMBER',
  },
  {
    key: 'notification_channels',
    value: JSON.stringify(['EMAIL', 'SMS']),
    category: 'NOTIFICATION',
    label: 'Active Notification Channels',
    type: 'JSON',
  },
];

/**
 * The `key` column is unique across the whole table, so a school's own row is stored as
 * "<schoolId>:<key>" (older rows keep the plain key). Callers only ever see the plain key,
 * and every query is limited to the caller's school.
 */
@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  private publicRow<T extends { key: string; schoolId: string }>(row: T): T {
    return { ...row, key: row.key.replace(`${row.schoolId}:`, '') };
  }

  private findRow(key: string, schoolId: string) {
    return this.prisma.systemSetting.findFirst({
      where: { schoolId, key: { in: [key, `${schoolId}:${key}`] } },
    });
  }

  async findAll(schoolId: string) {
    const settings = await this.prisma.systemSetting.findMany({
      where: { schoolId },
      orderBy: [{ category: 'asc' }, { label: 'asc' }],
    });

    // Group by category
    const grouped: Record<string, typeof settings> = {};
    for (const setting of settings) {
      (grouped[setting.category] ??= []).push(this.publicRow(setting));
    }

    return grouped;
  }

  async findOne(key: string, schoolId: string) {
    const setting = await this.findRow(key, schoolId);
    if (!setting) {
      throw new NotFoundException(`Setting "${key}" not found`);
    }
    return this.publicRow(setting);
  }

  async update(key: string, dto: UpdateSettingDto, updatedBy: string, schoolId: string) {
    const setting = await this.findRow(key, schoolId);
    if (!setting) {
      throw new NotFoundException(`Setting "${key}" not found`);
    }
    const updated = await this.prisma.systemSetting.update({
      where: { id: setting.id },
      data: {
        value: dto.value,
        updatedBy,
      },
    });
    return this.publicRow(updated);
  }

  async seedDefaults(schoolId: string, seededBy: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
    const results: { key: string; action: string }[] = [];

    for (const def of DEFAULT_SETTINGS) {
      if (await this.findRow(def.key, schoolId)) {
        results.push({ key: def.key, action: 'SKIPPED' });
        continue;
      }
      await this.prisma.systemSetting.create({
        data: {
          key: `${schoolId}:${def.key}`,
          value: def.key === 'school_name' && school ? school.name : def.value,
          category: def.category,
          label: def.label,
          type: def.type,
          schoolId,
          updatedBy: seededBy,
        },
      });
      results.push({ key: def.key, action: 'CREATED' });
    }

    return { seeded: results };
  }
}
