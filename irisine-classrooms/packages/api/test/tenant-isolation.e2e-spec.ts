/**
 * Cross-school isolation, checked from the outside: School B's Super Admin tries every API route
 * with School A's ids. Nothing of School A may be shown, changed or deleted.
 * Also covers per-school admission numbers and student login links.
 * Runs against the LOCAL database only; creates its own data and removes it again.
 *
 *   npx jest --config ./test/jest-e2e.json test/tenant-isolation.e2e-spec.ts
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/modules/email/email.service';
import { FEATURE_KEYS } from '../src/modules/platform/feature-catalog';
const request = require('supertest');

const RUN = `iso${Date.now()}`;
const MARK = `SECRETA${Date.now()}`;
const PASSWORD = 'Test-Pass-12345';
const api = '/api/v1';

describe('School isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => app.getHttpServer();
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const A: Record<string, string> = {};
  const B: Record<string, string> = {};
  let tokenA: string;
  let tokenB: string;
  /** every row seeded for school A, in creation order */
  const rows: { model: string; id: string }[] = [];

  async function make(model: string, data: any): Promise<any> {
    const row = await (prisma as any)[model].create({ data });
    rows.push({ model, id: row.id });
    return row;
  }

  async function makeSchool(ids: Record<string, string>, tag: string) {
    const school = await prisma.school.create({ data: { name: `${tag} school`, code: `${RUN}-${tag}` } });
    ids.school = school.id;
    await prisma.schoolFeature.createMany({
      data: FEATURE_KEYS.filter((k) => k !== 'CORE').map((featureKey) => ({ schoolId: school.id, featureKey })),
    });
  }

  async function login(email: string) {
    const res = await request(http()).post(`${api}/auth/login`).send({ email, password: PASSWORD });
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  }

  async function seedA() {
    const hash = await bcrypt.hash(PASSWORD, 4);
    const user = (name: string, role: string) =>
      make('user', { email: `${MARK}-${name}@example.com`.toLowerCase(), passwordHash: hash, firstName: `${MARK}${name}`, lastName: MARK, role, schoolId: A.school });
    const now = new Date('2026-11-20');
    A.admin = (await user('admin', 'SUPER_ADMIN')).id;
    A.teacher = (await user('teacher', 'CLASS_TEACHER')).id;
    A.studentUser = (await user('student', 'STUDENT')).id;
    A.session = (await make('academicSession', { name: `${MARK} session`, startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31'), status: 'ACTIVE', schoolId: A.school })).id;
    A.class = (await make('class', { name: `${MARK} class`, grade: 1, schoolId: A.school })).id;
    A.section = (await make('section', { name: `${MARK}sec`, classId: A.class })).id;
    A.subject = (await make('subject', { name: `${MARK} subject`, code: `${MARK}S`, classId: A.class })).id;
    A.student = (await make('student', { admissionNo: `${RUN}-ADM-1`, userId: A.studentUser, classId: A.class, sectionId: A.section, academicSessionId: A.session, dateOfBirth: now, gender: 'MALE' })).id;
    await make('guardian', { studentId: A.student, relation: 'FATHER', name: `${MARK} guardian`, phone: '9000000001' });
    A.announcement = (await make('announcement', { title: `${MARK} notice`, content: MARK, type: 'GENERAL', audience: 'ALL', createdBy: A.admin, schoolId: A.school })).id;
    await make('calendarEvent', { title: `${MARK} event`, type: 'EVENT', startDate: now, schoolId: A.school, createdBy: A.admin });
    const book = await make('libraryBook', { title: `${MARK} book`, author: MARK, category: 'FICTION', schoolId: A.school });
    await make('libraryIssue', { bookId: book.id, borrowerId: A.studentUser, issueDate: now, dueDate: now, remarks: MARK });
    await make('grievance', { ticketNumber: `${RUN}-G`, submittedBy: A.studentUser, category: 'ACADEMIC', subject: `${MARK} grievance`, description: MARK, schoolId: A.school });
    await make('expense', { title: `${MARK} expense`, category: 'OTHER', amount: 999, date: now, schoolId: A.school, createdBy: A.admin });
    await make('messageLog', { type: 'EMAIL', recipient: `${MARK}-student@example.com`.toLowerCase(), subject: MARK, content: MARK });
    await make('auditLog', { userId: A.admin, action: 'CREATE', entity: `${MARK}entity` });
    await make('teacherAttendance', { teacherId: A.teacher, date: now, status: 'PRESENT', remarks: MARK });
    await make('leaveApplication', { applicantId: A.teacher, type: 'SICK', startDate: now, endDate: now, reason: MARK });
    await make('diaryEntry', { classId: A.class, date: now, type: 'NOTE', content: MARK, createdBy: A.teacher });
    const enquiry = await make('admissionEnquiry', { studentName: `${MARK} enquiry`, parentName: MARK, parentPhone: '9000000002', classAppliedFor: '1', source: 'WALK_IN', academicSessionId: A.session });
    A.enquiry = enquiry.id;
    A.application = (await make('admissionApplication', { enquiryId: enquiry.id, formNumber: `${RUN}-F`, studentFirstName: MARK, studentLastName: MARK, dateOfBirth: now, gender: 'MALE', classAppliedFor: '1', academicSessionId: A.session })).id;
    await make('feedback', { type: 'TEACHER_FEEDBACK', fromUserId: A.studentUser, toUserId: A.teacher, classId: A.class, rating: 4, comment: MARK });
    A.exam = (await make('examSchedule', { name: `${MARK} exam`, type: 'UNIT_TEST', classId: A.class, academicSessionId: A.session, startDate: now, endDate: now })).id;
    A.module = (await make('courseModule', { title: `${MARK} module`, classId: A.class, subjectId: A.subject, orderIndex: 1, createdBy: A.teacher })).id;
    A.forum = (await make('discussionForum', { title: `${MARK} forum`, classId: A.class, createdBy: A.teacher })).id;
    await make('discussionPost', { forumId: A.forum, authorId: A.teacher, content: MARK });
    await make('healthRecord', { studentId: A.student, bloodGroup: 'O+', allergies: MARK });
    await make('certificate', { studentId: A.student, type: 'MERIT', title: `${MARK} certificate`, issuedDate: now, issuedBy: A.admin, serialNumber: `${RUN}-C` });
    await make('transferCertificate', { studentId: A.student, tcNumber: `${RUN}-TC`, dateOfIssue: now, reasonForLeaving: MARK, lastClassAttended: MARK, issuedBy: A.admin });
    const room = await make('hostelRoom', { roomNumber: `${MARK}R`, floor: 1, block: MARK, schoolId: A.school });
    await make('hostelAllocation', { studentId: A.student, roomId: room.id, startDate: now });
    await make('payrollRecord', { userId: A.teacher, month: 10, year: 2026, basicSalary: 1000, netSalary: 900, remarks: MARK });
    await make('staffProfile', { userId: A.teacher, employeeId: `${RUN}-E`, department: `${MARK} dept`, designation: MARK, dateOfJoining: now });
    A.notification = (await make('notification', { userId: A.teacher, title: `${MARK} notification`, message: MARK, type: 'GENERAL', channel: 'IN_APP' })).id;
    const feeHead = await make('feeHead', { name: `${MARK} fee`, amount: 500, classId: A.class, academicSessionId: A.session });
    A.feeHead = feeHead.id;
    await make('payment', { studentId: A.student, feeHeadId: feeHead.id, amount: 500, receiptNo: `${RUN}-R` });
    await make('incident', { studentId: A.student, reportedBy: A.teacher, date: now, type: 'OTHER', severity: 'LOW', description: MARK });
    const assessment = await make('assessment', { title: `${MARK} assessment`, type: 'QUIZ', tier: 1, subjectId: A.subject, classId: A.class, academicSessionId: A.session, createdBy: A.teacher, totalMarks: 10 });
    A.assessment = assessment.id;
    await make('grade', { studentId: A.student, subjectId: A.subject, assessmentId: assessment.id, type: 'TEST', marksObtained: 8, maxMarks: 10, gradedBy: A.teacher, remarks: MARK });
    const syllabus = await make('syllabus', { subjectId: A.subject, classId: A.class, academicSessionId: A.session });
    await make('chapter', { syllabusId: syllabus.id, title: `${MARK} chapter`, orderIndex: 1 });
    A.vehicle = (await make('vehicle', { number: `${MARK}V`, capacity: 40, schoolId: A.school })).id;
    const conversation = await make('conversation', { type: 'DIRECT', schoolId: A.school });
    A.conversation = conversation.id;
    await make('message', { conversationId: conversation.id, senderId: A.teacher, content: MARK });
    await make('survey', { title: `${MARK} survey`, type: 'GENERAL', createdBy: A.admin, schoolId: A.school });
    await make('systemSetting', { key: `${A.school}:${MARK}`, value: MARK, category: 'GENERAL', label: MARK, schoolId: A.school });
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ sendEmail: async () => undefined })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = mod.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.listen(0); // one server for the thousands of requests below
    prisma = app.get(PrismaService);

    await makeSchool(A, 'A');
    await makeSchool(B, 'B');
    await seedA();
    B.admin = (await prisma.user.create({
      data: { email: `${RUN}-badmin@example.com`, passwordHash: await bcrypt.hash(PASSWORD, 4), firstName: 'Bee', lastName: 'Admin', role: 'SUPER_ADMIN', schoolId: B.school },
    })).id;
    tokenA = await login(`${MARK}-admin@example.com`.toLowerCase());
    tokenB = await login(`${RUN}-badmin@example.com`);
  }, 120000);

  afterAll(async () => {
    const schoolIds = [A.school, B.school].filter(Boolean);
    const inSchools = { user: { schoolId: { in: schoolIds } } };
    const step = async (fn: () => Promise<unknown>) => {
      try { await fn(); } catch (e) { console.warn('cleanup:', (e as Error).message.split('\n').pop()); }
    };
    for (const r of [...rows].reverse().filter((r) => !['user', 'academicSession', 'class', 'section', 'student'].includes(r.model))) {
      await step(() => (prisma as any)[r.model].deleteMany({ where: { id: r.id } }));
    }
    await step(() => prisma.student.deleteMany({ where: inSchools }));
    await step(() => prisma.section.deleteMany({ where: { class: { schoolId: { in: schoolIds } } } }));
    await step(() => prisma.class.deleteMany({ where: { schoolId: { in: schoolIds } } }));
    await step(() => prisma.academicSession.deleteMany({ where: { schoolId: { in: schoolIds } } }));
    await step(() => prisma.accountInvite.deleteMany({ where: { userId: { in: rows.filter((r) => r.model === 'user').map((r) => r.id) } } }));
    await step(async () => {
      const ids = (await prisma.user.findMany({ where: { schoolId: { in: schoolIds } }, select: { id: true } })).map((u) => u.id);
      await prisma.accountInvite.deleteMany({ where: { userId: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    });
    await step(() => prisma.schoolFeature.deleteMany({ where: { schoolId: { in: schoolIds } } }));
    await step(() => prisma.school.deleteMany({ where: { id: { in: schoolIds } } }));
    await app.close();
  }, 120000);

  // ── every route ──────────────────────────────────────────────────

  /** runs the requests a few at a time: one by one the sweeps take far too long */
  async function pooled(jobs: (() => Promise<unknown>)[], size = 12) {
    let next = 0;
    const worker = async () => { while (next < jobs.length) await jobs[next++](); };
    await Promise.all(Array.from({ length: size }, worker));
  }

  const routes = (method: string): string[] =>
    app.getHttpAdapter().getInstance()._router.stack
      .filter((l: any) => l.route?.methods[method])
      .map((l: any) => l.route.path as string)
      // auth acts on the caller only; files live in object storage (see file-upload.controller.spec.ts)
      .filter((p: string) => p.startsWith(api) && !/\/api\/v1\/(auth|files)(\/|$)/.test(p));

  const NAMED: Record<string, string> = {
    studentId: 'student', classId: 'class', sectionId: 'section', subjectId: 'subject', teacherId: 'teacher',
    userId: 'teacher', schoolId: 'school', academicSessionId: 'session', assessmentId: 'assessment',
    enquiryId: 'enquiry', applicationId: 'application', conversationId: 'conversation',
  };
  /** the concrete urls for a route: named params get A's matching id, others are tried with every A id */
  function urls(path: string): string[] {
    const params = path.match(/:\w+/g);
    if (!params) return [path];
    const anyIds = Object.values(A);
    const generic = params.some((p) => !NAMED[p.slice(1)]);
    return (generic ? anyIds : [A.school]).map((any) =>
      path.replace(/:(\w+)(\(\*\))?/g, (_m, name) => (NAMED[name] ? A[NAMED[name]] : any)),
    );
  }
  const query = () =>
    `q=${MARK}&schoolId=${A.school}&classId=${A.class}&sectionId=${A.section}&studentId=${A.student}` +
    `&academicSessionId=${A.session}&sessionId=${A.session}&subjectId=${A.subject}&teacherId=${A.teacher}&userId=${A.teacher}` +
    `&date=2026-11-20&month=10&year=2026&startDate=2026-01-01&endDate=2027-12-31`;

  /** GET routes (with and without A's ids in the query) whose answer contains A's data */
  async function sweep(token: string) {
    const seen = new Set<string>();
    const jobs: (() => Promise<unknown>)[] = [];
    for (const path of routes('get')) {
      for (const url of urls(path)) {
        const singles = query().split('&');
        // the full query, then one parameter at a time (strict DTOs reject unknown ones)
        for (const q of ['', query(), ...(url === urls(path)[0] ? singles : [])]) {
          jobs.push(async () => {
            const res = await request(http()).get(q ? `${url}?${q}` : url).set(auth(token));
            // the search term itself may be echoed back, so look for it outside the "q" field
            const text = `${res.text ?? ''}`.replace(new RegExp(`"(q|query)":"${MARK}"`, 'g'), '');
            if (res.status < 400 && text.toLowerCase().includes(MARK.toLowerCase())) seen.add(path);
          });
        }
      }
    }
    await pooled(jobs);
    return [...seen].sort();
  }

  it('the sweep really reaches the data: School A sees its own records', async () => {
    expect((await sweep(tokenA)).length).toBeGreaterThan(25);
  }, 600000);

  it('no GET route shows School A to School B', async () => {
    expect(await sweep(tokenB)).toEqual([]);
  }, 600000);

  it('global search and the dashboard are limited to the own school', async () => {
    const found = await request(http()).get(`${api}/search?q=${MARK}`).set(auth(tokenB));
    expect(found.status).toBe(200);
    expect([found.body.students, found.body.users, found.body.subjects, found.body.enquiries]).toEqual([[], [], [], []]);
    const stats = await request(http()).get(`${api}/dashboard/stats`).set(auth(tokenB));
    expect(stats.status).toBe(200);
    expect(stats.body.totalStudents).toBe(0);
  });

  async function snapshot() {
    const out: Record<string, unknown> = {};
    for (const r of rows) out[`${r.model}:${r.id}`] = await (prisma as any)[r.model].findUnique({ where: { id: r.id } });
    out.counts = await Promise.all([
      prisma.student.count({ where: { user: { schoolId: A.school } } }),
      prisma.user.count({ where: { schoolId: A.school } }),
      prisma.grade.count({ where: { studentId: A.student } }),
      prisma.attendance.count({ where: { studentId: A.student } }),
      prisma.payment.count({ where: { studentId: A.student } }),
      prisma.certificate.count({ where: { studentId: A.student } }),
      prisma.diaryEntry.count({ where: { classId: A.class } }),
      prisma.section.count({ where: { classId: A.class } }),
      prisma.discussionPost.count({ where: { forumId: A.forum } }),
      prisma.message.count({ where: { conversationId: A.conversation } }),
    ]);
    return out;
  }

  it('School B cannot change or delete anything of School A through any route', async () => {
    const before = await snapshot();
    const body = {
      title: 'hacked', name: 'hacked', content: 'hacked', status: 'CANCELLED', remarks: 'hacked', isActive: false,
    };
    // updates first, deletes last, so an update that gets through is not hidden by a later delete
    for (const method of ['patch', 'put', 'post', 'delete']) {
      const jobs: (() => Promise<unknown>)[] = [];
      for (const path of routes(method).filter((p) => p.includes(':') && !p.includes('/platform/'))) {
        for (const url of urls(path)) {
          // one field at a time as well: strict DTOs refuse a body with extra fields
          for (const b of [{}, body, { title: 'hacked' }, { name: 'hacked' }, { status: 'CANCELLED' }, { isActive: false }]) {
            jobs.push(() => (request(http()) as any)[method](url).set(auth(tokenB)).send(b));
          }
        }
      }
      await pooled(jobs);
    }
    expect(await snapshot()).toEqual(before);
  }, 600000);

  // ── admission numbers and student logins ─────────────────────────

  describe('students of a second school', () => {
    let body: any;
    let student: any;
    const add = (extra: object = {}) => request(http()).post(`${api}/students`).set(auth(tokenB)).send({ ...body, ...extra });
    const link = (id: string, token = tokenB) => request(http()).post(`${api}/students/${id}/login-link`).set(auth(token));
    const tokenOf = (url: string) => url.match(/token=([a-f0-9]+)/)![1];
    const accept = (token: string, password: string) => request(http()).post(`${api}/auth/accept-invite`).send({ token, password });

    beforeAll(async () => {
      const post = (path: string, b: object) => request(http()).post(`${api}${path}`).set(auth(tokenB)).send(b);
      const session = (await post('/academic-sessions', { name: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31' })).body;
      const cls = (await post('/classes', { name: 'Class 1', grade: 1 })).body;
      const section = (await post('/sections', { name: 'A', classId: cls.id })).body;
      body = {
        admissionNo: `${RUN}-ADM-1`, firstName: 'Bina', lastName: 'Das', email: `${RUN}-bstu@example.com`, gender: 'FEMALE',
        dateOfBirth: '2018-01-01', classId: cls.id, sectionId: section.id, academicSessionId: session.id,
      };
    });

    it('may use an admission number another school already uses', async () => {
      const res = await add();
      expect(res.status).toBe(201);
      student = res.body;
    });

    it('but not the same number twice', async () => {
      const res = await add({ email: `${RUN}-bstu2@example.com` });
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Admission number');
    });

    it("cannot be placed into another school's class", async () => {
      const res = await add({ email: `${RUN}-bstu3@example.com`, admissionNo: 'X-3', classId: A.class, sectionId: A.section });
      expect(res.status).toBe(404);
    });

    it('the school gets a link with which the student sets a password and signs in', async () => {
      expect(student.inviteLink).toContain('/accept-invite?token=');
      const fresh = await link(student.id);
      expect(fresh.status).toBe(201);
      expect(fresh.body.inviteLink).toContain('/accept-invite?token=');
      // the older link stops working once a new one is made
      expect((await accept(tokenOf(student.inviteLink), 'Student-Pass-123')).status).toBe(400);
      expect((await accept(tokenOf(fresh.body.inviteLink), 'Student-Pass-123')).status).toBe(201);
      const signIn = await request(http()).post(`${api}/auth/login`).send({ email: body.email, password: 'Student-Pass-123', portal: 'STUDENT' });
      expect(signIn.status).toBe(201);
      // a student cannot make links, not even for themself
      expect((await link(student.id, signIn.body.accessToken)).status).toBe(403);
    });

    it('a link is only for own students, and only for student accounts', async () => {
      expect((await link(A.student)).status).toBe(404);
      expect((await link(student.id, tokenA)).status).toBe(404);
      await prisma.user.update({ where: { id: student.userId }, data: { role: 'DIRECTOR' } });
      expect((await link(student.id)).status).toBe(404);
      await prisma.user.update({ where: { id: student.userId }, data: { role: 'STUDENT' } });
    });
  });
});
