'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Printer } from 'lucide-react';

interface ReceiptData {
  receiptNo: string;
  paidAt: string;
  amount: string;
  currency: string;
  method?: string;
  transactionId?: string;
  feeHead: string;
  student: { name: string; admissionNo: string; class?: string; section?: string };
  school?: { name: string; address?: string; phone?: string; email?: string } | null;
}

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/v1/payments/receipt/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Receipt not available');
        setData(await r.json());
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Network error'));
  }, [id]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading receipt...</div>;

  const rows: [string, string | undefined][] = [
    ['Receipt No.', data.receiptNo],
    ['Date', new Date(data.paidAt).toLocaleString('en-IN')],
    ['Student', data.student.name],
    ['Admission No.', data.student.admissionNo],
    ['Class', `${data.student.class ?? ''} ${data.student.section ?? ''}`.trim()],
    ['Fee', data.feeHead],
    ['Payment method', data.method?.toUpperCase()],
    ['Transaction ID', data.transactionId],
  ];

  return (
    <div className="max-w-xl">
      <div className="mb-4 flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Printer className="h-4 w-4" /> Download / Print
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-8 text-slate-900 shadow-sm print:border-0 print:shadow-none">
        <div className="border-b pb-4 text-center">
          <h1 className="text-xl font-bold text-emerald-900">{data.school?.name ?? 'School'}</h1>
          {data.school?.address && <p className="text-sm text-slate-500">{data.school.address}</p>}
          <p className="mt-2 inline-block rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-800">
            PAYMENT RECEIPT
          </p>
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right font-medium break-all">{v || '-'}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
          <span className="font-medium text-emerald-900">Amount paid</span>
          <span className="text-xl font-bold text-emerald-900">
            ₹{Number(data.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">This is a computer generated receipt.</p>
      </div>
    </div>
  );
}
