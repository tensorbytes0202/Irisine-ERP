/**
 * A student's dashboard shows exactly that student's school day: own section, current session,
 * published work only. Runs against the LOCAL database; creates its own data and removes it again.
 *
 *   npx jest --config ./test/jest-e2e.json test/student-dashboard.e2e-spec.ts
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
const request = require('supertest');

const RUN = `sdash${Date.now()}`;
const PASSWORD = 'Test-Pass-12345';
const api = '/api/v1';
const inDays = (n: number) => new Date(Date.now() + n * 86400_000);

describe('Student dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let schoolId: string;
  let token: string;
  let noRecordToken: string;
  const get = (query = '', t = token) => request(app.getHttpServer()).get(`${api}/dashboard/student-stats${query}`).set({ Authorization: `Bearer ${t}` });
  const ids = { subject: '', teacher: '' };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = mod.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    schoolId = (await prisma.school.create({ data: { name: RUN, code: RUN } })).id;
    const hash = await bcrypt.hash(PASSWORD, 4);
    const user = (name: string, role: string) =>
      prisma.user.create({ data: { email: `${RUN}-${name}@example.com`, passwordHash: hash, firstName: name, lastName: 'T', role, schoolId } });
    const session = (name: string, status: string) =>
      prisma.academicSession.create({ data: { name, status, startDate: inDays(-100), endDate: inDays(200), schoolId } });

    const studentUser = await user('student', 'STUDENT');
    await user('norecord', 'STUDENT');
    ids.teacher = (await user('teacher', 'CLASS_TEACHER')).id;
    const current = await session('current', 'ACTIVE');
    const old = await session('old', 'COMPLETED');
    const cls = await prisma.class.create({ data: { name: 'Class 5', grade: 5, schoolId } });
    const mine = await prisma.section.create({ data: { name: 'A', classId: cls.id } });
    const other = await prisma.section.create({ data: { name: 'B', classId: cls.id } });
    ids.subject = (await prisma.subject.create({ data: { name: 'Maths', code: `${RUN}M`, classId: cls.id } })).id;
    const student = await prisma.student.create({
      data: { admissionNo: RUN, userId: studentUser.id, schoolId, classId: cls.id, sectionId: mine.id, academicSessionId: current.id, dateOfBirth: new Date('2015-01-01'), gender: 'MALE' },
    });

    const homework = (title: string, extra: object) =>
      prisma.assignment.create({
        data: { title, type: 'TEXT_RESPONSE', subjectId: ids.subject, classId: cls.id, teacherId: ids.teacher, dueDate: inDays(3), totalMarks: 10, isPublished: true, academicSessionId: current.id, ...extra },
      });
    await homework('for my section', { sectionId: mine.id });
    await homework('for the whole class', {});
    await homework('for the other section', { sectionId: other.id });
    await homework('not published', { sectionId: mine.id, isPublished: false });
    await homework('already over', { sectionId: mine.id, dueDate: inDays(-3) });

    const exam = (title: string, isPublished: boolean) =>
      prisma.assessment.create({
        data: { title, type: 'UNIT_TEST', tier: 3, subjectId: ids.subject, classId: cls.id, academicSessionId: current.id, createdBy: ids.teacher, totalMarks: 20, scheduledDate: inDays(5), isPublished },
      });
    await exam('published exam', true);
    await exam('draft exam', false);

    const timetable = async (room: string, sectionId: string, academicSessionId: string, extra: object = {}) =>
      prisma.timetable.create({
        data: {
          classId: cls.id, sectionId, academicSessionId, effectiveFrom: inDays(-30), ...extra,
          slots: { create: [{ dayOfWeek: 3, startTime: '09:00', endTime: '09:45', subjectId: ids.subject, room }] },
        },
      });
    await timetable('current', mine.id, current.id);
    await timetable('other section', other.id, current.id);
    await timetable('old session', mine.id, old.id);
    await timetable('replaced', mine.id, current.id, { effectiveTo: inDays(-2) });
    await timetable('not started', mine.id, current.id, { effectiveFrom: inDays(10) });

    for (const [i, status] of ['PRESENT', 'PRESENT', 'ABSENT', 'LATE'].entries()) {
      await prisma.attendance.create({ data: { studentId: student.id, date: inDays(-10 - i), status, markedById: ids.teacher } });
    }

    const login = async (name: string) =>
      (await request(app.getHttpServer()).post(`${api}/auth/login`).send({ email: `${RUN}-${name}@example.com`, password: PASSWORD })).body.accessToken;
    token = await login('student');
    noRecordToken = await login('norecord');
  }, 60000);

  afterAll(async () => {
    const inClass = { class: { schoolId } };
    await prisma.attendance.deleteMany({ where: { student: { user: { schoolId } } } });
    await prisma.timetable.deleteMany({ where: inClass });
    await prisma.assignment.deleteMany({ where: { subject: inClass } });
    await prisma.assessment.deleteMany({ where: inClass });
    await prisma.student.deleteMany({ where: { user: { schoolId } } });
    await prisma.subject.deleteMany({ where: inClass });
    await prisma.section.deleteMany({ where: inClass });
    await prisma.class.deleteMany({ where: { schoolId } });
    await prisma.academicSession.deleteMany({ where: { schoolId } });
    await prisma.refreshToken.deleteMany({ where: { user: { schoolId } } });
    await prisma.user.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await app.close();
  }, 60000);

  it('lists upcoming published work of the own section and the whole class only', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.deadlines.map((d: any) => d.title).sort()).toEqual(['for my section', 'for the whole class', 'published exam']);
  });

  it("shows the asked day's classes from the current timetable of the own section", async () => {
    const res = await get('?day=3');
    expect(res.body.todaySchedule.map((s: any) => s.room)).toEqual(['current']);
    expect((await get('?day=4')).body.todaySchedule).toEqual([]);
  });

  it('ignores a day that is not a weekday number', async () => {
    for (const q of ['?day=9', '?day=abc', '?day=-1', '?day=']) {
      expect((await get(q)).status).toBe(200);
    }
  });

  it('counts the attendance', async () => {
    expect((await get()).body.attendance).toEqual({ present: 2, absent: 1, late: 1, total: 4, percent: 50 });
  });

  it('says when the account has no student record', async () => {
    const res = await get('', noRecordToken);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ error: 'Student record not found' });
  });
});
