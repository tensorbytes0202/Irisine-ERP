/**
 * Applies access-policy.ts to a signed-in request and keeps students and parents to their own
 * records. Runs inside JwtStrategy, after the school filter is set, so every route is covered.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SELF_ONLY, isFamily, mayCall, routeKey } from './access-policy';

export interface Caller {
  sub: string;
  role: string;
}

/** Request fields that name a student. A student or parent may only name their own. */
const STUDENT_FIELDS = ['studentId'];
/** Request fields that name the person acting. */
const ACTOR_FIELDS = ['userId', 'authorId', 'respondentId', 'fromUserId', 'submittedBy', 'applicantId', 'appliedBy'];

const deny = (message = 'You do not have access to this') => new ForbiddenException(message);

export async function enforceAccess(prisma: PrismaService, req: any, caller: Caller) {
  const routePath: string = req.route?.path ?? req.path ?? '';
  const method: string = req.method;
  if (!mayCall(caller.role, method, routePath)) throw deny();

  const route = routeKey(routePath);
  const call = `${method} ${route}`;
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  // nobody writes a post in someone else's name
  if (body.authorId && body.authorId !== caller.sub) throw deny('You can only post as yourself');

  const selfOnly = SELF_ONLY[call];
  if (selfOnly && !selfOnly.unless.includes(caller.role) && req.params?.[selfOnly.param] !== caller.sub) {
    throw deny('You can only view your own record');
  }

  if (!isFamily(caller.role)) return;

  const students = await prisma.student.findMany({
    where: caller.role === 'STUDENT' ? { userId: caller.sub } : { guardians: { some: { userId: caller.sub } } },
    select: { id: true, classId: true },
  });
  const own = students.map((s) => s.id);

  for (const source of [req.params, req.query, body]) {
    if (!source) continue;
    for (const field of STUDENT_FIELDS) {
      if (source[field] !== undefined && !own.includes(source[field])) throw deny('You can only use your own records');
    }
    for (const field of ACTOR_FIELDS) {
      if (source[field] !== undefined && source[field] !== caller.sub) throw deny('You can only act for yourself');
    }
  }
  if (route === 'students/:id' && !own.includes(req.params.id)) throw deny('You can only view your own records');

  // lists are narrowed to what is meant for this person
  if (call === 'GET announcements') req.query.isPublished = 'true';
  if (call === 'GET assignments') {
    req.query.isPublished = 'true';
    if (!students.some((s) => s.classId === req.query.classId)) {
      if (!students.length) throw deny('No student record is linked to this account');
      req.query.classId = students[0].classId;
    }
  }
  if (call === 'GET certificates' && !req.query.studentId) {
    if (!own.length) throw deny('No student record is linked to this account');
    req.query.studentId = own[0];
  }
  if (call === 'GET feedback') req.query.fromUserId = caller.sub;

  // single records must belong to this person (published ones for school-wide items)
  const id = req.params?.id;
  const missing = () => new NotFoundException('Record not found');
  if (id && route.startsWith('certificates/:id')) {
    if (!(await prisma.certificate.findFirst({ where: { id, studentId: { in: own } }, select: { id: true } }))) throw missing();
  }
  if (id && route === 'grievances/:id') {
    if (!(await prisma.grievance.findFirst({ where: { id, submittedBy: caller.sub }, select: { id: true } }))) throw missing();
  }
  if (id && route === 'assignments/:id') {
    const classes = students.map((s) => s.classId);
    const found = await prisma.assignment.findFirst({ where: { id, isPublished: true, classId: { in: classes } }, select: { id: true } });
    if (!found) throw missing();
  }
  if (id && call === 'GET announcements/:id') {
    if (!(await prisma.announcement.findFirst({ where: { id, isPublished: true }, select: { id: true } }))) throw missing();
  }
}
