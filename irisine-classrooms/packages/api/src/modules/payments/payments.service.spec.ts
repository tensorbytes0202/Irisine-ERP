import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentsService } from './payments.service';
import { paiseToRupees, rupeesToPaise } from './money';

const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

function sign(orderId: string, paymentId: string) {
  return createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}

function build(opts: { guardian?: boolean; payments?: any[]; concessions?: any[]; feeAmount?: number } = {}) {
  const orders = new Map<string, any>();
  const events = new Set<string>();
  const createdPayments: any[] = [];

  const prisma: any = {
    student: {
      findUnique: jest.fn(async () => ({
        id: 's1',
        userId: 'u-student',
        classId: 'c1',
        admissionNo: 'A1',
        user: { firstName: 'Aarav', lastName: 'Singh', schoolId: 'sch1' },
        class: { name: 'Class 10' },
        section: { name: 'A' },
      })),
    },
    guardian: { findFirst: jest.fn(async () => (opts.guardian === false ? null : { id: 'g1' })) },
    feeHead: {
      findUnique: jest.fn(async () => ({ id: 'f1', classId: 'c1', name: 'Tuition', amount: opts.feeAmount ?? 1000 })),
    },
    payment: {
      findMany: jest.fn(async () => opts.payments ?? []),
      create: jest.fn(async ({ data }: any) => {
        createdPayments.push(data);
        return { id: 'pay' + createdPayments.length, ...data };
      }),
    },
    concession: { findMany: jest.fn(async () => opts.concessions ?? []) },
    defaulterRecord: { updateMany: jest.fn(async () => ({ count: 0 })) },
    auditLog: { create: jest.fn(async () => ({})) },
    paymentOrder: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => {
        const o = { id: 'o' + (orders.size + 1), status: 'CREATED', ...data };
        orders.set(o.id, o);
        return o;
      }),
      findUnique: jest.fn(async ({ where }: any) =>
        where.id
          ? orders.get(where.id) ?? null
          : [...orders.values()].find((o) => o.razorpayOrderId === where.razorpayOrderId) ?? null,
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const o = orders.get(where.id);
        if (!o) return { count: 0 };
        if (where.status?.not && o.status === where.status.not) return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(orders.get(where.id), data)),
    },
    paymentWebhookEvent: {
      create: jest.fn(async ({ data }: any) => {
        if (events.has(data.eventId)) throw Object.assign(new Error('dup'), { code: 'P2002' });
        events.add(data.eventId);
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        events.delete(where.eventId);
      }),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const config: any = {
    get: (k: string) =>
      (({ RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET }) as any)[k],
  };
  const audit: any = { log: jest.fn(async () => ({})) };
  const service = new PaymentsService(prisma, config, audit);
  return { service, prisma, orders, createdPayments, audit };
}

const parent = { sub: 'u-parent', role: 'PARENT', schoolId: 'sch1' };
const student = { sub: 'u-student', role: 'STUDENT', schoolId: 'sch1' };

beforeEach(() => {
  (global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ id: 'order_RZP1' }) }));
});

describe('money', () => {
  it('uses integer paise without float drift', () => {
    expect(rupeesToPaise('2500.50')).toBe(250050);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(paiseToRupees(250005)).toBe('2500.05');
  });
});

describe('invoice balance calculation', () => {
  it('subtracts concessions, payments and discounts', async () => {
    const { service } = build({
      feeAmount: 1000,
      payments: [
        { paidAmount: 200, discount: 50 },
        { paidAmount: 100.5, discount: 0 },
      ],
      concessions: [{ discountPercent: 10, discountAmount: null }],
    });
    const d = await service.computeDue('s1', 'f1');
    expect(d.concessionPaise).toBe(10000);
    expect(d.paidPaise).toBe(35050);
    expect(d.duePaise).toBe(54950); // 1000 - 100 - 350.50
  });
});

describe('create order', () => {
  it('creates an order for the full outstanding amount', async () => {
    const { service, orders } = build();
    const res = await service.createOrder({ studentId: 's1', feeHeadId: 'f1' }, parent);
    expect(res).toMatchObject({ orderId: 'order_RZP1', amount: 100000, currency: 'INR', keyId: 'rzp_test_x' });
    expect(orders.size).toBe(1);
    expect(JSON.stringify(res)).not.toContain(KEY_SECRET);
  });

  it('supports partial payments but never more than is due', async () => {
    const { service } = build();
    await expect(
      service.createOrder({ studentId: 's1', feeHeadId: 'f1', amount: '400.00' }, parent),
    ).resolves.toMatchObject({ amount: 40000 });
    await expect(
      service.createOrder({ studentId: 's1', feeHeadId: 'f1', amount: '1000.01' }, parent),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invoice that does not belong to the student (invalid invoice)', async () => {
    const { service, prisma } = build();
    prisma.feeHead.findUnique.mockResolvedValueOnce({ id: 'f9', classId: 'OTHER', name: 'X', amount: 10 });
    await expect(service.createOrder({ studentId: 's1', feeHeadId: 'f9' }, parent)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a parent who is not linked to the student (unauthorized)', async () => {
    const { service } = build({ guardian: false });
    await expect(service.createOrder({ studentId: 's1', feeHeadId: 'f1' }, parent)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects when nothing is due', async () => {
    const { service } = build({ payments: [{ paidAmount: 1000, discount: 0 }] });
    await expect(service.createOrder({ studentId: 's1', feeHeadId: 'f1' }, student)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reuses a recent identical open order on double click', async () => {
    const { service, prisma } = build();
    prisma.paymentOrder.findFirst.mockResolvedValueOnce({ razorpayOrderId: 'order_EXISTING' });
    const res = await service.createOrder({ studentId: 's1', feeHeadId: 'f1' }, parent);
    expect(res.orderId).toBe('order_EXISTING');
    expect((global as any).fetch).not.toHaveBeenCalled();
  });
});

describe('verify payment', () => {
  async function withOrder() {
    const ctx = build();
    await ctx.service.createOrder({ studentId: 's1', feeHeadId: 'f1' }, parent);
    return ctx;
  }

  it('rejects an incorrect signature and records nothing', async () => {
    const { service, createdPayments, orders } = await withOrder();
    await expect(
      service.verifyPayment(
        { razorpay_order_id: 'order_RZP1', razorpay_payment_id: 'pay_1', razorpay_signature: 'deadbeef' },
        parent,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createdPayments).toHaveLength(0);
    expect(orders.get('o1').status).toBe('CREATED');
  });

  it('accepts a correct signature, creates the receipt and marks the order paid', async () => {
    const { service, createdPayments, orders } = await withOrder();
    const res = await service.verifyPayment(
      { razorpay_order_id: 'order_RZP1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_RZP1', 'pay_1') },
      parent,
    );
    expect(res.status).toBe('PAID');
    expect(res.receiptNo).toMatch(/^IRS-\d{8}-[0-9A-F]{6}$/);
    expect(orders.get('o1').status).toBe('PAID');
    expect(createdPayments).toHaveLength(1);
    expect(createdPayments[0]).toMatchObject({ method: 'ONLINE', transactionId: 'pay_1', paidAmount: 1000, status: 'PAID' });
  });

  it('does not double count when verified twice (duplicate payment)', async () => {
    const { service, createdPayments } = await withOrder();
    const body = {
      razorpay_order_id: 'order_RZP1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: sign('order_RZP1', 'pay_1'),
    };
    await service.verifyPayment(body, parent);
    await service.verifyPayment(body, parent);
    expect(createdPayments).toHaveLength(1);
  });

  it('refuses another parent', async () => {
    const { service, prisma } = await withOrder();
    prisma.guardian.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.verifyPayment(
        { razorpay_order_id: 'order_RZP1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_RZP1', 'pay_1') },
        parent,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('webhook', () => {
  const body = (event: string, extra: any = {}) =>
    Buffer.from(
      JSON.stringify({
        event,
        payload: { payment: { entity: { id: 'pay_W1', order_id: 'order_RZP1', amount: 100000, method: 'upi', ...extra } } },
      }),
    );
  const sig = (raw: Buffer) => createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');

  async function withOrder() {
    const ctx = build();
    await ctx.service.createOrder({ studentId: 's1', feeHeadId: 'f1' }, parent);
    return ctx;
  }

  it('rejects a bad webhook signature', async () => {
    const { service } = await withOrder();
    await expect(service.handleWebhook(body('payment.captured'), 'nope', 'evt1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('marks the order paid on payment.captured', async () => {
    const { service, orders, createdPayments } = await withOrder();
    const raw = body('payment.captured');
    await expect(service.handleWebhook(raw, sig(raw), 'evt1')).resolves.toEqual({ status: 'processed' });
    expect(orders.get('o1')).toMatchObject({ status: 'PAID', method: 'upi' });
    expect(createdPayments).toHaveLength(1);
  });

  it('ignores a duplicate event id (idempotent)', async () => {
    const { service, createdPayments } = await withOrder();
    const raw = body('payment.captured');
    await service.handleWebhook(raw, sig(raw), 'evt1');
    await expect(service.handleWebhook(raw, sig(raw), 'evt1')).resolves.toEqual({ status: 'duplicate' });
    expect(createdPayments).toHaveLength(1);
  });

  it('does not double count when verify and a new webhook event both arrive', async () => {
    const { service, createdPayments } = await withOrder();
    await service.verifyPayment(
      { razorpay_order_id: 'order_RZP1', razorpay_payment_id: 'pay_W1', razorpay_signature: sign('order_RZP1', 'pay_W1') },
      parent,
    );
    const raw = body('payment.captured');
    await service.handleWebhook(raw, sig(raw), 'evt2');
    expect(createdPayments).toHaveLength(1);
  });

  it('records a failed payment but never downgrades a paid order', async () => {
    const { service, orders } = await withOrder();
    const failed = body('payment.failed', { error_description: 'Card declined' });
    await service.handleWebhook(failed, sig(failed), 'evt3');
    expect(orders.get('o1')).toMatchObject({ status: 'FAILED', failureReason: 'Card declined' });

    const ok = body('payment.captured');
    await service.handleWebhook(ok, sig(ok), 'evt4');
    expect(orders.get('o1').status).toBe('PAID');
    const late = body('payment.failed', { error_description: 'late' });
    await service.handleWebhook(late, sig(late), 'evt5');
    expect(orders.get('o1').status).toBe('PAID');
  });

  it('refuses to mark paid when the captured amount differs', async () => {
    const { service, createdPayments } = await withOrder();
    const raw = body('payment.captured', { amount: 100 });
    await expect(service.handleWebhook(raw, sig(raw), 'evt6')).resolves.toEqual({ status: 'amount-mismatch' });
    expect(createdPayments).toHaveLength(0);
  });
});
