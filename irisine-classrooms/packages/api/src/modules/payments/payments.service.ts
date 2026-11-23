import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payments.dto';
import { paiseToRupees, rupeesToPaise } from './money';
import { verifyCheckoutSignature, verifyWebhookSignature } from './signature';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'IT_ADMIN'];
const REUSE_WINDOW_MS = 15 * 60_000;

interface AuthUser {
  sub: string;
  role: string;
  schoolId: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  // ── configuration ────────────────────────────────────────────────

  private get keyId() {
    return this.config.get<string>('RAZORPAY_KEY_ID');
  }
  private get keySecret() {
    return this.config.get<string>('RAZORPAY_KEY_SECRET');
  }
  private get webhookSecret() {
    return this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
  }

  // ── access control ───────────────────────────────────────────────

  /** Parents: only their linked children. Students: only themselves. Staff: their school. */
  async assertCanAccessStudent(user: AuthUser, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true, schoolId: true } },
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    let allowed = false;
    if (ADMIN_ROLES.includes(user.role)) {
      allowed = student.user.schoolId === user.schoolId;
    } else if (user.role === 'STUDENT') {
      allowed = student.userId === user.sub;
    } else if (user.role === 'PARENT') {
      const link = await this.prisma.guardian.findFirst({
        where: { userId: user.sub, studentId },
        select: { id: true },
      });
      allowed = !!link;
    }
    if (!allowed) throw new ForbiddenException('You cannot access this student’s fees');
    return student;
  }

  /** Student ids the user may see (for dues/history lists). */
  private async accessibleStudentIds(user: AuthUser): Promise<string[] | 'ALL_IN_SCHOOL'> {
    if (ADMIN_ROLES.includes(user.role)) return 'ALL_IN_SCHOOL';
    if (user.role === 'STUDENT') {
      const s = await this.prisma.student.findUnique({ where: { userId: user.sub }, select: { id: true } });
      return s ? [s.id] : [];
    }
    if (user.role === 'PARENT') {
      const g = await this.prisma.guardian.findMany({ where: { userId: user.sub }, select: { studentId: true } });
      return g.map((x) => x.studentId);
    }
    throw new ForbiddenException();
  }

  // ── dues (the "invoice" for a student + fee head) ────────────────

  /**
   * outstanding = fee head amount − approved concession − already paid/discounted.
   * Everything in integer paise.
   */
  async computeDue(studentId: string, feeHeadId: string) {
    const [student, feeHead] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: studentId }, select: { id: true, classId: true } }),
      this.prisma.feeHead.findUnique({ where: { id: feeHeadId } }),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    if (!feeHead || feeHead.classId !== student.classId) {
      throw new BadRequestException('This fee does not apply to the student');
    }

    const [payments, concessions] = await Promise.all([
      this.prisma.payment.findMany({
        where: { studentId, feeHeadId },
        select: { paidAmount: true, discount: true },
      }),
      this.prisma.concession.findMany({ where: { studentId, feeHeadId, status: 'APPROVED' } }),
    ]);

    const totalPaise = rupeesToPaise(feeHead.amount);
    let concessionPaise = 0;
    for (const c of concessions) {
      concessionPaise += c.discountAmount != null
        ? rupeesToPaise(c.discountAmount)
        : Math.round((totalPaise * (c.discountPercent ?? 0)) / 100);
    }
    concessionPaise = Math.min(concessionPaise, totalPaise);
    const paidPaise = payments.reduce(
      (sum, p) => sum + rupeesToPaise(p.paidAmount) + rupeesToPaise(p.discount),
      0,
    );
    const duePaise = Math.max(0, totalPaise - concessionPaise - paidPaise);
    return { feeHead, totalPaise, concessionPaise, paidPaise, duePaise };
  }

  async getDues(user: AuthUser, studentId?: string) {
    const scope = await this.accessibleStudentIds(user);
    let ids: string[];
    if (studentId) {
      await this.assertCanAccessStudent(user, studentId);
      ids = [studentId];
    } else if (scope === 'ALL_IN_SCHOOL') {
      throw new BadRequestException('studentId is required');
    } else {
      ids = scope;
    }

    const students = await this.prisma.student.findMany({
      where: { id: { in: ids } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });

    const result = [];
    for (const s of students) {
      const heads = await this.prisma.feeHead.findMany({ where: { classId: s.classId }, orderBy: { name: 'asc' } });
      const items = [];
      let total = 0, paid = 0, due = 0;
      for (const h of heads) {
        const d = await this.computeDue(s.id, h.id);
        total += d.totalPaise - d.concessionPaise;
        paid += d.paidPaise;
        due += d.duePaise;
        items.push({
          feeHeadId: h.id,
          name: h.name,
          frequency: h.frequency,
          dueDay: h.dueDay,
          total: paiseToRupees(d.totalPaise - d.concessionPaise),
          concession: paiseToRupees(d.concessionPaise),
          paid: paiseToRupees(d.paidPaise),
          due: paiseToRupees(d.duePaise),
          status: d.duePaise === 0 ? 'PAID' : d.paidPaise > 0 ? 'PARTIAL' : 'PENDING',
        });
      }
      result.push({
        student: {
          id: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`,
          admissionNo: s.admissionNo,
          class: s.class?.name,
          section: s.section?.name,
        },
        items,
        totals: { total: paiseToRupees(total), paid: paiseToRupees(paid), due: paiseToRupees(due) },
      });
    }
    return result;
  }

  // ── create order ─────────────────────────────────────────────────

  async createOrder(dto: CreateOrderDto, user: AuthUser) {
    if (!this.keyId || !this.keySecret) {
      throw new ServiceUnavailableException('Online payments are not configured');
    }
    const student = await this.assertCanAccessStudent(user, dto.studentId);
    const due = await this.computeDue(dto.studentId, dto.feeHeadId);
    if (due.duePaise <= 0) throw new BadRequestException('Nothing is due for this fee');

    // The amount comes from the server's own calculation; the client may only ask for less.
    const amountPaise = dto.amount ? rupeesToPaise(dto.amount) : due.duePaise;
    if (amountPaise < 100) throw new BadRequestException('Minimum online payment is ₹1');
    if (amountPaise > due.duePaise) {
      throw new BadRequestException(`Amount exceeds the outstanding ₹${paiseToRupees(due.duePaise)}`);
    }

    const checkout = (orderId: string) => ({
      orderId,
      amount: amountPaise,
      currency: 'INR',
      keyId: this.keyId,
      name: 'Irisine Classrooms',
      description: `${due.feeHead.name} - ${student.user.firstName} ${student.user.lastName}`,
    });

    // Double-click / retry safety: reuse a very recent identical open order.
    const recent = await this.prisma.paymentOrder.findFirst({
      where: {
        studentId: dto.studentId,
        feeHeadId: dto.feeHeadId,
        initiatedBy: user.sub,
        status: 'CREATED',
        amount: paiseToRupees(amountPaise),
        createdAt: { gt: new Date(Date.now() - REUSE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) return checkout(recent.razorpayOrderId);

    const localRef = randomBytes(8).toString('hex');
    const rz = await this.razorpayCreateOrder(amountPaise, `irs_${localRef}`, {
      studentId: dto.studentId,
      feeHeadId: dto.feeHeadId,
    });

    const order = await this.prisma.paymentOrder.create({
      data: {
        studentId: dto.studentId,
        feeHeadId: dto.feeHeadId,
        initiatedBy: user.sub,
        amount: paiseToRupees(amountPaise),
        currency: 'INR',
        razorpayOrderId: rz.id,
      },
    });
    await this.audit.log(user.sub, 'CREATE', 'PaymentOrder', order.id, {
      amount: paiseToRupees(amountPaise),
      studentId: dto.studentId,
      feeHeadId: dto.feeHeadId,
    });
    return checkout(rz.id);
  }

  private async razorpayCreateOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    let res: Response;
    try {
      res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
      });
    } catch {
      throw new ServiceUnavailableException('Payment provider is unreachable, please try again');
    }
    if (!res.ok) {
      this.logger.error(`Razorpay order creation failed (${res.status})`);
      throw new ServiceUnavailableException('Could not start the payment, please try again');
    }
    return (await res.json()) as { id: string };
  }

  // ── verify (frontend callback) ───────────────────────────────────

  async verifyPayment(dto: VerifyPaymentDto, user: AuthUser) {
    if (!this.keySecret) throw new ServiceUnavailableException('Online payments are not configured');

    const order = await this.prisma.paymentOrder.findUnique({
      where: { razorpayOrderId: dto.razorpay_order_id },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.assertCanAccessStudent(user, order.studentId);

    const ok = verifyCheckoutSignature(
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
      this.keySecret,
    );
    if (!ok) {
      await this.audit.log(user.sub, 'REJECT', 'PaymentOrder', order.id, { reason: 'bad signature' });
      throw new BadRequestException('Payment verification failed');
    }

    const done = await this.finalize(order.id, dto.razorpay_payment_id, undefined, user.sub);
    return { status: 'PAID', orderId: done.id, receiptNo: done.receiptNo, amount: done.amount.toString() };
  }

  /**
   * Mark an order paid exactly once and create the receipt (an existing `Payment` row).
   * Safe to call from both /verify and the webhook, in any order, any number of times.
   */
  async finalize(orderId: string, razorpayPaymentId: string, method?: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === 'PAID') return order; // already processed

      const receiptNo = `IRS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3)
        .toString('hex')
        .toUpperCase()}`;

      const claimed = await tx.paymentOrder.updateMany({
        where: { id: orderId, status: { not: 'PAID' } },
        data: {
          status: 'PAID',
          razorpayPaymentId,
          method: method ?? order.method,
          failureReason: null,
          paidAt: new Date(),
          receiptNo,
        },
      });
      if (claimed.count === 0) return (await tx.paymentOrder.findUnique({ where: { id: orderId } }))!;

      const before = await this.computeDueTx(tx, order.studentId, order.feeHeadId);
      const paid = Number(order.amount);
      const payment = await tx.payment.create({
        data: {
          studentId: order.studentId,
          feeHeadId: order.feeHeadId,
          amount: Number(paiseToRupees(before.totalPaise - before.concessionPaise)),
          paidAmount: paid,
          method: 'ONLINE',
          transactionId: razorpayPaymentId,
          receiptNo,
          status: rupeesToPaise(paid) >= before.duePaise ? 'PAID' : 'PARTIAL',
          paidAt: new Date(),
        },
      });

      if (rupeesToPaise(paid) >= before.duePaise) {
        await tx.defaulterRecord.updateMany({
          where: { studentId: order.studentId, feeHeadId: order.feeHeadId, status: 'ACTIVE' },
          data: { status: 'RESOLVED', resolvedAt: new Date() },
        });
      }

      const updated = await tx.paymentOrder.update({
        where: { id: orderId },
        data: { paymentId: payment.id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId ?? order.initiatedBy,
          action: 'CREATE',
          entity: 'Payment',
          entityId: payment.id,
          details: { orderId, receiptNo, amount: order.amount.toString(), via: actorId ? 'verify' : 'webhook' },
        },
      });
      return updated;
    });
  }

  private async computeDueTx(tx: any, studentId: string, feeHeadId: string) {
    // Same maths as computeDue(), but inside the transaction. The order being
    // finalised has not created its Payment row yet, so "before" is correct.
    const feeHead = await tx.feeHead.findUnique({ where: { id: feeHeadId } });
    const [payments, concessions] = await Promise.all([
      tx.payment.findMany({ where: { studentId, feeHeadId }, select: { paidAmount: true, discount: true } }),
      tx.concession.findMany({ where: { studentId, feeHeadId, status: 'APPROVED' } }),
    ]);
    const totalPaise = rupeesToPaise(feeHead.amount);
    let concessionPaise = 0;
    for (const c of concessions) {
      concessionPaise += c.discountAmount != null
        ? rupeesToPaise(c.discountAmount)
        : Math.round((totalPaise * (c.discountPercent ?? 0)) / 100);
    }
    concessionPaise = Math.min(concessionPaise, totalPaise);
    const paidPaise = payments.reduce(
      (s: number, p: any) => s + rupeesToPaise(p.paidAmount) + rupeesToPaise(p.discount),
      0,
    );
    return { totalPaise, concessionPaise, paidPaise, duePaise: Math.max(0, totalPaise - concessionPaise - paidPaise) };
  }

  // ── webhook ──────────────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer | undefined, signature: string, eventIdHeader?: string) {
    if (!this.webhookSecret) throw new ServiceUnavailableException('Webhook is not configured');
    if (!rawBody || !signature || !verifyWebhookSignature(rawBody, signature, this.webhookSecret)) {
      throw new BadRequestException('Invalid signature');
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const eventId = eventIdHeader || createHash('sha256').update(rawBody).digest('hex');

    // Idempotency: first writer wins, repeats are acknowledged and ignored.
    try {
      await this.prisma.paymentWebhookEvent.create({ data: { eventId, eventType: String(event.event) } });
    } catch (err: any) {
      if (err?.code === 'P2002') return { status: 'duplicate' };
      throw err;
    }

    try {
      const payment = event.payload?.payment?.entity;
      const razorpayOrderId: string | undefined = payment?.order_id ?? event.payload?.order?.entity?.id;
      if (!razorpayOrderId) return { status: 'ignored' };

      const order = await this.prisma.paymentOrder.findUnique({ where: { razorpayOrderId } });
      if (!order) return { status: 'unknown-order' };

      if (event.event === 'payment.captured' || event.event === 'order.paid') {
        if (!payment?.id) return { status: 'ignored' };
        if (Number(payment.amount) !== rupeesToPaise(order.amount.toString())) {
          this.logger.warn(`Webhook amount mismatch for order ${order.id}; not marking paid`);
          return { status: 'amount-mismatch' };
        }
        await this.finalize(order.id, payment.id, payment.method);
        return { status: 'processed' };
      }

      if (event.event === 'payment.failed') {
        // Never downgrade an order that already succeeded.
        await this.prisma.paymentOrder.updateMany({
          where: { id: order.id, status: { not: 'PAID' } },
          data: {
            status: 'FAILED',
            failureReason: String(payment?.error_description ?? 'Payment failed').slice(0, 250),
            method: payment?.method ?? order.method,
          },
        });
        return { status: 'processed' };
      }
      return { status: 'ignored' };
    } catch (err) {
      // Let Razorpay retry: forget the event so the retry is processed.
      await this.prisma.paymentWebhookEvent.deleteMany({ where: { eventId } });
      throw err;
    }
  }

  // ── reads ────────────────────────────────────────────────────────

  private async loadOrderFor(id: string, user: AuthUser) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, schoolId: true } },
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
        feeHead: { select: { name: true } },
      },
    });
    if (!order) throw new NotFoundException('Payment not found');
    await this.assertCanAccessStudent(user, order.studentId);
    return order;
  }

  async getOne(id: string, user: AuthUser) {
    const o = await this.loadOrderFor(id, user);
    return this.shape(o);
  }

  async getHistory(user: AuthUser, filters: { status?: string; studentId?: string }) {
    const scope = await this.accessibleStudentIds(user);
    if (filters.studentId) await this.assertCanAccessStudent(user, filters.studentId);

    const orders = await this.prisma.paymentOrder.findMany({
      where: {
        ...(filters.status && { status: filters.status }),
        ...(filters.studentId && { studentId: filters.studentId }),
        ...(scope === 'ALL_IN_SCHOOL'
          ? { student: { user: { schoolId: user.schoolId } } }
          : { studentId: { in: scope } }),
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            class: { select: { name: true } },
          },
        },
        feeHead: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return orders.map((o) => this.shape(o));
  }

  async getReceipt(id: string, user: AuthUser) {
    const o = await this.loadOrderFor(id, user);
    if (o.status !== 'PAID') throw new BadRequestException('Receipt is available only for paid orders');
    const school = await this.prisma.school.findUnique({
      where: { id: o.student.user.schoolId },
      select: { name: true, address: true, phone: true, email: true },
    });
    return {
      receiptNo: o.receiptNo,
      paidAt: o.paidAt,
      amount: o.amount.toString(),
      currency: o.currency,
      method: o.method,
      transactionId: o.razorpayPaymentId,
      feeHead: o.feeHead.name,
      student: {
        name: `${o.student.user.firstName} ${o.student.user.lastName}`,
        admissionNo: o.student.admissionNo,
        class: o.student.class?.name,
        section: o.student.section?.name,
      },
      school,
    };
  }

  private shape(o: any) {
    return {
      id: o.id,
      status: o.status,
      amount: o.amount.toString(),
      currency: o.currency,
      method: o.method,
      receiptNo: o.receiptNo,
      razorpayOrderId: o.razorpayOrderId,
      razorpayPaymentId: o.razorpayPaymentId,
      failureReason: o.failureReason,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      feeHead: o.feeHead?.name,
      student: o.student
        ? {
            id: o.studentId,
            name: `${o.student.user.firstName} ${o.student.user.lastName}`,
            class: o.student.class?.name,
          }
        : undefined,
    };
  }
}
