/**
 * The school filter must not need a second database connection inside a transaction: on a small
 * server many people adding students at once would then block each other until they time out.
 * Runs against the LOCAL database with a pool of exactly one connection, so any extra query
 * made from inside a transaction fails every time instead of only under load.
 *
 *   npx jest --config ./test/jest-e2e.json test/tenant-pool.e2e-spec.ts
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/modules/email/email.service';
const request = require('supertest');

const RUN = `pool${Date.now()}`;
const api = '/api/v1';

describe('school filter with a single database connection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let schoolId: string;
  let token: string;
  let body: any;
  const post = (path: string, b: object) => request(app.getHttpServer()).post(`${api}${path}`).set({ Authorization: `Bearer ${token}` }).send(b);

  beforeAll(async () => {
    dotenv.config({ path: path.join(__dirname, '../.env') });
    const url = new URL(process.env.DATABASE_URL!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('local database only');
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('pool_timeout', '5');
    process.env.DATABASE_URL = url.toString();

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
    await app.listen(0);
    prisma = app.get(PrismaService);

    const school = await prisma.school.create({ data: { name: RUN, code: RUN } });
    schoolId = school.id;
    await prisma.schoolFeature.create({ data: { schoolId, featureKey: 'STUDENT_MANAGEMENT' } });
    await prisma.schoolFeature.createMany({ data: ['ADMISSION', 'REPORTS'].map((featureKey) => ({ schoolId, featureKey })) });
    const cls = await prisma.class.create({ data: { name: 'Class 1', grade: 1, schoolId } });
    const section = await prisma.section.create({ data: { name: 'A', classId: cls.id } });
    const session = await prisma.academicSession.create({
      data: { name: '2026-27', startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31'), status: 'ACTIVE', schoolId },
    });
    body = { firstName: 'P', lastName: 'Q', gender: 'MALE', dateOfBirth: '2018-01-01', classId: cls.id, sectionId: section.id, academicSessionId: session.id };
    await prisma.user.create({
      data: { email: `${RUN}-admin@example.com`, passwordHash: await bcrypt.hash('Test-Pass-12345', 4), firstName: 'A', lastName: 'B', role: 'SUPER_ADMIN', schoolId },
    });
    const login = await request(app.getHttpServer()).post(`${api}/auth/login`).send({ email: `${RUN}-admin@example.com`, password: 'Test-Pass-12345' });
    token = login.body.accessToken;
  }, 60000);

  afterAll(async () => {
    const ids = (await prisma.user.findMany({ where: { schoolId }, select: { id: true } })).map((u) => u.id);
    const sessions = (await prisma.academicSession.findMany({ where: { schoolId }, select: { id: true } })).map((x) => x.id);
    await prisma.admissionApplication.deleteMany({ where: { academicSessionId: { in: sessions } } });
    await prisma.admissionEnquiry.deleteMany({ where: { academicSessionId: { in: sessions } } });
    await prisma.student.deleteMany({ where: { userId: { in: ids } } });
    await prisma.accountInvite.deleteMany({ where: { userId: { in: ids } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { schoolId } });
    await prisma.section.deleteMany({ where: { class: { schoolId } } });
    await prisma.class.deleteMany({ where: { schoolId } });
    await prisma.academicSession.deleteMany({ where: { schoolId } });
    await prisma.schoolFeature.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } });
    await app.close();
  }, 60000);

  it('a student can be added', async () => {
    for (const i of [1, 2]) {
      const res = await post('/students', { ...body, admissionNo: `P-${i}`, email: `${RUN}-${i}@example.com` });
      expect(res.status).toBe(201);
    }
  }, 60000);

  it('students can be imported in bulk', async () => {
    const row = (i: number) => ({ admissionNo: `B-${i}`, firstName: 'B', lastName: `${i}`, email: `${RUN}-b${i}@example.com`, classGrade: '1', sectionName: 'A', dateOfBirth: '2018-01-01', gender: 'MALE' });
    const res = await post('/bulk/import/students', { students: [row(1), row(2)] });
    expect(res.body).toEqual({ imported: 2, errors: [] });
  }, 60000);

  it('an accepted applicant can be enrolled', async () => {
    const enquiry = await post('/admission/enquiries', { studentName: 'New Child', parentName: 'P', parentPhone: '9000000000', classAppliedFor: 'Class 1', source: 'WALK_IN', academicSessionId: body.academicSessionId });
    expect(enquiry.status).toBe(201);
    const application = await post('/admission/applications', { enquiryId: enquiry.body.id, studentFirstName: 'New', studentLastName: `Child${RUN}`, dateOfBirth: '2018-01-01', gender: 'MALE' });
    expect(application.status).toBe(201);
    await request(app.getHttpServer()).patch(`${api}/admission/applications/${application.body.id}/process`).set({ Authorization: `Bearer ${token}` }).send({ status: 'ACCEPTED' }).expect(200);
    const enrolled = await post(`/admission/applications/${application.body.id}/enroll`, {});
    expect(enrolled.status).toBe(201);
    expect(enrolled.body.student.user.email).toContain('@school.local');
    expect((await prisma.student.findUnique({ where: { id: enrolled.body.student.id } }))!.schoolId).toBe(schoolId);
  }, 60000);
});
