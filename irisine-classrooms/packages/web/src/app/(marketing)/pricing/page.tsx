import Link from 'next/link';
import { Check } from 'lucide-react';
import { brand } from '@/lib/brand';

const plans = [
  {
    name: 'Self-hosted',
    price: 'Free',
    note: 'Open source (AGPL-3.0)',
    points: [
      'Run it on your own server',
      'All core classroom features',
      'You manage hosting, backups and updates',
      'If you offer a modified version to others, share its source code',
    ],
    cta: 'Sign In to the demo',
    href: '/login',
    highlight: false,
  },
  {
    name: 'Managed by us',
    price: 'Not available yet',
    note: 'Pricing to be announced',
    points: [
      'We host and maintain it for you',
      'Setup help and support',
      `Write to ${brand.supportEmail} to ask about early access`,
    ],
    cta: 'Contact us',
    href: `mailto:${brand.supportEmail}`,
    highlight: true,
  },
];

const faqs = [
  {
    q: 'Is there a free trial?',
    a: 'You can sign in to the demo school to look around. A managed trial is not available yet.',
  },
  {
    q: 'Can I switch features on or off?',
    a: 'Yes. Extra modules such as hostel, transport or payroll are built in but hidden by default and can be turned on by the administrator of your deployment.',
  },
  {
    q: 'Is the source code open?',
    a: `Yes. ${brand.name} is open source under the GNU AGPL-3.0, so you can run and adapt it for your school.`,
  },
];

export default function PricingPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
          <p className="mt-4 text-lg text-muted-foreground">Simple and honest. No hidden numbers.</p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 grid gap-6 md:grid-cols-2">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border bg-card p-8 shadow-sm ${p.highlight ? 'ring-2 ring-primary' : ''}`}
            >
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-3 text-3xl font-bold">{p.price}</p>
              <p className="text-sm text-muted-foreground">{p.note}</p>
              <ul className="mt-6 space-y-3">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                    {pt}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`mt-8 block rounded-full py-2.5 text-center font-semibold transition-colors ${
                  p.highlight
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border hover:bg-accent'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-center mb-8">Questions</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-xl border bg-card p-5">
                <h3 className="font-semibold">{f.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
