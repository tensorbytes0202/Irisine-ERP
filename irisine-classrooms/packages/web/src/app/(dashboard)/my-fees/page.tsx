'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2, Receipt, XCircle } from 'lucide-react';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface DueItem {
  feeHeadId: string;
  name: string;
  frequency: string;
  dueDay: number | null;
  total: string;
  concession: string;
  paid: string;
  due: string;
  status: 'PAID' | 'PARTIAL' | 'PENDING';
}
interface StudentDues {
  student: { id: string; name: string; admissionNo: string; class?: string; section?: string };
  items: DueItem[];
  totals: { total: string; paid: string; due: string };
}
interface HistoryRow {
  id: string;
  status: 'CREATED' | 'PAID' | 'FAILED';
  amount: string;
  method?: string;
  receiptNo?: string;
  createdAt: string;
  paidAt?: string;
  feeHead?: string;
  failureReason?: string;
  student?: { name: string };
}

type Notice = { kind: 'success' | 'failure' | 'pending' | 'info'; text: string; orderId?: string } | null;

const rupee = (v: string) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}` });

function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const statusStyle: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  PENDING: 'bg-red-100 text-red-700',
  CREATED: 'bg-muted text-muted-foreground',
  FAILED: 'bg-red-100 text-red-700',
};

export default function MyFeesPage() {
  const [dues, setDues] = useState<StudentDues[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [partial, setPartial] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [d, h] = await Promise.all([
        fetch('/api/v1/payments/dues', { headers: authHeaders() }),
        fetch('/api/v1/payments/history', { headers: authHeaders() }),
      ]);
      if (!d.ok) throw new Error('Could not load your fees');
      setDues(await d.json());
      setHistory(h.ok ? await h.json() : []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function pay(studentId: string, item: DueItem) {
    const key = `${studentId}:${item.feeHeadId}`;
    if (busyKey) return; // duplicate click guard
    setBusyKey(key);
    setNotice(null);

    try {
      const ok = await loadCheckout();
      if (!ok) throw new Error('Could not load the payment window. Check your internet connection.');

      const amount = partial[key]?.trim();
      const res = await fetch('/api/v1/payments/create-order', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, feeHeadId: item.feeHeadId, ...(amount ? { amount } : {}) }),
      });
      const order = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(order.message) ? order.message[0] : order.message;
        throw new Error(msg || 'Could not start the payment');
      }

      await new Promise<void>((resolve) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: order.name,
          description: order.description,
          order_id: order.orderId,
          theme: { color: '#065F46' },
          handler: async (r: any) => {
            // Never trust this callback alone: the server verifies the signature.
            try {
              const v = await fetch('/api/v1/payments/verify', {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: r.razorpay_order_id,
                  razorpay_payment_id: r.razorpay_payment_id,
                  razorpay_signature: r.razorpay_signature,
                }),
              });
              const body = await v.json().catch(() => ({}));
              if (!v.ok) throw new Error('verify');
              setNotice({ kind: 'success', text: `Payment received. Receipt ${body.receiptNo}`, orderId: body.orderId });
            } catch {
              setNotice({
                kind: 'pending',
                text: 'We could not confirm your payment yet. If money was deducted, it will show here shortly. Please do not pay again.',
              });
            }
            resolve();
          },
          modal: {
            ondismiss: () => {
              setNotice((n) => n ?? { kind: 'info', text: 'Payment cancelled. You have not been charged.' });
              resolve();
            },
          },
        });
        rzp.on('payment.failed', (f: any) => {
          setNotice({ kind: 'failure', text: f?.error?.description || 'The payment failed. You can try again.' });
        });
        rzp.open();
      });
    } catch (e) {
      setNotice({ kind: 'failure', text: e instanceof Error ? e.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusyKey(null);
      load();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading fees...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">My Fees</h1>
        <p className="text-muted-foreground text-sm">Pay school fees online and see your payment history.</p>
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
            notice.kind === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : notice.kind === 'failure'
              ? 'bg-red-50 border-red-200 text-red-800'
              : notice.kind === 'pending'
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-muted'
          }`}
        >
          {notice.kind === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : notice.kind === 'failure' ? <XCircle className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
          <div className="flex-1">
            <p>{notice.text}</p>
            {notice.kind === 'success' && notice.orderId && (
              <Link href={`/receipt/${notice.orderId}`} className="mt-1 inline-block font-medium underline">
                View / download receipt
              </Link>
            )}
          </div>
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {loadError}{' '}
          <button className="underline" onClick={() => { setLoading(true); load(); }}>
            Retry
          </button>
        </div>
      )}

      {!loadError && dues.length === 0 && (
        <p className="text-muted-foreground">No students are linked to your account yet.</p>
      )}

      {dues.map((s) => (
        <section key={s.student.id} className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{s.student.name}</h2>
              <p className="text-sm text-muted-foreground">
                {s.student.class} {s.student.section} · Adm. {s.student.admissionNo}
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <div><p className="text-muted-foreground">Total</p><p className="font-semibold">{rupee(s.totals.total)}</p></div>
              <div><p className="text-muted-foreground">Paid</p><p className="font-semibold text-green-700">{rupee(s.totals.paid)}</p></div>
              <div><p className="text-muted-foreground">Pending</p><p className="font-semibold text-red-700">{rupee(s.totals.due)}</p></div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Fee</th>
                  <th className="py-2 pr-3 font-medium">Due date</th>
                  <th className="py-2 pr-3 font-medium text-right">Total</th>
                  <th className="py-2 pr-3 font-medium text-right">Paid</th>
                  <th className="py-2 pr-3 font-medium text-right">Pending</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Pay</th>
                </tr>
              </thead>
              <tbody>
                {s.items.map((i) => {
                  const key = `${s.student.id}:${i.feeHeadId}`;
                  const busy = busyKey === key;
                  return (
                    <tr key={i.feeHeadId} className="border-b last:border-0 align-middle">
                      <td className="py-3 pr-3 font-medium">{i.name}<span className="block text-xs text-muted-foreground">{i.frequency}</span></td>
                      <td className="py-3 pr-3 text-muted-foreground">{i.dueDay ? `${i.dueDay}th of the month` : '-'}</td>
                      <td className="py-3 pr-3 text-right">{rupee(i.total)}</td>
                      <td className="py-3 pr-3 text-right">{rupee(i.paid)}</td>
                      <td className="py-3 pr-3 text-right font-medium">{rupee(i.due)}</td>
                      <td className="py-3 pr-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[i.status]}`}>{i.status}</span></td>
                      <td className="py-3 text-right">
                        {i.status === 'PAID' ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <input
                              inputMode="decimal"
                              placeholder="Full"
                              aria-label="Amount to pay (leave empty for full)"
                              value={partial[key] ?? ''}
                              onChange={(e) => setPartial((p) => ({ ...p, [key]: e.target.value.replace(/[^\d.]/g, '') }))}
                              className="w-24 rounded-md border px-2 py-1 text-right"
                            />
                            <button
                              onClick={() => pay(s.student.id, i)}
                              disabled={!!busyKey}
                              className="rounded-md bg-primary px-4 py-1.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                            >
                              {busy ? 'Opening...' : 'Pay Now'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {s.items.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No fees have been set for this class yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Payment history</h2>
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Student</th>
                <th className="p-3 font-medium">Fee</th>
                <th className="p-3 font-medium text-right">Amount</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="p-3">{new Date(h.paidAt ?? h.createdAt).toLocaleString('en-IN')}</td>
                  <td className="p-3">{h.student?.name}</td>
                  <td className="p-3">{h.feeHead}</td>
                  <td className="p-3 text-right">{rupee(h.amount)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[h.status]}`}>
                      {h.status === 'CREATED' ? 'PENDING' : h.status}
                    </span>
                    {h.failureReason && <span className="block text-xs text-muted-foreground">{h.failureReason}</span>}
                  </td>
                  <td className="p-3">
                    {h.status === 'PAID' ? (
                      <Link href={`/receipt/${h.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Receipt className="h-4 w-4" /> {h.receiptNo}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No online payments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
