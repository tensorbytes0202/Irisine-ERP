/**
 * Inside one school: each role can do its own job and nothing else. Every route is called as a
 * student, a parent and a teacher. Runs against the database in DATABASE_URL (local only),
 * creates its own data and removes it again.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/modules/email/email.service';
import { FEATURE_KEYS } from '../src/modules/platform/feature-catalog';
import { FAMILY, mayCall, routeKey } from '../src/modules/auth/access-policy';
const request = require('supertest');

const RUN = `acl${Date.now()}`;
const api = '/api/v1';
const PASSWORD = 'Test-Pass-12345';
const ROLES = ['SUPER_ADMIN', 'DIRECTOR', 'ACADEMIC_COORDINATOR', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'ACCOUNTANT', 'TRANSPORT_MANAGER', 'HOBBY_COORDINATOR', 'PARENT', 'STUDENT'];

describe('Access control inside a school (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let schoolId: string;
  const token: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const http = () => app.getHttpServer();
  const as = (role: string) => ({ Authorization: `Bearer ${token[role]}` });
  let routes: { method: string; path: string }[];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService).useValue({ sendEmail: async () => undefined })
      .overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true })
      .compile();
    app = mod.createNestApplication({ logger: process.env.ACL_DEBUG ? ['error'] : false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.listen(0);
    prisma = app.get(PrismaService);
    routes = app.getHttpAdapter().getInstance()._router.stack
      .filter((l: any) => l.route)
      .map((l: any) => ({ method: Object.keys(l.route.methods)[0].toUpperCase(), path: l.route.path as string }))
      .filter((r: any) => r.path.startsWith(api));

    schoolId = (await prisma.school.create({ data: { name: RUN, code: RUN } })).id;
    await prisma.schoolFeature.createMany({ data: FEATURE_KEYS.filter((k) => k !== 'CORE').map((featureKey) => ({ schoolId, featureKey })) });
    const hash = await bcrypt.hash(PASSWORD, 4);
    const user = async (key: string, role: string) => {
      ids[key] = (await prisma.user.create({ data: { email: `${RUN}-${key}@example.com`.toLowerCase(), passwordHash: hash, firstName: key, lastName: 'T', role, schoolId } })).id;
    };
    for (const role of ROLES) await user(role, role);
    await user('classmate', 'STUDENT');
    const session = await prisma.academicSession.create({ data: { name: '2026-27', startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31'), status: 'ACTIVE', schoolId } });
    const cls = await prisma.class.create({ data: { name: 'Class 1', grade: 1, schoolId } });
    ids.class = cls.id;
    const section = await prisma.section.create({ data: { name: 'A', classId: cls.id } });
    const student = async (key: string, userKey: string) => {
      ids[key] = (await prisma.student.create({ data: { admissionNo: `${RUN}-${key}`, userId: ids[userKey], schoolId, classId: cls.id, sectionId: section.id, academicSessionId: session.id, dateOfBirth: new Date('2018-01-01'), gender: 'MALE' } })).id;
    };
    await student('me', 'STUDENT');
    await student('other', 'classmate');
    await prisma.guardian.create({ data: { studentId: ids.me, userId: ids.PARENT, relation: 'FATHER', name: 'P', phone: '9000000000' } });
    const cert = (studentId: string, n: string) => prisma.certificate.create({ data: { studentId, type: 'MERIT', title: `cert ${n}`, issuedDate: new Date(), issuedBy: ids.SUPER_ADMIN, serialNumber: `${RUN}-${n}` } });
    ids.myCert = (await cert(ids.me, '1')).id;
    ids.otherCert = (await cert(ids.other, '2')).id;
    const grievance = (by: string, n: string) => prisma.grievance.create({ data: { ticketNumber: `${RUN}-G${n}`, submittedBy: by, category: 'ACADEMIC', subject: `grievance ${n}`, description: 'x', schoolId } });
    ids.myGrievance = (await grievance(ids.STUDENT, '1')).id;
    ids.otherGrievance = (await grievance(ids.classmate, '2')).id;
    await prisma.diaryEntry.create({ data: { classId: cls.id, date: new Date('2026-11-20'), type: 'NOTE', content: 'for the class', createdBy: ids.CLASS_TEACHER } });
    await prisma.diaryEntry.create({ data: { classId: cls.id, studentId: ids.other, date: new Date('2026-11-20'), type: 'NOTE', content: 'private note about classmate', createdBy: ids.CLASS_TEACHER } });
    await prisma.staffProfile.create({ data: { userId: ids.SUBJECT_TEACHER, employeeId: RUN, department: 'Science', designation: 'Teacher', dateOfJoining: new Date(), bankAccount: 'SECRET-BANK', panNumber: 'SECRET-PAN' } });
    ids.announcement = (await prisma.announcement.create({ data: { title: 'draft', content: 'draft', type: 'GENERAL', audience: 'ALL', createdBy: ids.SUPER_ADMIN, schoolId } })).id;

    for (const role of ROLES) {
      token[role] = (await request(http()).post(`${api}/auth/login`).send({ email: `${RUN}-${role}@example.com`.toLowerCase(), password: PASSWORD })).body.accessToken;
      expect(token[role]).toBeTruthy();
    }
  }, 120000);

  afterAll(async () => {
    const users = Object.values(ids);
    const step = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { console.warn('cleanup', (e as Error).message.split('\n').pop()); } };
    await step(() => prisma.certificate.deleteMany({ where: { studentId: { in: users } } }));
    await step(() => prisma.grievance.deleteMany({ where: { schoolId } }));
    await step(() => prisma.diaryEntry.deleteMany({ where: { createdBy: { in: users } } }));
    await step(() => prisma.staffProfile.deleteMany({ where: { userId: { in: users } } }));
    await step(() => prisma.announcement.deleteMany({ where: { schoolId } }));
    await step(() => prisma.guardian.deleteMany({ where: { studentId: { in: users } } }));
    await step(() => prisma.student.deleteMany({ where: { id: { in: users } } }));
    await step(() => prisma.section.deleteMany({ where: { class: { schoolId } } }));
    await step(() => prisma.class.deleteMany({ where: { schoolId } }));
    await step(() => prisma.academicSession.deleteMany({ where: { schoolId } }));
    await step(() => prisma.auditLog.deleteMany({ where: { userId: { in: users } } }));
    await step(() => prisma.refreshToken.deleteMany({ where: { userId: { in: users } } }));
    await step(() => prisma.user.deleteMany({ where: { schoolId } }));
    await step(() => prisma.schoolFeature.deleteMany({ where: { schoolId } }));
    await step(() => prisma.school.delete({ where: { id: schoolId } }));
    await app.close();
  }, 120000);

  const get = (role: string, url: string) => request(http()).get(`${api}${url}`).set(as(role));
  const fill = (path: string) => path.replace(/:(\w+)(\(\*\))?/g, () => '00000000-0000-0000-0000-000000000000');

  it('every route a family may call really exists', () => {
    const known = new Set(routes.map((r) => `${r.method} ${routeKey(r.path)}`));
    expect(FAMILY.filter((f) => !known.has(f))).toEqual([]);
  });

  it('no route answers without a login (except the public ones)', async () => {
    const publicRoutes = /auth\/(login|accept-invite|refresh|forgot-password|send-otp|resend-otp|verify-otp|reset-password)$|payments\/webhook$/;
    const open: string[] = [];
    for (const r of routes.filter((x) => !publicRoutes.test(x.path))) {
      const res = await (request(http()) as any)[r.method.toLowerCase()](fill(r.path));
      if (res.status !== 401) open.push(`${r.method} ${r.path} -> ${res.status}`);
    }
    expect(open).toEqual([]);
  }, 120000);

  it.each(['STUDENT', 'PARENT', 'CLASS_TEACHER', 'ACCOUNTANT', 'TRANSPORT_MANAGER'])('%s is refused on every route outside the role', async (role) => {
    const leaked: string[] = [];
    // the payment webhook is public: it is protected by its signature, not by a login
    for (const r of routes.filter((x) => !mayCall(role, x.method, x.path) && !x.path.endsWith('payments/webhook'))) {
      const res = await (request(http()) as any)[r.method.toLowerCase()](fill(r.path)).set(as(role)).send({});
      // 403 from the policy; 400/404 would mean the request got through to the handler
      if (res.status !== 403) leaked.push(`${r.method} ${r.path} -> ${res.status}`);
    }
    expect(leaked).toEqual([]);
  }, 120000);

  it('no route crashes for any role', async () => {
    const crashed = new Set<string>();
    for (const role of ROLES) {
      for (const r of routes.filter((x) => x.method === 'GET' && !/\/files/.test(x.path))) {
        const res = await request(http()).get(fill(r.path)).set(as(role));
        if (res.status >= 500) crashed.add(`${r.path} -> ${res.status}`);
      }
    }
    expect([...crashed].sort()).toEqual([]);
  }, 300000);

  it('a student cannot change school records', async () => {
    for (const [method, path] of [
      ['post', '/expenses'], ['patch', `/grievances/${ids.myGrievance}/resolve`], ['post', '/transfer-certificates'],
      ['delete', '/timetable/x'], ['post', '/certificates'], ['patch', '/transport-billing/x/waive'], ['post', '/gallery/albums'],
      ['post', '/academic-transition/x/execute'], ['post', '/diary'], ['post', '/health/records'], ['post', '/users'],
    ]) {
      expect([path, (await (request(http()) as any)[method](`${api}${path}`).set(as('STUDENT')).send({})).status]).toEqual([path, 403]);
    }
  });

  it("a student and a parent see their own records and never a classmate's", async () => {
    for (const role of ['STUDENT', 'PARENT']) {
      const certs = await get(role, '/certificates');
      expect(certs.status).toBe(200);
      expect(certs.body.map((c: any) => c.id)).toEqual([ids.myCert]);
      expect((await get(role, `/certificates/${ids.myCert}`)).status).toBe(200);
      expect((await get(role, `/certificates/${ids.otherCert}`)).status).toBe(404);
      expect((await get(role, `/certificates/${ids.otherCert}/print`)).status).toBe(404);
      expect((await get(role, `/certificates?studentId=${ids.other}`)).status).toBe(403);
      expect((await get(role, `/fees/payments/${ids.other}`)).status).toBe(403);
      expect((await get(role, `/attendance/student/${ids.other}/summary`)).status).toBe(403);
      expect((await get(role, `/health/records/${ids.other}`)).status).toBe(403);
      expect((await get(role, `/students/${ids.other}`)).status).toBe(403);
      expect((await get(role, `/students/${ids.me}`)).status).toBe(200);
      const diary = await get(role, '/diary');
      expect(diary.status).toBe(200);
      expect(JSON.stringify(diary.body)).toContain('for the class');
      expect(JSON.stringify(diary.body)).not.toContain('private note');
      expect((await get(role, `/announcements/${ids.announcement}`)).status).toBe(404);
      expect((await get(role, '/announcements?isPublished=false')).body).toEqual([]);
    }
    const grievances = await get('STUDENT', '/grievances');
    expect(grievances.body.map((g: any) => g.id)).toEqual([ids.myGrievance]);
    expect((await get('STUDENT', `/grievances/${ids.otherGrievance}`)).status).toBe(404);
  });

  it("staff salary and bank details are not open to other staff", async () => {
    expect((await get('CLASS_TEACHER', '/staff-directory')).status).toBe(403);
    expect((await get('CLASS_TEACHER', `/staff-directory/${ids.SUBJECT_TEACHER}`)).status).toBe(403);
    expect((await get('CLASS_TEACHER', `/payroll/user/${ids.SUBJECT_TEACHER}`)).status).toBe(403);
    expect((await get('SUBJECT_TEACHER', `/staff-directory/${ids.SUBJECT_TEACHER}`)).status).toBe(200);
    expect((await get('ACCOUNTANT', '/staff-directory')).status).toBe(200);
  });

  it('each role still reaches the pages in its own menu', async () => {
    const menu: Record<string, string[]> = {
      SUPER_ADMIN: ['/students', '/users', '/fees/heads', '/expenses', '/grievances', '/announcements', '/classes/detailed'],
      DIRECTOR: ['/users', '/grievances', '/feedback', '/expenses', '/staff-directory'],
      ACADEMIC_COORDINATOR: ['/students', '/syllabus', '/assignments', '/assessments', '/reports/attendance/x', '/grievances'],
      CLASS_TEACHER: ['/students', '/diary', '/assignments', '/announcements', '/calendar', '/events', '/dashboard/teacher-stats'],
      ACCOUNTANT: ['/fees/heads', '/expenses', '/concessions', '/dashboard/admin-stats'],
      TRANSPORT_MANAGER: ['/bus/vehicles', '/dashboard/admin-stats'],
      STUDENT: ['/dashboard/student-stats', '/timetable', '/assignments', '/notifications', '/announcements', '/events', '/diary', '/grievances', '/certificates', '/feedback', '/payments/dues', '/learning-paths', '/live-classes', '/course-modules', '/discussions'],
      PARENT: ['/parent-portal/overview', '/notifications', '/announcements', '/events', '/diary', '/grievances', '/payments/dues', '/communication/conversations'],
    };
    const refused: string[] = [];
    for (const [role, urls] of Object.entries(menu)) {
      for (const url of urls) {
        const res = await get(role, url);
        if (res.status === 403 || res.status >= 500) refused.push(`${role} ${url} -> ${res.status}`);
      }
    }
    expect(refused).toEqual([]);
  });
});
