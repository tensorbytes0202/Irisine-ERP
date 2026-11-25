/**
 * IT_ADMIN = the platform owner who also administers its own school: login, scope, schools and no escalation.
 * Runs the real Nest app against the LOCAL database (DATABASE_URL), creates its own data and removes it again.
 * Never point DATABASE_URL at production when running this.
 *
 *   npx jest --config ./test/jest-e2e.json test/it-admin.e2e-spec.ts
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/modules/email/email.service';
const request = require('supertest');

const RUN = `ita${Date.now()}`;
const PASSWORD = 'Test-Pass-12345';
const api = '/api/v1';

describe('IT Admin, the platform owner (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => app.getHttpServer();
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const email = (name: string) => `${RUN}-${name}@example.com`;
  const login = (name: string, password = PASSWORD, portal?: string) =>
    request(http()).post(`${api}/auth/login`).send({ email: email(name), password, ...(portal && { portal }) });

  const schools: Record<'A' | 'B', { id: string; classId: string; sectionId: string; sessionId: string }> = {} as any;
  const users: Record<string, string> = {}; // name -> id
  let it_: string; // IT admin token of school A

  async function makeSchool(key: 'A' | 'B') {
    const school = await prisma.school.create({ data: { name: `${RUN} ${key}`, code: `${RUN}-${key}` } });
    const cls = await prisma.class.create({ data: { name: `Class 1 ${key}`, grade: 1, schoolId: school.id } });
    const section = await prisma.section.create({ data: { name: 'A', classId: cls.id } });
    const session = await prisma.academicSession.create({
      data: { name: '2026-27', startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31'), status: 'ACTIVE', schoolId: school.id },
    });
    schools[key] = { id: school.id, classId: cls.id, sectionId: section.id, sessionId: session.id };
    await prisma.schoolFeature.createMany({
      data: [
        { schoolId: school.id, featureKey: 'STUDENT_MANAGEMENT' },
        { schoolId: school.id, featureKey: 'FEES', adminManageable: true },
      ],
    });
  }

  async function makeUser(name: string, role: string, school: 'A' | 'B', isActive = true) {
    const u = await prisma.user.create({
      data: {
        email: email(name), passwordHash: await bcrypt.hash(PASSWORD, 4), firstName: name, lastName: 'Test',
        role, isActive, schoolId: schools[school].id,
      },
    });
    users[name] = u.id;
  }

  beforeAll(async () => {
    process.env.PLATFORM_OWNER_EMAILS = email('it'); // only this IT_ADMIN owns the platform
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ sendEmail: async () => undefined })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await makeSchool('A');
    await makeSchool('B');
    await makeUser('it', 'IT_ADMIN', 'A');
    await makeUser('itoff', 'IT_ADMIN', 'A', false);
    // an IT_ADMIN a school created before the role meant anything more than school IT
    await makeUser('legacy', 'IT_ADMIN', 'B');
    await makeUser('super', 'SUPER_ADMIN', 'A');
    await makeUser('director', 'DIRECTOR', 'A');
    await makeUser('teacher', 'CLASS_TEACHER', 'A');
    await makeUser('student', 'STUDENT', 'A');
    await makeUser('bsuper', 'SUPER_ADMIN', 'B');
    await makeUser('bteacher', 'CLASS_TEACHER', 'B');
  }, 60000);

  afterAll(async () => {
    const ids = Object.values(schools).map((s) => s.id);
    try {
      const uids = (await prisma.user.findMany({ where: { schoolId: { in: ids } }, select: { id: true } })).map((u) => u.id);
      await prisma.student.deleteMany({ where: { userId: { in: uids } } });
      await prisma.systemSetting.deleteMany({ where: { schoolId: { in: ids } } });
      await prisma.subject.deleteMany({ where: { class: { schoolId: { in: ids } } } });
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

  // ── login ────────────────────────────────────────────────────────

  describe('login', () => {
    it('an IT Admin signs in through the IT Admin portal and gets identity, role and school', async () => {
      const res = await login('it', PASSWORD, 'IT_ADMIN');
      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({
        id: users.it, email: email('it'), role: 'IT_ADMIN', portal: 'IT_ADMIN', schoolId: schools.A.id, firstName: 'it',
      });
      const payload = JSON.parse(Buffer.from(res.body.accessToken.split('.')[1], 'base64url').toString());
      expect(payload).toMatchObject({ sub: users.it, role: 'IT_ADMIN', schoolId: schools.A.id });
      it_ = res.body.accessToken;
    });

    it('wrong password and unknown email are rejected the same way', async () => {
      expect((await login('it', 'Wrong-Pass-999', 'IT_ADMIN')).status).toBe(401);
      expect((await login('nobody', PASSWORD, 'IT_ADMIN')).status).toBe(401);
    });

    it('an inactive IT Admin cannot sign in', async () => {
      expect((await login('itoff', PASSWORD, 'IT_ADMIN')).status).toBe(401);
    });

    it('the server, not the selected card, decides the portal', async () => {
      expect((await login('it', PASSWORD, 'SUPER_ADMIN')).status).toBe(403);
      expect((await login('teacher', PASSWORD, 'IT_ADMIN')).status).toBe(403);
      expect((await login('super', PASSWORD, 'IT_ADMIN')).status).toBe(403);
    });

    it.each([
      ['super', 'SUPER_ADMIN'],
      ['teacher', 'FACULTY'],
      ['student', 'STUDENT'],
    ])('%s login still works in the %s portal', async (name, portal) => {
      const res = await login(name, PASSWORD, portal);
      expect(res.status).toBe(201);
      expect(res.body.user.portal).toBe(portal);
    });

    it('there is no separate platform login any more', async () => {
      const res = await request(http()).post(`${api}/platform-public/login`).send({ email: email('it'), password: PASSWORD });
      expect(res.status).toBe(404);
    });

    it('refresh is refused once the account is inactive', async () => {
      const res = await login('director', PASSWORD, 'FACULTY');
      await prisma.user.update({ where: { id: users.director }, data: { isActive: false } });
      const refreshed = await request(http()).post(`${api}/auth/refresh`).send({ refreshToken: res.body.refreshToken });
      await prisma.user.update({ where: { id: users.director }, data: { isActive: true } });
      expect(refreshed.status).toBe(401);
    });

    it('logout ends the refresh token', async () => {
      const res = await login('it', PASSWORD, 'IT_ADMIN');
      expect((await request(http()).post(`${api}/auth/logout`).set(auth(res.body.accessToken))).status).toBe(201);
      expect((await request(http()).post(`${api}/auth/refresh`).send({ refreshToken: res.body.refreshToken })).status).toBe(401);
    });
  });

  // ── scope ────────────────────────────────────────────────────────

  describe('what an IT Admin may reach', () => {
    it.each(['/users/me', '/users', '/students', '/classes', '/classes/detailed', '/academic-sessions', '/settings', '/school/features', '/school/profile', '/school/modules', '/platform/schools', '/platform/stats', '/platform/features'])(
      'may open %s',
      async (path) => {
        expect((await request(http()).get(`${api}${path}`).set(auth(it_))).status).toBe(200);
      },
    );

    it.each(['/fees/heads', '/payroll', '/audit/logs', '/dashboard/stats', '/search?q=a'])(
      'may NOT open %s',
      async (path) => {
        expect((await request(http()).get(`${api}${path}`).set(auth(it_))).status).toBe(403);
      },
    );

    it('no school account can use the owner controls', async () => {
      for (const name of ['super', 'teacher', 'student', 'bsuper']) {
        const t = (await login(name)).body.accessToken;
        expect((await request(http()).get(`${api}/platform/schools`).set(auth(t))).status).toBe(403);
        expect((await request(http()).delete(`${api}/platform/schools/${schools.B.id}`).set(auth(t))).status).toBe(403);
        expect(
          (await request(http()).put(`${api}/platform/schools/${schools.A.id}/features`).set(auth(t)).send({ features: [{ key: 'LIBRARY', enabled: true }] })).status,
        ).toBe(403);
      }
      expect((await prisma.school.findUnique({ where: { id: schools.B.id } }))!.status).toBe('ACTIVE');
    });

    it('a forged token (role edited by the client) is rejected', async () => {
      const [h, p, s] = it_.split('.');
      const body = JSON.parse(Buffer.from(p, 'base64url').toString());
      const forged = [h, Buffer.from(JSON.stringify({ ...body, sub: users.bsuper })).toString('base64url'), s].join('.');
      expect((await request(http()).get(`${api}/platform/schools`).set(auth(forged))).status).toBe(401);
      expect((await request(http()).get(`${api}/users`)).status).toBe(401);
    });

    it('lists its granted modules and may switch only the ones the platform allowed', async () => {
      const list = await request(http()).get(`${api}/school/modules`).set(auth(it_));
      expect(list.body.map((m: any) => m.key).sort()).toEqual(['FEES', 'STUDENT_MANAGEMENT']);
      expect((await request(http()).patch(`${api}/school/features/STUDENT_MANAGEMENT`).set(auth(it_)).send({ enabled: false })).status).toBe(403);
      expect((await request(http()).patch(`${api}/school/features/FEES`).set(auth(it_)).send({ enabled: false })).status).toBe(200);
      const after = await request(http()).get(`${api}/school/modules`).set(auth(it_));
      expect(after.body.find((m: any) => m.key === 'FEES')).toMatchObject({ adminManageable: true, adminEnabled: false });
      await request(http()).patch(`${api}/school/features/FEES`).set(auth(it_)).send({ enabled: true });
    });

    it('a disabled module is blocked for the IT Admin and its data is kept', async () => {
      const key = { schoolId_featureKey: { schoolId: schools.A.id, featureKey: 'STUDENT_MANAGEMENT' } };
      await prisma.schoolFeature.update({ where: key, data: { enabled: false } });
      await new Promise((r) => setTimeout(r, 10_500)); // entitlement cache
      expect((await request(http()).get(`${api}/students`).set(auth(it_))).status).toBe(403);
      expect(await prisma.class.count({ where: { schoolId: schools.A.id } })).toBe(1);
      await prisma.schoolFeature.update({ where: key, data: { enabled: true } });
      await new Promise((r) => setTimeout(r, 10_500));
      expect((await request(http()).get(`${api}/students`).set(auth(it_))).status).toBe(200);
    }, 40000);
  });

  // ── users and escalation ─────────────────────────────────────────

  describe('user management without escalation', () => {
    const body = { password: PASSWORD, firstName: 'New', lastName: 'Person' };

    it.each(['IT_ADMIN', 'PLATFORM_SUPER_ADMIN'])('nobody can create a %s account from the website', async (role) => {
      const superToken = (await login('super')).body.accessToken;
      for (const t of [it_, superToken]) {
        const res = await request(http()).post(`${api}/users`).set(auth(t)).send({ ...body, email: email(`esc-${role}`), role });
        expect(res.status).toBe(400);
      }
      expect(await prisma.user.count({ where: { email: email(`esc-${role}`) } })).toBe(0);
    });

    it('a school Super Admin cannot deactivate or rename the owner account', async () => {
      const superToken = (await login('super')).body.accessToken;
      for (const change of [{ isActive: false }, { firstName: 'Taken' }]) {
        expect((await request(http()).patch(`${api}/users/${users.it}`).set(auth(superToken)).send(change)).status).toBe(403);
      }
      expect((await prisma.user.findUnique({ where: { id: users.it } }))!.isActive).toBe(true);
    });

    it('the owner manages leadership accounts of its own school', async () => {
      const created = await request(http()).post(`${api}/users`).set(auth(it_)).send({ ...body, email: email('boss'), role: 'SUPER_ADMIN' });
      expect(created.status).toBe(201);
      expect((await request(http()).patch(`${api}/users/${users.director}`).set(auth(it_)).send({ firstName: 'Dir' })).status).toBe(200);
    });

    it('cannot change its own role or school', async () => {
      expect((await request(http()).patch(`${api}/users/me`).set(auth(it_)).send({ role: 'SUPER_ADMIN' })).status).toBe(400);
      expect((await request(http()).patch(`${api}/users/me`).set(auth(it_)).send({ schoolId: schools.B.id })).status).toBe(400);
      expect((await request(http()).patch(`${api}/users/${users.it}`).set(auth(it_)).send({ isActive: false })).status).toBe(403);
      const me = await prisma.user.findUnique({ where: { id: users.it } });
      expect(me).toMatchObject({ role: 'IT_ADMIN', schoolId: schools.A.id, isActive: true });
    });

    it('can edit its own name and phone', async () => {
      const res = await request(http()).patch(`${api}/users/me`).set(auth(it_)).send({ firstName: 'Renamed', phone: '999' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ firstName: 'Renamed', phone: '999', role: 'IT_ADMIN' });
    });

    it('can create faculty in its own school, within the faculty limit', async () => {
      const ok = await request(http()).post(`${api}/users`).set(auth(it_)).send({ ...body, email: email('f1'), role: 'SUBJECT_TEACHER', schoolId: schools.B.id });
      expect(ok.status).toBe(201);
      expect((await prisma.user.findUnique({ where: { email: email('f1') } }))!.schoolId).toBe(schools.A.id);

      // reactivating a faculty member must not slip past the limit
      await request(http()).patch(`${api}/users/${ok.body.id}`).set(auth(it_)).send({ isActive: false });
      const active = await prisma.user.count({ where: { schoolId: schools.A.id, isActive: true, role: { in: ['DIRECTOR', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] } } });
      await prisma.school.update({ where: { id: schools.A.id }, data: { maxFaculty: active } });
      const re = await request(http()).patch(`${api}/users/${ok.body.id}`).set(auth(it_)).send({ isActive: true });
      await prisma.school.update({ where: { id: schools.A.id }, data: { maxFaculty: null } });
      expect(re.status).toBe(403);
    });

    it('change-password validates the new password', async () => {
      const t = (await login('teacher', PASSWORD)).body.accessToken;
      expect((await request(http()).post(`${api}/auth/change-password`).set(auth(t)).send({ currentPassword: PASSWORD, newPassword: 'x' })).status).toBe(400);
      expect((await request(http()).post(`${api}/auth/change-password`).set(auth(t)).send({ currentPassword: 'nope-nope', newPassword: 'Brand-New-Pass-1' })).status).toBe(401);
    });
  });

  // ── tenant isolation ─────────────────────────────────────────────

  describe('cross-school access', () => {
    it('cannot see or change users of another school', async () => {
      const list = await request(http()).get(`${api}/users`).set(auth(it_));
      expect(list.body.some((u: any) => u.id === users.bteacher)).toBe(false);
      expect((await request(http()).get(`${api}/users/${users.bteacher}`).set(auth(it_))).status).toBe(404);
      expect((await request(http()).patch(`${api}/users/${users.bteacher}`).set(auth(it_)).send({ isActive: false })).status).toBe(404);
    });

    it('lists only its own classes, sections, subjects and sessions', async () => {
      const classes = await request(http()).get(`${api}/classes?schoolId=${schools.B.id}`).set(auth(it_));
      expect(classes.body.map((c: any) => c.id)).toEqual([schools.A.classId]);
      expect((await request(http()).get(`${api}/sections?classId=${schools.B.classId}`).set(auth(it_))).body).toEqual([]);
      expect((await request(http()).get(`${api}/sections`).set(auth(it_))).body.map((s: any) => s.id)).toEqual([schools.A.sectionId]);
      expect((await request(http()).get(`${api}/subjects?classId=${schools.B.classId}`).set(auth(it_))).body).toEqual([]);
      const sessions = await request(http()).get(`${api}/academic-sessions`).set(auth(it_));
      expect(sessions.body.map((s: any) => s.id)).toEqual([schools.A.sessionId]);
    });

    it('cannot write into another school', async () => {
      const b = schools.B;
      const send = (method: 'post' | 'patch' | 'delete', path: string, data?: object) =>
        request(http())[method](`${api}${path}`).set(auth(it_)).send(data);
      expect((await send('patch', `/classes/${b.classId}`, { name: 'hacked' })).status).toBe(404);
      expect((await send('delete', `/classes/${b.classId}`)).status).toBe(404);
      expect((await send('post', '/sections', { name: 'Z', classId: b.classId })).status).toBe(404);
      expect((await send('patch', `/sections/${b.sectionId}`, { name: 'hacked' })).status).toBe(404);
      expect((await send('delete', `/sections/${b.sectionId}`)).status).toBe(404);
      expect((await send('post', '/subjects', { name: 'Z', code: 'Z1', classId: b.classId })).status).toBe(404);
      expect(await prisma.section.count({ where: { classId: b.classId } })).toBe(1);
      expect((await prisma.class.findUnique({ where: { id: b.classId } }))!.name).toBe('Class 1 B');

      const created = await send('post', '/classes', { name: 'Class 2', grade: 2, schoolId: b.id });
      expect(created.status).toBe(201);
      expect(created.body.schoolId).toBe(schools.A.id);
    });

    it('a student or teacher cannot change classes', async () => {
      for (const name of ['student', 'teacher']) {
        const t = (await login(name)).body.accessToken;
        expect((await request(http()).post(`${api}/classes`).set(auth(t)).send({ name: 'X', grade: 9 })).status).toBe(403);
        expect((await request(http()).delete(`${api}/sections/${schools.A.sectionId}`).set(auth(t))).status).toBe(403);
      }
    });

    it('keeps settings per school', async () => {
      const bToken = (await login('bsuper')).body.accessToken;
      expect((await request(http()).post(`${api}/settings/seed-defaults`).set(auth(it_))).status).toBe(201);
      expect((await request(http()).post(`${api}/settings/seed-defaults`).set(auth(bToken))).status).toBe(201);
      const changed = await request(http()).patch(`${api}/settings/school_name`).set(auth(bToken)).send({ value: 'School B name' });
      expect(changed.status).toBe(200);
      const mine = await request(http()).get(`${api}/settings?schoolId=${schools.B.id}`).set(auth(it_));
      const rows = Object.values(mine.body).flat() as any[];
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.schoolId === schools.A.id)).toBe(true);
      expect(rows.find((r) => r.key === 'school_name').value).not.toBe('School B name');
    });

    it('edits only its own school profile, never status or limits', async () => {
      const ok = await request(http()).patch(`${api}/school/profile`).set(auth(it_)).send({ city: 'Indore', phone: '12345' });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ id: schools.A.id, city: 'Indore' });
      for (const bad of [{ status: 'ACTIVE' }, { maxStudents: 9999 }, { id: schools.B.id }, { code: 'x' }]) {
        expect((await request(http()).patch(`${api}/school/profile`).set(auth(it_)).send(bad)).status).toBe(400);
      }
      expect((await prisma.school.findUnique({ where: { id: schools.B.id } }))!.city).toBeNull();
    });

    it('can open a new academic session for its own school', async () => {
      const res = await request(http()).post(`${api}/academic-sessions`).set(auth(it_))
        .send({ name: '2027-28', startDate: '2027-04-01', endDate: '2028-03-31' });
      expect(res.status).toBe(201);
      expect(res.body.schoolId).toBe(schools.A.id);
      const bad = await request(http()).post(`${api}/academic-sessions`).set(auth(it_))
        .send({ name: 'bad', startDate: '2028-04-01', endDate: '2027-03-31' });
      expect(bad.status).toBe(400);
    });
  });
  // ── an IT_ADMIN that is not the owner ────────────────────────────

  describe('an IT_ADMIN account that is not listed as owner', () => {
    let t: string;
    beforeAll(async () => {
      t = (await login('legacy', PASSWORD, 'IT_ADMIN')).body.accessToken;
    });

    it('is told apart from the owner', async () => {
      expect((await request(http()).get(`${api}/users/me`).set(auth(t))).body.isOwner).toBe(false);
      expect((await request(http()).get(`${api}/users/me`).set(auth(it_))).body.isOwner).toBe(true);
    });

    it.each(['/platform/schools', '/platform/stats', '/platform/features'])('cannot open %s', async (path) => {
      expect((await request(http()).get(`${api}${path}`).set(auth(t))).status).toBe(403);
    });

    it('cannot create, change or delete schools', async () => {
      const a = `${api}/platform/schools/${schools.A.id}`;
      expect((await request(http()).post(`${api}/platform/schools`).set(auth(t)).send({})).status).toBe(403);
      expect((await request(http()).delete(a).set(auth(t))).status).toBe(403);
      expect((await request(http()).patch(`${a}/limits`).set(auth(t)).send({ maxStudents: 1 })).status).toBe(403);
      expect((await request(http()).put(`${a}/features`).set(auth(t)).send({ features: [{ key: 'LIBRARY', enabled: true }] })).status).toBe(403);
      expect((await prisma.school.findUnique({ where: { id: schools.A.id } }))!.status).toBe('ACTIVE');
    });

    it('cannot create or change admin and leadership accounts', async () => {
      for (const role of ['SUPER_ADMIN', 'DIRECTOR']) {
        const res = await request(http()).post(`${api}/users`).set(auth(t))
          .send({ email: email(`legacy-${role}`), password: PASSWORD, firstName: 'X', lastName: 'Y', role });
        expect(res.status).toBe(403);
      }
      expect((await request(http()).patch(`${api}/users/${users.bsuper}`).set(auth(t)).send({ isActive: false })).status).toBe(403);
    });

    it("can be deactivated by its school's Super Admin", async () => {
      const bsuper = (await login('bsuper')).body.accessToken;
      expect((await request(http()).patch(`${api}/users/${users.legacy}`).set(auth(bsuper)).send({ isActive: false })).status).toBe(200);
      expect((await request(http()).get(`${api}/users`).set(auth(t))).status).toBe(401);
      await prisma.user.update({ where: { id: users.legacy }, data: { isActive: true } });
    });
  });

  // ── schools: add, grant, delete, restore ─────────────────────────

  describe('the owner runs the schools', () => {
    let created: string;

    afterAll(async () => {
      if (created) schools['C' as 'A'] = { id: created } as any; // removed by the global cleanup
    });

    it('adds a school with limits and chosen modules', async () => {
      const res = await request(http()).post(`${api}/platform/schools`).set(auth(it_)).send({
        schoolName: `${RUN} New`, adminName: 'Asha Rao', adminEmail: email('newadmin'), maxStudents: 100,
        features: [{ key: 'ATTENDANCE', enabled: true }],
      });
      expect(res.status).toBe(201);
      expect(res.body.inviteLink).toContain('/accept-invite?token=');
      created = res.body.schoolId;
      const list = await request(http()).get(`${api}/platform/schools`).set(auth(it_));
      expect(list.body.map((s: any) => s.id)).toContain(created);
    });

    it('grants modules to a school', async () => {
      const res = await request(http()).put(`${api}/platform/schools/${schools.B.id}/features`).set(auth(it_))
        .send({ features: [{ key: 'LIBRARY', enabled: true }] });
      expect(res.status).toBe(200);
      expect(res.body.map((f: any) => f.featureKey)).toContain('LIBRARY');
    });

    it('deletes a school: hidden from the list, its users locked out, its data kept', async () => {
      const bToken = (await login('bsuper')).body.accessToken;
      const res = await request(http()).delete(`${api}/platform/schools/${schools.B.id}`).set(auth(it_));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DELETED');
      const ids = async (query = '') => (await request(http()).get(`${api}/platform/schools${query}`).set(auth(it_))).body.map((s: any) => s.id);
      expect(await ids()).not.toContain(schools.B.id);
      expect(await ids('?status=DELETED')).toContain(schools.B.id);
      expect((await login('bsuper')).status).toBe(403);
      expect([401, 403]).toContain((await request(http()).get(`${api}/users`).set(auth(bToken))).status);
      expect(await prisma.class.count({ where: { schoolId: schools.B.id } })).toBeGreaterThan(0);
      expect(await prisma.user.count({ where: { schoolId: schools.B.id } })).toBeGreaterThan(0);
    });

    it('restores a deleted school', async () => {
      const res = await request(http()).patch(`${api}/platform/schools/${schools.B.id}/status`).set(auth(it_)).send({ status: 'ACTIVE' });
      expect(res.status).toBe(200);
      expect((await login('bsuper')).status).toBe(201);
    });

    it('cannot delete or suspend the school its own account belongs to', async () => {
      expect((await request(http()).delete(`${api}/platform/schools/${schools.A.id}`).set(auth(it_))).status).toBe(403);
      expect((await request(http()).patch(`${api}/platform/schools/${schools.A.id}/status`).set(auth(it_)).send({ status: 'SUSPENDED' })).status).toBe(403);
      expect((await prisma.school.findUnique({ where: { id: schools.A.id } }))!.status).toBe('ACTIVE');
    });

    it('a status change cannot be used to delete, and an unknown school is 404', async () => {
      expect((await request(http()).patch(`${api}/platform/schools/${schools.B.id}/status`).set(auth(it_)).send({ status: 'DELETED' })).status).toBe(400);
      expect((await request(http()).delete(`${api}/platform/schools/nope`).set(auth(it_))).status).toBe(404);
    });
  });
});
