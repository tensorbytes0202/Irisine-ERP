/**
 * Multi-tenant platform end-to-end tests. They run the real Nest app against the LOCAL database
 * (DATABASE_URL), create their own data with unique emails, and delete it again at the end.
 * Never point DATABASE_URL at production when running this.
 *
 *   npx jest --config ./test/jest-e2e.json test/multi-tenant.e2e-spec.ts
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/modules/email/email.service';
const request = require('supertest');

const RUN = `mt${Date.now()}`;
const PLATFORM_EMAIL = `${RUN}-owner@example.com`;
const PLATFORM_PASSWORD = 'Platform-Owner-Pass-1';
const api = '/api/v1';

describe('Multi-tenant platform (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sent: { to: string; html: string }[] = [];
  const http = () => app.getHttpServer();

  let platformToken: string;
  let homeSchoolId: string;
  const schools: Record<'A' | 'B', any> = { A: {}, B: {} };

  const tokenFromInvite = (to: string) => {
    const mail = [...sent].reverse().find((m) => m.to === to);
    const match = mail?.html.match(/token=([a-f0-9]+)/);
    if (!match) throw new Error(`no invite email for ${to}`);
    return match[1];
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const platform = () => auth(platformToken);

  async function onboard(key: 'A' | 'B', features: string[], limits: { maxStudents?: number; maxFaculty?: number } = {}) {
    const email = `${RUN}-${key.toLowerCase()}-admin@example.com`;
    const create = await request(http())
      .post(`${api}/platform/schools`)
      .set(platform())
      .send({
        schoolName: `${RUN} School ${key}`, adminName: 'Asha Rao', adminEmail: email, city: 'Pune', country: 'India',
        ...limits, features: features.map((k) => ({ key: k, enabled: true })),
      });
    expect(create.status).toBe(201);
    expect(create.body.inviteLink).toContain('/accept-invite?token=');
    const accept = await request(http())
      .post(`${api}/auth/accept-invite`)
      .send({ token: tokenFromInvite(email), password: 'School-Admin-Pass-1' });
    expect(accept.status).toBe(201);
    schools[key] = { id: create.body.schoolId, email, token: accept.body.accessToken };
  }
  const login = (email: string, password: string, portal?: string) =>
    request(http()).post(`${api}/auth/login`).send({ email, password, ...(portal && { portal }) });

  beforeAll(async () => {
    process.env.PLATFORM_OWNER_EMAILS = PLATFORM_EMAIL;
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ sendEmail: async (to: string, _s: string, html: string) => void sent.push({ to, html }) })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    // the platform owner is the IT_ADMIN account; like every user it belongs to a school of its own
    const home = await prisma.school.create({ data: { name: `${RUN} Owner`, code: `${RUN}-owner` } });
    homeSchoolId = home.id;
    await prisma.user.create({
      data: {
        email: PLATFORM_EMAIL, passwordHash: await bcrypt.hash(PLATFORM_PASSWORD, 4),
        firstName: 'Owner', lastName: 'Test', role: 'IT_ADMIN', schoolId: home.id,
      },
    });
  }, 60000);

  afterAll(async () => {
    // remove only what this run created
    const ids = [schools.A.id, schools.B.id, homeSchoolId].filter(Boolean);
    try {
      const users = await prisma.user.findMany({ where: { schoolId: { in: ids } }, select: { id: true } });
      const uids = users.map((u) => u.id);
      const students = await prisma.student.findMany({ where: { userId: { in: uids } }, select: { id: true } });
      const sids = students.map((s) => s.id);
      await prisma.payment.deleteMany({ where: { studentId: { in: sids } } });
      await prisma.guardian.deleteMany({ where: { studentId: { in: sids } } });
      await prisma.student.deleteMany({ where: { id: { in: sids } } });
      await prisma.feeHead.deleteMany({ where: { class: { schoolId: { in: ids } } } });
      await prisma.section.deleteMany({ where: { class: { schoolId: { in: ids } } } });
      await prisma.class.deleteMany({ where: { schoolId: { in: ids } } });
      await prisma.academicSession.deleteMany({ where: { schoolId: { in: ids } } });
      await prisma.accountInvite.deleteMany({ where: { userId: { in: uids } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: uids } } });
      await prisma.user.deleteMany({ where: { id: { in: uids } } });
      await prisma.schoolFeature.deleteMany({ where: { schoolId: { in: ids } } });
      await prisma.school.deleteMany({ where: { id: { in: ids } } });
    } catch (e) {
      console.warn('cleanup incomplete:', (e as Error).message);
    }
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────

  describe('platform owner and onboarding', () => {
    it('the owner signs in through the IT Admin portal, a wrong password is rejected', async () => {
      expect((await login(PLATFORM_EMAIL, 'nope-nope-nope', 'IT_ADMIN')).status).toBe(401);
      const ok = await login(PLATFORM_EMAIL, PLATFORM_PASSWORD, 'IT_ADMIN');
      expect(ok.status).toBe(201);
      expect(ok.body.user).toMatchObject({ role: 'IT_ADMIN', portal: 'IT_ADMIN' });
      platformToken = ok.body.accessToken;
    });

    it('platform routes need a token', async () => {
      expect((await request(http()).get(`${api}/platform/schools`)).status).toBe(401);
    });

    it('the separate platform login no longer exists', async () => {
      const res = await request(http()).post(`${api}/platform-public/login`).send({ email: PLATFORM_EMAIL, password: PLATFORM_PASSWORD });
      expect(res.status).toBe(404);
    });

    it('there is no public school registration any more', async () => {
      const res = await request(http()).post(`${api}/platform-public/school-registrations`).send({ schoolName: 'x' });
      expect(res.status).toBe(404);
      expect((await request(http()).post(`${api}/auth/register`).send({ email: 'a@b.co', password: 'x' })).status).toBe(404);
    });

    it('creating a school validates its input', async () => {
      const base = { schoolName: `${RUN} Bad`, adminName: 'Asha Rao', adminEmail: `${RUN}-bad@example.com` };
      const post = (body: any, token = platform()) => request(http()).post(`${api}/platform/schools`).set(token).send(body);
      expect((await post({ ...base, features: [] })).status).toBe(400); // needs a feature
      expect((await post({ ...base, features: [{ key: 'MADE_UP', enabled: true }] })).status).toBe(400);
      expect((await post({ ...base, features: [{ key: 'CORE', enabled: true }] })).status).toBe(400);
      expect((await post({ ...base, maxStudents: -5, features: [{ key: 'ATTENDANCE', enabled: true }] })).status).toBe(400);
      expect(await prisma.school.count({ where: { name: `${RUN} Bad` } })).toBe(0); // nothing half-created
    });

    it('only the platform owner can create a school, and the admin email must be new', async () => {
      await onboard('A', ['STUDENT_MANAGEMENT', 'ATTENDANCE', 'FEES'], { maxFaculty: 5 });
      await onboard('B', ['STUDENT_MANAGEMENT', 'ATTENDANCE']);
      const body = { schoolName: `${RUN} Dup`, adminName: 'X Y', adminEmail: schools.A.email, features: [{ key: 'ATTENDANCE', enabled: true }] };
      expect((await request(http()).post(`${api}/platform/schools`).set(platform()).send(body)).status).toBe(409);
      expect((await request(http()).post(`${api}/platform/schools`).set(auth(schools.A.token)).send({ ...body, adminEmail: `${RUN}-z@example.com` })).status).toBe(403);
    });

    it('two schools get DIFFERENT features and limits (nothing hardcoded)', async () => {
      const a = await prisma.schoolFeature.findMany({ where: { schoolId: schools.A.id } });
      const b = await prisma.schoolFeature.findMany({ where: { schoolId: schools.B.id } });
      expect(a.map((f) => f.featureKey).sort()).toEqual(['ATTENDANCE', 'FEES', 'STUDENT_MANAGEMENT']);
      expect(b.map((f) => f.featureKey).sort()).toEqual(['ATTENDANCE', 'STUDENT_MANAGEMENT']);
      const sa = await prisma.school.findUnique({ where: { id: schools.A.id } });
      const sb = await prisma.school.findUnique({ where: { id: schools.B.id } });
      expect(sa!.status).toBe('ACTIVE');
      expect([sa!.maxFaculty, sb!.maxFaculty]).toEqual([5, null]);
    });

    it('the invite link works once only', async () => {
      const again = await request(http()).post(`${api}/auth/accept-invite`)
        .send({ token: tokenFromInvite(schools.A.email), password: 'Another-Pass-123' });
      expect(again.status).toBe(400);
    });

    it('the admin logs in to the right portal only (server checks the real role)', async () => {
      expect((await login(schools.A.email, 'School-Admin-Pass-1', 'SUPER_ADMIN')).status).toBe(201);
      expect((await login(schools.A.email, 'School-Admin-Pass-1', 'STUDENT')).status).toBe(403);
      expect((await login(schools.A.email, 'School-Admin-Pass-1', 'FACULTY')).status).toBe(403);
      expect((await login(schools.A.email, 'School-Admin-Pass-1', 'IT_ADMIN')).status).toBe(403); // only the IT_ADMIN account uses that card
      expect((await login(schools.A.email, 'wrong-password')).status).toBe(401);
    });

    it('a school Super Admin cannot use platform controls', async () => {
      for (const path of ['/platform/schools', '/platform/stats', '/platform/features']) {
        expect((await request(http()).get(`${api}${path}`).set(auth(schools.A.token))).status).toBe(403);
      }
      const put = await request(http()).put(`${api}/platform/schools/${schools.A.id}/features`).set(auth(schools.A.token))
        .send({ features: [{ key: 'LIBRARY', enabled: true }] });
      expect(put.status).toBe(403);
      const status = await request(http()).patch(`${api}/platform/schools/${schools.B.id}/status`).set(auth(schools.A.token)).send({ status: 'SUSPENDED' });
      expect(status.status).toBe(403);
    });

    it('platform admin sees the schools and stats', async () => {
      const list = await request(http()).get(`${api}/platform/schools`).set(platform());
      expect(list.status).toBe(200);
      expect(list.body.map((s: any) => s.id)).toEqual(expect.arrayContaining([schools.A.id, schools.B.id]));
      expect((await request(http()).get(`${api}/platform/stats`).set(platform())).body.schools).toBeGreaterThanOrEqual(2);
    });

  });

  // ─────────────────────────────────────────────────────────────

  describe('feature entitlement (backend enforced)', () => {
    it('an enabled module works, a module the school does not have is blocked', async () => {
      expect((await request(http()).get(`${api}/students`).set(auth(schools.A.token))).status).toBe(200);
      const lib = await request(http()).get(`${api}/library/books`).set(auth(schools.A.token));
      expect(lib.status).toBe(403);
      expect(lib.body.code).toBe('FEATURE_NOT_ENABLED');
    });

    it('same endpoint: allowed for the school that has it, blocked for the one that does not', async () => {
      expect((await request(http()).get(`${api}/fees/heads`).set(auth(schools.A.token))).status).toBe(200);
      const b = await request(http()).get(`${api}/fees/heads`).set(auth(schools.B.token));
      expect(b.status).toBe(403);
      expect(b.body.feature).toBe('FEES');
    });

    it('the school can see which modules it has (for navigation)', async () => {
      const a = await request(http()).get(`${api}/school/features`).set(auth(schools.A.token));
      expect(a.body.features).toEqual(expect.arrayContaining(['CORE', 'FEES', 'ATTENDANCE']));
      expect(a.body.features).not.toContain('LIBRARY');
      expect(a.body.limits).toMatchObject({ maxFaculty: 5, maxStudents: null });
    });

    it('removing a feature blocks its API but keeps the data; re-enabling restores it', async () => {
      const cls = await prisma.class.create({ data: { name: `${RUN}-c`, grade: 1, schoolId: schools.A.id } });
      const sess = await prisma.academicSession.create({
        data: { name: `${RUN}-s`, startDate: new Date(), endDate: new Date(Date.now() + 86400000), schoolId: schools.A.id },
      });
      const head = await request(http()).post(`${api}/fees/heads`).set(auth(schools.A.token))
        .send({ name: 'Tuition', amount: 1000, classId: cls.id, academicSessionId: sess.id });
      expect(head.status).toBe(201);
      const off = await request(http()).put(`${api}/platform/schools/${schools.A.id}/features`).set(platform())
        .send({ features: [{ key: 'FEES', enabled: false }] });
      expect(off.status).toBe(200);
      expect((await request(http()).get(`${api}/fees/heads`).set(auth(schools.A.token))).status).toBe(403);
      expect(await prisma.feeHead.count({ where: { id: head.body.id } })).toBe(1); // data preserved
      await request(http()).put(`${api}/platform/schools/${schools.A.id}/features`).set(platform()).send({ features: [{ key: 'FEES', enabled: true }] });
      const back = await request(http()).get(`${api}/fees/heads`).set(auth(schools.A.token));
      expect(back.status).toBe(200);
      expect(back.body.map((h: any) => h.id)).toContain(head.body.id);
    });

    it('unknown feature keys are refused', async () => {
      const res = await request(http()).put(`${api}/platform/schools/${schools.A.id}/features`).set(platform())
        .send({ features: [{ key: 'NOT_A_FEATURE', enabled: true }] });
      expect(res.status).toBe(400);
    });

    it('a suspended school is locked out immediately, and restored on reactivation', async () => {
      await request(http()).patch(`${api}/platform/schools/${schools.B.id}/status`).set(platform()).send({ status: 'SUSPENDED' });
      try {
        const blocked = await request(http()).get(`${api}/students`).set(auth(schools.B.token));
        expect([401, 403]).toContain(blocked.status); // never 200
        const l = await login(schools.B.email, 'School-Admin-Pass-1');
        expect(l.status).toBe(403);
        expect(l.body.code).toBe('SCHOOL_NOT_ACTIVE');
      } finally {
        await request(http()).patch(`${api}/platform/schools/${schools.B.id}/status`).set(platform()).send({ status: 'ACTIVE' });
      }
      expect((await request(http()).get(`${api}/students`).set(auth(schools.B.token))).status).toBe(200);
    });
  });

  // ─────────────────────────────────────────────────────────────

  describe('role-based access inside a school', () => {
    let staffToken: string;
    const staffEmail = `${RUN}-coordinator@example.com`;
    const base = { password: 'Some-Pass-12345', firstName: 'X', lastName: 'Y' };

    it('a school Super Admin creates staff; schoolId in the body is ignored', async () => {
      const res = await request(http()).post(`${api}/users`).set(auth(schools.A.token))
        .send({ ...base, email: staffEmail, role: 'ACADEMIC_COORDINATOR', schoolId: schools.B.id });
      expect(res.status).toBe(201);
      expect((await prisma.user.findUnique({ where: { email: staffEmail } }))!.schoolId).toBe(schools.A.id); // not school B
      staffToken = (await login(staffEmail, base.password, 'FACULTY')).body.accessToken;
    });

    it('a school can never create the owner (IT Admin) or a platform role', async () => {
      const post = (role: string, n: number) =>
        request(http()).post(`${api}/users`).set(auth(schools.A.token)).send({ ...base, email: `${RUN}-x${n}@example.com`, role });
      expect((await post('IT_ADMIN', 1)).status).toBe(400);
      expect((await post('PLATFORM_SUPER_ADMIN', 2)).status).toBe(400);
      expect(await prisma.user.count({ where: { email: { startsWith: `${RUN}-x` } } })).toBe(0);
    });

    it('only admins create accounts', async () => {
      const res = await request(http()).post(`${api}/users`).set(auth(staffToken)).send({ ...base, email: `${RUN}-x3@example.com`, role: 'CLASS_TEACHER' });
      expect(res.status).toBe(403);
    });

    it('a school admin cannot switch a feature the platform did not allow, or one never granted', async () => {
      const notManageable = await request(http()).patch(`${api}/school/features/ATTENDANCE`).set(auth(schools.A.token)).send({ enabled: false });
      expect(notManageable.status).toBe(403);
      const notGranted = await request(http()).patch(`${api}/school/features/LIBRARY`).set(auth(schools.A.token)).send({ enabled: true });
      expect(notGranted.status).toBe(403);
      expect((await request(http()).get(`${api}/students`).set(auth(schools.A.token))).status).toBe(200);
    });

    it('once the owner allows it, the school admin can switch that feature (and only that)', async () => {
      await request(http()).put(`${api}/platform/schools/${schools.A.id}/features`).set(platform())
        .send({ features: [{ key: 'FEES', enabled: true, adminManageable: true }] });
      const off = await request(http()).patch(`${api}/school/features/FEES`).set(auth(schools.A.token)).send({ enabled: false });
      expect(off.status).toBe(200);
      expect((await request(http()).get(`${api}/fees/heads`).set(auth(schools.A.token))).status).toBe(403);
      const on = await request(http()).patch(`${api}/school/features/FEES`).set(auth(schools.A.token)).send({ enabled: true });
      expect(on.status).toBe(200);
      expect((await request(http()).get(`${api}/fees/heads`).set(auth(schools.A.token))).status).toBe(200);
      // still cannot grant a feature the school never had
      expect((await request(http()).patch(`${api}/school/features/LMS`).set(auth(schools.A.token)).send({ enabled: true })).status).toBe(403);
    });

    it('previously open endpoints now require a login and a staff role', async () => {
      expect((await request(http()).get(`${api}/grace-marks`)).status).toBe(401);
      expect((await request(http()).get(`${api}/remedial`)).status).toBe(401);
      expect((await request(http()).get(`${api}/result-workflow`)).status).toBe(401);
    });

    it('a deactivated user is locked out at once', async () => {
      await prisma.user.update({ where: { email: staffEmail }, data: { isActive: false } });
      expect((await request(http()).get(`${api}/users/me`).set(auth(staffToken))).status).toBe(401);
      await prisma.user.update({ where: { email: staffEmail }, data: { isActive: true } });
    });
  });

  // ─────────────────────────────────────────────────────────────

  describe('tenant isolation (cross-school access)', () => {
    let aClass: any, aSection: any, aSession: any, bClass: any;
    let aStudent: any, aStudent2: any;

    beforeAll(async () => {
      aClass = await prisma.class.findFirst({ where: { schoolId: schools.A.id } });
      aSection = await prisma.section.create({ data: { name: 'A', classId: aClass.id } });
      aSession = await prisma.academicSession.findFirst({ where: { schoolId: schools.A.id } });
      bClass = await prisma.class.create({ data: { name: `${RUN}-bc`, grade: 1, schoolId: schools.B.id } });
    });

    const studentBody = (n: number, over: any = {}) => ({
      email: `${RUN}-stu${n}@example.com`, firstName: 'Stu', lastName: `${n}`, admissionNo: `${RUN}-ADM${n}`,
      classId: aClass.id, sectionId: aSection.id, dateOfBirth: '2015-01-01', gender: 'MALE',
      academicSessionId: aSession.id, ...over,
    });

    it('cannot create a student in another school by sending that school\'s ids', async () => {
      const res = await request(http()).post(`${api}/students`).set(auth(schools.B.token)).send(studentBody(0));
      expect(res.status).toBe(404); // school A's class is invisible to school B
      expect(await prisma.student.count({ where: { admissionNo: `${RUN}-ADM0` } })).toBe(0);
    });

    it('cannot mix another school\'s class into a request', async () => {
      const res = await request(http()).post(`${api}/students`).set(auth(schools.A.token)).send(studentBody(0, { classId: bClass.id }));
      expect(res.status).toBe(404);
    });

    it('creates students inside the caller\'s school, with an invite instead of a fixed password', async () => {
      const r1 = await request(http()).post(`${api}/students`).set(auth(schools.A.token)).send(studentBody(1));
      const r2 = await request(http()).post(`${api}/students`).set(auth(schools.A.token)).send(studentBody(2, { schoolId: schools.B.id }));
      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
      aStudent = r1.body;
      aStudent2 = r2.body;
      expect(r1.body.inviteEmailSent).toBe(true);
      const u = await prisma.user.findUnique({ where: { email: `${RUN}-stu2@example.com` } });
      expect(u!.schoolId).toBe(schools.A.id);
      // the old hard-coded password no longer works
      expect((await login(`${RUN}-stu1@example.com`, 'student123')).status).toBe(401);
    });

    it('another school cannot read or list these students', async () => {
      expect((await request(http()).get(`${api}/students/${aStudent.id}`).set(auth(schools.B.token))).status).toBe(404);
      const listB = await request(http()).get(`${api}/students`).set(auth(schools.B.token));
      expect(listB.body.map((s: any) => s.id)).not.toContain(aStudent.id);
      const listA = await request(http()).get(`${api}/students`).set(auth(schools.A.token));
      expect(listA.body.map((s: any) => s.id)).toEqual(expect.arrayContaining([aStudent.id, aStudent2.id]));
    });

    it('another school cannot read a user or change one', async () => {
      const target = await prisma.user.findFirst({ where: { schoolId: schools.A.id, role: 'SUPER_ADMIN' } });
      expect((await request(http()).get(`${api}/users/${target!.id}`).set(auth(schools.B.token))).status).toBe(404);
      expect((await request(http()).patch(`${api}/users/${target!.id}`).set(auth(schools.B.token)).send({ isActive: false })).status).toBe(404);
      expect((await prisma.user.findUnique({ where: { id: target!.id } }))!.isActive).toBe(true);
      const listB = await request(http()).get(`${api}/users`).set(auth(schools.B.token));
      expect(listB.body.every((u: any) => u.email.includes('-b-admin'))).toBe(true);
    });

    it('fees: another school cannot see payments, or attach a fee to foreign ids', async () => {
      expect((await request(http()).get(`${api}/fees/payments/${aStudent.id}`).set(auth(schools.B.token))).status).toBe(403); // B has no FEES at all
      await request(http()).put(`${api}/platform/schools/${schools.B.id}/features`).set(platform()).send({ features: [{ key: 'FEES', enabled: true }] });
      expect((await request(http()).get(`${api}/fees/payments/${aStudent.id}`).set(auth(schools.B.token))).status).toBe(404);
      const foreignHead = await request(http()).post(`${api}/fees/heads`).set(auth(schools.B.token))
        .send({ name: 'Steal', amount: 1, classId: aClass.id, academicSessionId: aSession.id });
      expect(foreignHead.status).toBe(404);
      const head = await prisma.feeHead.findFirst({ where: { classId: aClass.id } });
      const pay = await request(http()).post(`${api}/fees/payments`).set(auth(schools.B.token))
        .send({ studentId: aStudent.id, feeHeadId: head!.id, amount: 100, paidAmount: 100, receiptNo: `${RUN}-R1` });
      expect(pay.status).toBe(404);
      expect(await prisma.payment.count({ where: { receiptNo: `${RUN}-R1` } })).toBe(0);
    });

    it('the student limit is enforced by the backend', async () => {
      const set = (v: number | null) => request(http()).patch(`${api}/platform/schools/${schools.A.id}/limits`).set(platform()).send({ maxStudents: v });
      expect((await set(2)).status).toBe(200); // A already has 2 students
      const blocked = await request(http()).post(`${api}/students`).set(auth(schools.A.token)).send(studentBody(3));
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('LIMIT_REACHED');
      expect(await prisma.student.count({ where: { admissionNo: `${RUN}-ADM3` } })).toBe(0);
      const bulk = await request(http()).post(`${api}/bulk/import/students`).set(auth(schools.A.token))
        .send({ students: [{ admissionNo: `${RUN}-B1`, firstName: 'B', lastName: 'One', email: `${RUN}-bulk1@example.com`, classGrade: '1', sectionName: 'A', dateOfBirth: '2015-01-01', gender: 'MALE' }] });
      expect(bulk.status).toBe(403); // bulk is a REPORTS feature that school A does not have
      expect((await set(3)).status).toBe(200);
      expect((await request(http()).post(`${api}/students`).set(auth(schools.A.token)).send(studentBody(3))).status).toBe(201);
      expect((await request(http()).post(`${api}/students`).set(auth(schools.A.token)).send(studentBody(4))).status).toBe(403);
      expect((await set(null)).status).toBe(200); // unlimited again
      expect((await request(http()).post(`${api}/students`).set(auth(schools.A.token)).send(studentBody(4))).status).toBe(201);
    });

    it('the faculty limit is enforced, and a school admin cannot change its own limits', async () => {
      const mk = (n: number) => request(http()).post(`${api}/users`).set(auth(schools.A.token)).send({
        email: `${RUN}-fac${n}@example.com`, password: 'Teacher-Pass-123', firstName: 'F', lastName: `${n}`, role: 'SUBJECT_TEACHER',
      });
      const own = await request(http()).patch(`${api}/platform/schools/${schools.A.id}/limits`).set(auth(schools.A.token)).send({ maxFaculty: 999 });
      expect(own.status).toBe(403);
      await request(http()).patch(`${api}/platform/schools/${schools.A.id}/limits`).set(platform()).send({ maxFaculty: 2 });
      expect((await mk(1)).status).toBe(201); // the class teacher made earlier + this one = 2 of 2
      const over = await mk(2);
      expect(over.status).toBe(403);
      expect(over.body.code).toBe('LIMIT_REACHED');
      await request(http()).patch(`${api}/platform/schools/${schools.A.id}/limits`).set(platform()).send({ maxFaculty: null });
      expect((await mk(2)).status).toBe(201);
      // non-faculty roles do not use up the faculty limit
      const usage = await request(http()).get(`${api}/platform/schools/${schools.A.id}/usage`).set(platform());
      expect(usage.body.faculty).toBe(3);
    });

    it('a student sees only their own records, never a classmate\'s', async () => {
      const email = `${RUN}-stu1@example.com`;
      const acc = await request(http()).post(`${api}/auth/accept-invite`).send({ token: tokenFromInvite(email), password: 'Student-Pass-123' });
      expect(acc.status).toBe(201);
      expect(acc.body.user.portal).toBe('STUDENT');
      const t = acc.body.accessToken;
      expect((await request(http()).get(`${api}/students/${aStudent.id}`).set(auth(t))).status).toBe(200);
      expect((await request(http()).get(`${api}/students/${aStudent2.id}`).set(auth(t))).status).toBe(403);
      expect((await request(http()).get(`${api}/fees/payments/${aStudent.id}`).set(auth(t))).status).toBe(200);
      expect((await request(http()).get(`${api}/fees/payments/${aStudent2.id}`).set(auth(t))).status).toBe(403);
      expect((await request(http()).get(`${api}/students`).set(auth(t))).status).toBe(403); // roster is staff only
      expect((await request(http()).get(`${api}/grace-marks`).set(auth(t))).status).toBe(403);
      expect((await login(email, 'Student-Pass-123', 'FACULTY')).status).toBe(403);
      expect((await login(email, 'Student-Pass-123', 'STUDENT')).status).toBe(201);
    });
  });
});
