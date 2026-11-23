'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Receipt } from 'lucide-react';

interface Row {
  id: string;
  status: 'CREATED' | 'PAID' | 'FAILED';
  amount: string;
  method?: string;
  receiptNo?: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  createdAt: string;
  paidAt?: string;
  feeHead?: string;
  failureReason?: string;
  student?: { name: string; class?: string };
}

const rupee = (v: string | number) =>
  `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const badge: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  CREATED: 'bg-yellow-100 text-yellow-700',
};

export default function OnlinePaymentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = status ? `?status=${status}` : '';
      const res = await fetch(`/api/v1/payments/history${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}` },
      });
      if (!res.ok) throw new Error('Could not load payments');
      setRows(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const collected = rows.filter((r) => r.status === 'PAID').reduce((s, r) => s + Math.round(Number(r.amount) * 100), 0) / 100;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Online Payments</h1>
          <p className="text-sm text-muted-foreground">Razorpay transactions for your school.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Collected (shown)</p>
            <p className="text-lg font-semibold text-green-700">{rupee(collected)}</p>
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="PAID">Paid</option>
            <option value="CREATED">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error} <button className="underline" onClick={load}>Retry</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium">Student</th>
              <th className="p-3 font-medium">Fee</th>
              <th className="p-3 font-medium text-right">Amount</th>
              <th className="p-3 font-medium">Method</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Transaction</th>
              <th className="p-3 font-medium">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading...</td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-3 whitespace-nowrap">{new Date(r.paidAt ?? r.createdAt).toLocaleString('en-IN')}</td>
                <td className="p-3">{r.student?.name}<span className="block text-xs text-muted-foreground">{r.student?.class}</span></td>
                <td className="p-3">{r.feeHead}</td>
                <td className="p-3 text-right font-medium">{rupee(r.amount)}</td>
                <td className="p-3 uppercase">{r.method ?? '-'}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[r.status]}`}>
                    {r.status === 'CREATED' ? 'PENDING' : r.status}
                  </span>
                  {r.failureReason && <span className="block text-xs text-muted-foreground">{r.failureReason}</span>}
                </td>
                <td className="p-3 font-mono text-xs">{r.razorpayPaymentId ?? r.razorpayOrderId}</td>
                <td className="p-3">
                  {r.status === 'PAID' ? (
                    <Link href={`/receipt/${r.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Receipt className="h-4 w-4" /> {r.receiptNo}
                    </Link>
                  ) : '-'}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && !error && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No online payments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
