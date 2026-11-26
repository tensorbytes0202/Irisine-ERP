/**
 * Keeps every school inside its own data, for every module at once.
 *
 * While a request belongs to a school (see tenant-context.ts), this Prisma middleware
 *  - adds a school condition to every read, update and delete,
 *  - writes the caller's own schoolId into new and changed rows,
 *  - refuses (404) writes that point at another school's student, class, user, etc.
 *
 * Every model must have a rule below; the TypeScript type makes a missing one a build error.
 */
import { NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TenantStore, tenantContext } from './tenant-context';

type Where = Record<string, unknown>;
type ListName = 'students' | 'users' | 'classes' | 'sessions' | 'items' | 'contacts';
type Lists = (name: ListName) => Promise<string[]>;
type Rule = (schoolId: string, lists: Lists) => Where | Promise<Where>;

const nest = (path: string, leaf: Where): Where =>
  path.split('.').reduceRight<Where>((inner, key) => ({ [key]: inner }), leaf);

/** The model has its own schoolId column. */
const own: Rule = (schoolId) => ({ schoolId });
/** The school is reached through relations, ending at a model with a schoolId column. */
const via = (path: string): Rule => (schoolId) => nest(path, { schoolId });
/** The model only stores a plain id (no relation in the schema): match it against the school's ids. */
const ref = (field: string, list: ListName, path?: string): Rule => async (_schoolId, lists) => {
  const leaf = { [field]: { in: await lists(list) } };
  return path ? nest(path, leaf) : leaf;
};
/** Not school data. */
const GLOBAL = null;

const student = via('student.user');
const inClass = via('class');
const ofStudent = ref('studentId', 'students');
const ofUser = (field: string) => ref(field, 'users');
const ofClass = ref('classId', 'classes');

export const TENANT_RULES: Record<Prisma.ModelName, Rule | null> = {
  School: (schoolId) => ({ id: schoolId }),
  AcademicSession: own,
  User: own,
  RefreshToken: via('user'),
  Class: own,
  Section: inClass,
  Subject: inClass,
  TeacherSubject: via('subject.class'),
  Student: via('user'),
  Guardian: student,
  AdmissionEnquiry: ref('academicSessionId', 'sessions'),
  AdmissionApplication: ref('academicSessionId', 'sessions'),
  AdmissionDocument: ref('academicSessionId', 'sessions', 'application'),
  Attendance: student,
  Syllabus: inClass,
  Chapter: via('syllabus.class'),
  Topic: via('chapter.syllabus.class'),
  LessonPlan: via('chapter.syllabus.class'),
  Timetable: inClass,
  TimetableSlot: via('timetable.class'),
  LmsContent: inClass,
  Assignment: via('subject.class'),
  AssignmentSubmission: via('assignment.subject.class'),
  LessonDelivery: via('teacher'),
  QuestionBank: via('subject.class'),
  Question: via('bank.subject.class'),
  Assessment: inClass,
  AssessmentQuestion: via('assessment.class'),
  AssessmentSubmission: via('assessment.class'),
  Grade: student,
  ReportCard: student,
  SubjectResult: via('reportCard.student.user'),
  Hobby: own,
  HobbyEnrollment: via('hobby'),
  HobbySession: via('hobby'),
  HobbyAttendance: via('session.hobby'),
  PTMSlot: inClass,
  PTMBooking: student,
  Conversation: own,
  Message: via('conversation'),
  Notification: via('user'),
  FeeHead: inClass,
  FeeStructure: inClass,
  FeeStructureFeeHead: via('feeStructure.class'),
  Payment: student,
  Concession: student,
  DefaulterRecord: student,
  Incident: student,
  DisciplinaryAction: via('incident.student.user'),
  RedFlag: student,
  Vehicle: own,
  Route: own,
  Stop: via('route'),
  BusAssignment: student,
  BoardingLog: student,
  TeacherAttendance: ofUser('teacherId'),
  LeaveApplication: ofUser('applicantId'),
  StudentDocument: ofStudent,
  StudentLeave: ofStudent,
  ExamSchedule: ofClass,
  ExamScheduleEntry: ref('classId', 'classes', 'schedule'),
  SubstituteAssignment: ofClass,
  CalendarEvent: own,
  SystemSetting: own,
  AuditLog: ofUser('userId'),
  Promotion: ofStudent,
  Announcement: own,
  PeriodAttendance: ofStudent,
  ResultPublication: ofClass,
  RemedialEnrollment: ofStudent,
  GraceMark: ofStudent,
  TransferCertificate: ofStudent,
  LibraryBook: own,
  LibraryIssue: via('book'),
  VisitorLog: own,
  HealthRecord: ofStudent,
  HealthIncident: ofStudent,
  InventoryItem: own,
  InventoryLog: ref('itemId', 'items'),
  TransportBilling: ofStudent,
  PasswordResetToken: GLOBAL,
  EmailOtp: GLOBAL,
  PaymentOrder: student,
  PaymentWebhookEvent: GLOBAL,
  Feedback: ofUser('fromUserId'),
  Certificate: ofStudent,
  SchoolRoom: own,
  RoomBooking: via('room'),
  MeetingMinutes: own,
  ActivityLog: ofStudent,
  HostelRoom: own,
  HostelAllocation: via('room'),
  HostelFee: ofStudent,
  PayrollRecord: ofUser('userId'),
  SalaryStructure: own,
  DiaryEntry: ofUser('createdBy'),
  SchoolEvent: own,
  EventRegistration: via('event'),
  Grievance: own,
  IdCard: ofUser('userId'),
  MessageLog: ref('recipient', 'contacts'),
  Expense: own,
  Budget: own,
  StaffProfile: ofUser('userId'),
  GalleryAlbum: own,
  GalleryPhoto: via('album'),
  Alumni: own,
  AcademicTransition: own,
  Survey: own,
  SurveyQuestion: via('survey'),
  SurveyResponse: via('survey'),
  CourseModule: ofClass,
  CourseModuleItem: ref('classId', 'classes', 'module'),
  ModuleItemCompletion: ref('classId', 'classes', 'item.module'),
  DiscussionForum: ofClass,
  DiscussionPost: ref('classId', 'classes', 'forum'),
  Badge: own,
  BadgeAward: via('badge'),
  StudentPoints: ofStudent,
  Leaderboard: ofStudent,
  LearningPath: own,
  LearningPathStep: via('path'),
  LearningPathEnrollment: via('path'),
  Rubric: own,
  RubricCriterion: via('rubric'),
  RubricLevel: via('criterion.rubric'),
  RubricAssessment: ofStudent,
  LiveClass: own,
  LiveClassAttendance: via('liveClass'),
  TeachingSession: ofClass,
  TopicCoverageLog: ref('classId', 'classes', 'session'),
  Feature: GLOBAL,
  SchoolFeature: own,
  AccountInvite: ofUser('userId'),
  PlatformAdmin: GLOBAL,
};

/** Plain id columns (no relation in the schema) and the model they point to. */
const PERSON: Prisma.ModelName[] = ['User', 'Student'];
const LOOSE_IDS: Record<string, Prisma.ModelName[]> = {
  studentId: ['Student'],
  classId: ['Class'], fromClassId: ['Class'], toClassId: ['Class'],
  sectionId: ['Section'], fromSectionId: ['Section'], toSectionId: ['Section'],
  subjectId: ['Subject'],
  academicSessionId: ['AcademicSession'], fromSessionId: ['AcademicSession'], toSessionId: ['AcademicSession'],
  userId: ['User'], teacherId: ['User'], originalTeacherId: ['User'], substituteTeacherId: ['User'],
  applicantId: PERSON, borrowerId: PERSON, respondentId: PERSON, authorId: PERSON,
  toUserId: ['User'], fromUserId: ['User'], invigilatorId: ['User'],
  assessmentId: ['Assessment'], assignmentId: ['Assignment'], timetableSlotId: ['TimetableSlot'],
  rubricId: ['Rubric'], routeId: ['Route'], vehicleId: ['Vehicle'], topicId: ['Topic'],
  moduleId: ['CourseModule'], moduleItemId: ['CourseModuleItem'], prerequisiteModuleId: ['CourseModule'],
  bookId: ['LibraryBook'], itemId: ['InventoryItem'],
};

type Field = Prisma.DMMF.Field;
const FIELDS = new Map<string, Map<string, Field>>(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, new Map(m.fields.map((f) => [f.name, f as Field]))]),
);
/** "Model.column" -> the model that column's relation points to */
const RELATION_TARGET = new Map<string, Prisma.ModelName>();
for (const model of Prisma.dmmf.datamodel.models) {
  for (const f of model.fields) {
    for (const column of f.relationFromFields ?? []) RELATION_TARGET.set(`${model.name}.${column}`, f.type as Prisma.ModelName);
  }
}

const delegate = (client: PrismaClient, model: string) => (client as any)[model[0].toLowerCase() + model.slice(1)];
const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

export function tenantMiddleware(client: PrismaClient): Prisma.Middleware {
  const loaders: Record<ListName, (schoolId: string) => Promise<string[]>> = {
    students: async (schoolId) => ids(await client.student.findMany({ where: { user: { schoolId } }, select: { id: true } })),
    users: async (schoolId) => ids(await client.user.findMany({ where: { schoolId }, select: { id: true } })),
    classes: async (schoolId) => ids(await client.class.findMany({ where: { schoolId }, select: { id: true } })),
    sessions: async (schoolId) => ids(await client.academicSession.findMany({ where: { schoolId }, select: { id: true } })),
    items: async (schoolId) => ids(await client.inventoryItem.findMany({ where: { schoolId }, select: { id: true } })),
    // message logs only know the address a message went to
    contacts: async (schoolId) => {
      const [users, guardians] = await Promise.all([
        client.user.findMany({ where: { schoolId }, select: { email: true, phone: true } }),
        client.guardian.findMany({ where: { student: { user: { schoolId } } }, select: { email: true, phone: true } }),
      ]);
      return [...users, ...guardians].flatMap((c) => [c.email, c.phone]).filter((v): v is string => !!v);
    },
  };
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
  /** Writing to one of these models changes these lists. */
  const STALE: Partial<Record<Prisma.ModelName, ListName[]>> = {
    User: ['users', 'contacts'], Student: ['students'], Class: ['classes'], AcademicSession: ['sessions'],
    InventoryItem: ['items'], Guardian: ['contacts'],
  };

  const listsFor = (store: TenantStore, schoolId: string): Lists => (name) => {
    let list = store.lists.get(name);
    if (!list) {
      list = tenantContext.allSchools(() => loaders[name](schoolId));
      store.lists.set(name, list);
    }
    return list;
  };

  return async (params, next) => {
    const store = tenantContext.store();
    const schoolId = store?.schoolId;
    const model = params.model as Prisma.ModelName | undefined;
    if (!store || !schoolId || !model) return next(params);

    const lists = listsFor(store, schoolId);
    const rule = TENANT_RULES[model];

    /** 404 when `id` exists but belongs to another school. Unknown ids are left to the database. */
    async function refuseForeign(target: Prisma.ModelName, id: unknown) {
      const targetRule = TENANT_RULES[target];
      if (!targetRule || typeof id !== 'string' || !id) return;
      // Already seen as the caller's own: no extra query. Inside a transaction an extra query
      // needs a second connection, and many requests doing that at once block each other.
      if (store!.own.has(`${target}:${id}`)) return;
      const mine = await targetRule(schoolId!, lists);
      const foreign = await tenantContext.allSchools<unknown>(() =>
        delegate(client, target).findFirst({ where: { id, NOT: mine }, select: { id: true } }),
      );
      if (foreign) throw new NotFoundException(`${target} not found`);
    }

    /** Checks (and completes) the data of a create or update, nested writes included. */
    async function guardData(name: Prisma.ModelName, data: any, isCreate: boolean) {
      if (!data || typeof data !== 'object') return;
      const fields = FIELDS.get(name)!;

      for (const [key, raw] of Object.entries<any>(data)) {
        // schoolId is replaced with the caller's own below, so there is nothing to look up
        if (raw === undefined || raw === null || key === 'schoolId') continue;
        const field = fields.get(key);
        if (!field) continue;

        if (field.kind === 'object') {
          const target = field.type as Prisma.ModelName;
          for (const item of asArray<any>(raw.create)) await guardData(target, item, true);
          for (const item of asArray<any>(raw.createMany?.data)) await guardData(target, item, true);
          for (const item of asArray<any>(raw.connect)) await refuseForeign(target, item.id);
          for (const item of asArray<any>(raw.connectOrCreate)) {
            await refuseForeign(target, item.where?.id);
            await guardData(target, item.create, true);
          }
          for (const item of asArray<any>(raw.upsert)) {
            await guardData(target, item.create, true);
            await guardData(target, item.update, false);
          }
          for (const item of asArray<any>(raw.update)) await guardData(target, item.data ?? item, false);
          continue;
        }

        const value = typeof raw === 'object' && 'set' in raw ? raw.set : raw;
        const relation = RELATION_TARGET.get(`${name}.${key}`);
        for (const target of relation ? [relation] : LOOSE_IDS[key] ?? []) await refuseForeign(target, value);
      }

      // the school of a row is always the caller's own, whatever the request said
      if (!fields.has('schoolId')) return;
      if (!isCreate) {
        if (data.schoolId !== undefined) data.schoolId = schoolId;
        return;
      }
      const school = fields.get('school');
      const writesRelations = Object.keys(data).some((k) => fields.get(k)?.relationFromFields?.length);
      if (school && writesRelations) {
        // Prisma's "relation" input style does not accept the schoolId column
        data.school = { connect: { id: schoolId } };
      } else {
        data.schoolId = schoolId;
      }
    }

    const args: any = (params.args ??= {});
    const action = params.action as string;

    if (action === 'create' || action === 'createMany') {
      for (const item of asArray<any>(args.data)) await guardData(model, item, true);
    } else {
      if (rule) {
        const mine = await rule(schoolId, lists);
        args.where = { ...args.where, AND: [...asArray<Where>(args.where?.AND as Where), mine] };
      }
      if (action === 'update' || action === 'updateMany') await guardData(model, args.data, false);
      if (action === 'upsert') {
        await guardData(model, args.create, true);
        await guardData(model, args.update, false);
      }
    }

    const result = await next(params);
    if (!/^(find|count|aggregate|groupBy)/.test(action)) for (const list of STALE[model] ?? []) store.lists.delete(list);
    // only the rows themselves: they passed the school filter above
    for (const row of asArray<any>(result)) if (typeof row?.id === 'string') store.own.add(`${model}:${row.id}`);
    return result;
  };
}
