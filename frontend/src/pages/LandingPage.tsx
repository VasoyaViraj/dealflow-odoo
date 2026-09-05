import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Menu,
  X,
  ShieldCheck,
  Sparkles,
  Boxes,
  Repeat,
  Activity,
  MessagesSquare,
  Minus,
  Plus,
} from 'lucide-react';
import { DealFlowMark } from '../components/layout/AppShell';
import {
  QuoteBuilderFragment,
  ApprovalChainFragment,
  FulfillmentSplitFragment,
  BillingScheduleFragment,
  DealHealthFragment,
  PortalThreadFragment,
} from '../components/landing/Mockups';

/* ---------------------------------------------------------------------------
   Landing page.

   Band rhythm follows design.md: white canvas → coral signature card → white
   body → cream callout → dark navy CTA → light-grey CTA banner → footer, with
   96px of vertical air between every major band and no two consecutive bands
   sharing a surface. The hero is deliberately calm — white, no gradient.
   ------------------------------------------------------------------------ */

const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Roles', href: '#roles' },
  { label: 'Pricing', href: '#pricing' },
];

function TopNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-canvas transition-shadow ${
        scrolled ? 'border-b border-hairline' : 'border-b border-transparent'
      }`}
    >
      <div className="page-container h-16 flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <DealFlowMark size={28} />
          <span className="text-[15px] font-medium text-ink tracking-tight">DealFlow360</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-body hover:text-ink transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden md:flex items-center gap-3">
          <a href="#demo" className="btn btn-secondary btn-sm">
            Book demo
          </a>
          <Link to="/login" className="btn btn-primary btn-sm">
            Sign in
          </Link>
        </div>

        <button
          className="ml-auto md:hidden btn btn-ghost btn-sm"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile menu opens as a full sheet rather than a dropdown */}
      {open && (
        <div className="md:hidden border-t border-hairline bg-canvas px-6 py-6 space-y-1">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-[15px] text-body"
            >
              {l.label}
            </a>
          ))}
          <div className="pt-4 flex flex-col gap-2">
            <Link to="/login" className="btn btn-primary" onClick={() => setOpen(false)}>
              Sign in
            </Link>
            <a href="#demo" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Book demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-canvas">
      <div className="page-container pt-16 pb-12 md:pt-24 md:pb-16 text-center">
        <p className="type-eyebrow mb-5">Quote to cash, self-governing</p>
        <h1 className="type-display-lg md:!text-[56px] max-w-[19ch] mx-auto text-balance">
          The deal desk that runs itself.
        </h1>
        <p className="type-body-md md:text-base max-w-[58ch] mx-auto mt-6 text-subtle">
          DealFlow360 turns a quotation into a living record — discounts routed to the
          right approver, stock split across warehouses, hardware and subscriptions
          reconciled on one order, and a customer who negotiates in the portal instead
          of over email.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/login" className="btn btn-primary btn-lg w-full sm:w-auto">
            Get started free
            <ArrowRight size={16} />
          </Link>
          <a href="#demo" className="btn btn-secondary btn-lg w-full sm:w-auto">
            Book a demo
          </a>
        </div>
        <p className="text-[13px] text-line-strong mt-4">
          No card required · Demo workspace seeded with live data
        </p>
      </div>

      {/* Hero artefact: the product itself, not an illustration of it */}
      <div className="page-container pb-16 md:pb-24">
        <div className="bg-soft border border-hairline rounded-lg p-3 md:p-6">
          <div className="grid md:grid-cols-[1.35fr_1fr] gap-3 md:gap-5 items-start">
            <QuoteBuilderFragment />
            <div className="grid gap-3 md:gap-5 content-start">
              <ApprovalChainFragment />
              <FulfillmentSplitFragment />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const LOGOS = [
  'NORTHWIND',
  'ARCLIGHT',
  'MERIDIAN',
  'KESTREL',
  'BLUEHARBOR',
  'VANTA WORKS',
  'HELIOSTAT',
  'ORBIT SUPPLY',
];

function LogoStrip() {
  return (
    <section className="bg-canvas border-y border-hairline overflow-hidden">
      <div className="page-container py-8">
        <p className="text-center type-caption text-line-strong mb-6">
          Built for revenue teams who sell hardware, services and subscriptions on the same order
        </p>
      </div>
      <div className="pb-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="df-marquee-track gap-14 pr-14">
          {[...LOGOS, ...LOGOS].map((l, i) => (
            <span
              key={`${l}-${i}`}
              className="text-[15px] font-medium tracking-[0.16em] text-line-strong whitespace-nowrap"
            >
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- the signature coral band: the page's first voltage moment ----------- */
function CoralSignature() {
  return (
    <section className="bg-canvas">
      <div className="page-container py-section">
        <div className="card-coral p-8 md:p-12 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div>
            <p className="type-eyebrow !text-white/60">Discount governance</p>
            <h2 className="type-display-md !text-white mt-4 max-w-[16ch]">
              Pricing discipline that doesn't need a chaperone.
            </h2>
            <p className="text-[15px] leading-relaxed text-white/80 mt-5 max-w-[52ch]">
              Every quotation is scored the moment a discount lands on it — customer tier,
              depth of the cut, margin left on the line, how far it strays from the last
              ten deals like it. The chain assembles itself: nothing for a 5% nudge, a
              manager at 15%, finance when the risk score says so.
            </p>
            <ul className="mt-7 space-y-2.5">
              {[
                'Tier ceilings enforced at the line, not the footer',
                'Two-step routing with a full decision trail',
                'Anomaly alerts before a deal closes, not after',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14px] text-white/85">
                  <Check size={16} className="mt-0.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <Link to="/login" className="btn btn-secondary mt-8">
              See the approval engine
              <ArrowRight size={15} />
            </Link>
          </div>
          <div className="bg-white/8 rounded-md p-4">
            <ApprovalChainFragment />
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- tabbed feature card ------------------------------------------------- */
const TABS = [
  {
    id: 'quote',
    label: 'Quotation builder',
    icon: Sparkles,
    title: 'Build the quote with the margin in view.',
    body:
      'Line-level pricing, tier discounts and live upsell suggestions sit in the same pane. Every change re-scores the margin bar in real time, so a rep sees the cost of a concession while making it — not in a review meeting a week later.',
    fragment: <QuoteBuilderFragment />,
  },
  {
    id: 'approve',
    label: 'Approval routing',
    icon: ShieldCheck,
    title: 'The chain assembles itself.',
    body:
      'Thresholds are configuration, not tribal knowledge. A quotation that breaches a tier ceiling routes to a manager; one that also trips the risk model picks up finance as a second step. Approvers see the risk factors that summoned them.',
    fragment: <ApprovalChainFragment />,
  },
  {
    id: 'fulfil',
    label: 'Fulfilment split',
    icon: Boxes,
    title: 'Stock reality, not stock fiction.',
    body:
      'Confirmed orders split across warehouses by live availability, with a backorder remainder that stays visible on the deal. Operations can override the proposed split by hand and the order keeps one reconciled view.',
    fragment: <FulfillmentSplitFragment />,
  },
  {
    id: 'bill',
    label: 'Hybrid billing',
    icon: Repeat,
    title: 'Hardware and subscriptions, one order.',
    body:
      'One-time lines invoice on confirmation while recurring lines open their own schedule. Mid-cycle seat changes prorate against the period already paid for, and credits land on the same order instead of a spreadsheet.',
    fragment: <BillingScheduleFragment />,
  },
  {
    id: 'health',
    label: 'Deal health',
    icon: Activity,
    title: 'Find the stalled deal while it can still move.',
    body:
      'Pipeline, stalled quotations and discount anomalies surface on one board. Managers see momentum leaving a deal in time to act, rather than reading about it in a lost-deal post-mortem.',
    fragment: <DealHealthFragment />,
  },
  {
    id: 'portal',
    label: 'Customer portal',
    icon: MessagesSquare,
    title: 'Let the customer negotiate in the document.',
    body:
      'Customers open a live quotation, ask questions at the line, counter a discount and accept a revision in one click. Every exchange stays attached to the record, so the thread and the terms never drift apart.',
    fragment: <PortalThreadFragment />,
  },
];

function FeatureTabs() {
  const [active, setActive] = useState(TABS[0].id);
  const tab = TABS.find((t) => t.id === active)!;

  return (
    <section id="platform" className="bg-canvas">
      <div className="page-container pb-section">
        <div className="max-w-[46ch] mb-10">
          <p className="type-eyebrow mb-4">The platform</p>
          <h2 className="type-display-md text-balance">
            Six surfaces. One record underneath all of them.
          </h2>
        </div>

        <div className="card-soft p-4 md:p-8 grid lg:grid-cols-[260px_1fr] gap-6 lg:gap-10">
          {/* Tab rail — stacks above the pane on mobile */}
          <div
            role="tablist"
            aria-label="Platform surfaces"
            className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible -mx-1 px-1 pb-1 lg:pb-0"
          >
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = t.id === active;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(t.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-3 rounded-md text-left text-[15px] whitespace-nowrap transition-colors ${
                    on
                      ? 'bg-canvas text-ink font-medium border border-hairline'
                      : 'text-subtle border border-transparent hover:text-ink'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="type-title-lg text-balance">{tab.title}</h3>
              <p className="type-body-md mt-4 leading-relaxed">{tab.body}</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-link hover:text-link-active mt-6"
              >
                Open it in the demo workspace
                <ArrowRight size={14} />
              </Link>
            </div>
            <div>{tab.fragment}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- demo-card grid on the signature pastels ----------------------------- */
const WORKFLOW_CARDS = [
  {
    step: '01',
    title: 'Build',
    copy: 'Rep drafts a quotation, applies tier pricing, takes the upsell the margin bar suggests.',
    surface: 'bg-peach text-ink',
    span: 'md:col-span-2',
  },
  {
    step: '02',
    title: 'Route',
    copy: 'Discount depth and risk score decide who signs, and in what order.',
    surface: 'bg-canvas border border-hairline text-ink',
    span: '',
  },
  {
    step: '03',
    title: 'Confirm',
    copy: 'Customer accepts in the portal. The quotation becomes an order without a re-key.',
    surface: 'bg-forest text-white',
    span: '',
  },
  {
    step: '04',
    title: 'Split',
    copy: 'Stock allocates across warehouses; the shortfall stays on the record as a backorder.',
    surface: 'bg-mint text-forest',
    span: '',
  },
  {
    step: '05',
    title: 'Bill',
    copy: 'One-time lines invoice now, recurring lines open a schedule, proration handles the rest.',
    surface: 'bg-cream text-ink',
    span: '',
  },
];

function WorkflowGrid() {
  return (
    <section id="workflow" className="bg-canvas">
      <div className="page-container pb-section">
        <div className="max-w-[46ch] mb-10">
          <p className="type-eyebrow mb-4">The workflow</p>
          <h2 className="type-display-md text-balance">
            From first line to first invoice, without a hand-off.
          </h2>
        </div>

        {/* Card heights are deliberately uneven — a uniform grid reads as a spec sheet */}
        <div className="grid md:grid-cols-3 gap-6">
          {WORKFLOW_CARDS.map((c) => (
            <article
              key={c.step}
              className={`rounded-md p-6 flex flex-col ${c.surface} ${c.span}`}
            >
              <span className="text-[12px] font-semibold tracking-[0.09em] opacity-60">
                {c.step}
              </span>
              <h3 className="text-[22px] font-normal mt-3 leading-tight">{c.title}</h3>
              <p className="text-[14px] leading-relaxed mt-2.5 opacity-80 max-w-[42ch]">
                {c.copy}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- cream callout band -------------------------------------------------- */
const ROLES = [
  {
    role: 'Sales rep',
    line: 'Builds and defends the number, sees margin move as they concede.',
  },
  {
    role: 'Sales manager',
    line: 'Approves against a policy, and watches deal health instead of inboxes.',
  },
  {
    role: 'Finance / ops',
    line: 'Owns second-level risk, warehouse splits and recurring reconciliation.',
  },
  {
    role: 'Customer',
    line: 'Negotiates inside the quotation and confirms terms in a single click.',
  },
  {
    role: 'Admin',
    line: 'Configures products, price lists, tiers, warehouses and subscription plans.',
  },
];

function RolesBand() {
  return (
    <section id="roles" className="bg-canvas">
      <div className="page-container pb-section">
        <div className="card-cream p-8 md:p-12">
          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-16">
            <div>
              <p className="type-eyebrow mb-4">Roles</p>
              <h2 className="type-display-md text-balance max-w-[16ch]">
                Five people, one thread, no re-keying.
              </h2>
              <p className="type-body-md mt-5 max-w-[46ch]">
                Permissions are not a bolt-on. Each role opens the platform onto the part of
                the deal it owns, and every action any of them takes lands on the same record.
              </p>
              <Link to="/login" className="btn btn-primary mt-8">
                Try each role in the demo
                <ArrowRight size={15} />
              </Link>
            </div>

            <dl className="divide-y divide-ink/10">
              {ROLES.map((r) => (
                <div key={r.role} className="py-4 grid sm:grid-cols-[150px_1fr] gap-1 sm:gap-6">
                  <dt className="text-[15px] font-medium text-ink">{r.role}</dt>
                  <dd className="text-[14px] leading-relaxed text-ink/70">{r.line}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- dark navy signature card -------------------------------------------- */
function DarkBand() {
  return (
    <section className="bg-canvas">
      <div className="page-container pb-section">
        <div className="card-dark p-8 md:p-12">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
            <div>
              <p className="type-eyebrow !text-white/50">Deal health</p>
              <h2 className="type-display-md !text-white mt-4 text-balance max-w-[18ch]">
                The path to catching a deal before it goes quiet.
              </h2>
              <p className="text-[15px] leading-relaxed text-white/75 mt-5 max-w-[52ch]">
                Stalled quotations, discounts drifting past their tier ceiling, orders waiting
                on stock that never arrived — the board surfaces the three that need a person
                today, not the forty that are fine.
              </p>
              <a href="#pricing" className="btn btn-secondary mt-8">
                See what's included
              </a>
            </div>
            <div className="bg-white/8 rounded-md p-4">
              <DealHealthFragment />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- pricing sub-system: Inter Display weights, pill CTAs ---------------- */
const PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    note: 'Up to 3 seats',
    featured: false,
    features: [
      'Quotation builder & PDF',
      'Single-step approvals',
      'One warehouse',
      'One-time invoicing',
    ],
    cta: 'Start free',
  },
  {
    name: 'Team',
    price: '₹2,400',
    note: 'per seat / month',
    featured: true,
    features: [
      'Everything in Starter',
      'Two-step approval routing',
      'Multi-warehouse splitting',
      'Hybrid & recurring billing',
      'Customer negotiation portal',
    ],
    cta: 'Start free trial',
  },
  {
    name: 'Business',
    price: '₹4,100',
    note: 'per seat / month',
    featured: false,
    features: [
      'Everything in Team',
      'Risk scoring & anomaly alerts',
      'Custom approval chains',
      'Deal-health analytics',
    ],
    cta: 'Start free trial',
  },
  {
    name: 'Enterprise',
    price: 'Talk to us',
    note: 'Annual agreement',
    featured: false,
    features: [
      'Everything in Business',
      'SSO & audit export',
      'Dedicated environment',
      'Implementation support',
    ],
    cta: 'Contact sales',
  },
];

function Pricing() {
  return (
    <section id="pricing" className="bg-canvas">
      <div className="page-container pb-section">
        <div className="text-center max-w-[52ch] mx-auto mb-12">
          <p className="type-eyebrow mb-4">Pricing</p>
          <h2 className="text-[clamp(28px,4vw,44.8px)] font-[475] leading-[1.15] text-ink">
            Priced per seat. Governed per deal.
          </h2>
          <p className="type-body-md mt-4">
            Every plan includes the full quote-to-cash record. Higher tiers add the governance
            and analytics that larger desks need.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-md p-8 flex flex-col border ${
                p.featured ? 'bg-soft border-hairline' : 'bg-canvas border-hairline'
              }`}
            >
              <p className="text-[20px] font-[475] text-ink leading-tight">{p.name}</p>
              <p className="text-[clamp(30px,3vw,44.8px)] font-[475] text-ink leading-none mt-5">
                {p.price}
              </p>
              <p className="text-[13px] text-subtle mt-2">{p.note}</p>

              <ul className="mt-7 space-y-2.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14px] text-body">
                    <Check size={15} className="mt-0.5 shrink-0 text-ink" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to="/login"
                className={`btn btn-pill mt-8 w-full ${
                  p.featured ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- FAQ ----------------------------------------------------------------- */
const FAQS = [
  {
    q: 'How does approval routing decide who signs?',
    a: 'Routing reads the discount depth against the customer tier ceiling, the margin left on the order, and a risk score built from how far the deal strays from comparable ones. A modest discount clears automatically; a breach picks up a manager; a breach plus a high risk score adds finance as a second step.',
  },
  {
    q: 'What happens when stock only partly covers an order?',
    a: 'The order splits across warehouses by live availability and the remainder stays on the record as an explicit backorder rather than disappearing. Operations can override the proposed split by hand, and the order keeps a single reconciled view of what shipped from where.',
  },
  {
    q: 'Can one order mix hardware and subscriptions?',
    a: 'Yes — that is the point of the hybrid billing model. One-time lines invoice on confirmation while recurring lines open their own schedule. Mid-cycle quantity changes prorate against the period already paid for and settle on the same order.',
  },
  {
    q: 'What can a customer actually do in the portal?',
    a: 'Open the live quotation, ask a question against a specific line, counter a discount, and accept a revision in one click. Each exchange is attached to the record, so the negotiation and the terms never drift apart in an email thread.',
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-canvas">
      <div className="page-container pb-section">
        <div className="grid lg:grid-cols-[1fr_1.6fr] gap-10 lg:gap-16">
          <div>
            <p className="type-eyebrow mb-4">Questions</p>
            <h2 className="type-display-md text-balance">The things people ask first.</h2>
          </div>
          <div className="border-t border-hairline">
            {FAQS.map((f, i) => (
              <div key={f.q} className="border-b border-hairline">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="w-full flex items-start justify-between gap-6 py-5 text-left"
                >
                  <span className="text-[17px] text-ink leading-snug">{f.q}</span>
                  <span className="mt-1 shrink-0 text-subtle">
                    {open === i ? <Minus size={16} /> : <Plus size={16} />}
                  </span>
                </button>
                {open === i && (
                  <p className="type-body-md pb-6 max-w-[68ch] leading-relaxed">{f.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- light-grey CTA banner ----------------------------------------------- */
function CtaBand() {
  return (
    <section id="demo" className="bg-canvas">
      <div className="page-container pb-section">
        <div className="bg-strong rounded-lg p-8 md:p-12 text-center">
          <h2 className="type-display-md text-balance max-w-[20ch] mx-auto">
            Start building with DealFlow360.
          </h2>
          <p className="type-body-md mt-4 max-w-[52ch] mx-auto">
            The demo workspace is seeded with real quotations, approvals, split shipments and
            billing schedules. Pick a role and walk the whole deal in five minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/login" className="btn btn-primary btn-lg w-full sm:w-auto">
              Open the demo workspace
              <ArrowRight size={16} />
            </Link>
            <a href="mailto:hello@dealflow360.app" className="btn btn-secondary btn-lg w-full sm:w-auto">
              Talk to the team
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

const FOOTER_COLUMNS = [
  {
    title: 'Platform',
    links: ['Quotation builder', 'Approval routing', 'Fulfilment split', 'Hybrid billing'],
  },
  { title: 'Solutions', links: ['Hardware & services', 'Subscriptions', 'Distribution', 'Field ops'] },
  { title: 'Resources', links: ['Docs', 'API reference', 'Changelog', 'Status'] },
  { title: 'Company', links: ['About', 'Careers', 'Contact', 'Security'] },
];

function Footer() {
  return (
    <footer className="bg-canvas border-t border-hairline">
      <div className="page-container py-14">
        <div className="grid md:grid-cols-[1.4fr_repeat(4,1fr)] gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <DealFlowMark size={28} />
              <span className="text-[15px] font-medium text-ink tracking-tight">DealFlow360</span>
            </div>
            <p className="type-body-md mt-4 max-w-[34ch] text-subtle">
              An intelligent, self-governing sales operations platform for quote-to-cash.
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-[13px] font-medium text-ink mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#platform" className="text-[13px] text-subtle hover:text-ink transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-hairline flex flex-col sm:flex-row gap-3 justify-between">
          <p className="text-[13px] text-line-strong">
            © {new Date().getFullYear()} DealFlow360. Built for the Odoo hackathon.
          </p>
          <div className="flex gap-6">
            {['Privacy', 'Terms', 'Cookies'].map((l) => (
              <a key={l} href="#platform" className="text-[13px] text-subtle hover:text-ink transition-colors">
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-canvas min-h-screen">
      <TopNav />
      <main>
        <Hero />
        <LogoStrip />
        <CoralSignature />
        <FeatureTabs />
        <WorkflowGrid />
        <RolesBand />
        <DarkBand />
        <Pricing />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
