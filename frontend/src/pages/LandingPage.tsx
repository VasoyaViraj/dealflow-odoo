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
  // { label: 'Pricing', href: '#pricing' },
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
        <p className="type-eyebrow mb-5">QUOTE TO CASH, CONNECTED</p>
        <h1 className="type-display-lg md:!text-[56px] max-w-[19ch] mx-auto text-balance">
          The deal desk that runs itself.
        </h1>
        <p className="type-body-md md:text-base max-w-[58ch] mx-auto mt-6 text-subtle">
          Build, approve, fulfill, and bill every deal from one connected workspace.
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
          No card required · Demo workspace included
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



/* --- the signature coral band: the page's first voltage moment ----------- */
function CoralSignature() {
  return (
    <section className="bg-canvas">
      <div className="page-container py-section">
        <div className="card-coral p-8 md:p-12 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div>
            <p className="type-eyebrow !text-white/60">DISCOUNT GOVERNANCE</p>
            <h2 className="type-display-md !text-white mt-4 max-w-[16ch]">
              Approve the right discounts, automatically.
            </h2>
            <p className="text-[15px] leading-relaxed text-white/80 mt-5 max-w-[52ch]">
              DealFlow360 evaluates discount depth, customer tier, margin, and deal risk—then routes the quote to the right approver.
            </p>
            <ul className="mt-7 space-y-2.5">
              {[
                'Tier limits enforced automatically',
                'Manager and finance approval routing',
                'Complete decision history',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14px] text-white/85">
                  <Check size={16} className="mt-0.5 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <Link to="/login" className="btn btn-secondary mt-8">
              See approval routing
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
    title: 'Build quotes with margin in view.',
    body: 'Create quotes, adjust pricing, and see margin change instantly.',
    fragment: <QuoteBuilderFragment />,
  },
  {
    id: 'approve',
    label: 'Approval routing',
    icon: ShieldCheck,
    title: 'Know who needs to approve.',
    body: 'Discounts automatically route to the right approver based on your rules.',
    fragment: <ApprovalChainFragment />,
  },
  {
    id: 'fulfil',
    label: 'Fulfilment split',
    icon: Boxes,
    title: 'Turn orders into shipments.',
    body: 'Allocate inventory across warehouses and keep backorders visible.',
    fragment: <FulfillmentSplitFragment />,
  },
  {
    id: 'bill',
    label: 'Hybrid billing',
    icon: Repeat,
    title: 'One order. Multiple billing models.',
    body: 'Combine one-time products and recurring subscriptions in the same order.',
    fragment: <BillingScheduleFragment />,
  },
  {
    id: 'health',
    label: 'Deal health',
    icon: Activity,
    title: 'See which deals need attention.',
    body: 'Surface stalled deals, risky discounts, and fulfillment issues before they become problems.',
    fragment: <DealHealthFragment />,
  },
  {
    id: 'portal',
    label: 'Customer portal',
    icon: MessagesSquare,
    title: 'Negotiate without the email thread.',
    body: 'Customers review, negotiate, and confirm quotes from one shared workspace.',
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
          <p className="type-eyebrow mb-4">THE PLATFORM</p>
          <h2 className="type-display-md text-balance">
            Everything the deal needs, in one place.
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
                Open the demo workspace
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
    copy: 'Create the quote and see margin instantly.',
    surface: 'bg-peach text-ink',
    span: 'md:col-span-2',
  },
  {
    step: '02',
    title: 'Approve',
    copy: 'Route discounts to the right people automatically.',
    surface: 'bg-canvas border border-hairline text-ink',
    span: '',
  },
  {
    step: '03',
    title: 'Confirm',
    copy: 'Customer reviews and accepts in the portal.',
    surface: 'bg-forest text-white',
    span: '',
  },
  {
    step: '04',
    title: 'Fulfill',
    copy: 'Split inventory across warehouses automatically.',
    surface: 'bg-mint text-forest',
    span: '',
  },
  {
    step: '05',
    title: 'Bill',
    copy: 'Invoice products and manage subscriptions from one order.',
    surface: 'bg-cream text-ink',
    span: '',
  },
];

function WorkflowGrid() {
  return (
    <section id="workflow" className="bg-canvas">
      <div className="page-container pb-section">
        <div className="max-w-[46ch] mb-10">
          <p className="type-eyebrow mb-4">THE WORKFLOW</p>
          <h2 className="type-display-md text-balance">
            From quote to invoice, without the hand-offs.
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
    line: 'Builds quotes and manages discounts.',
  },
  {
    role: 'Sales manager',
    line: 'Approves deals and monitors pipeline.',
  },
  {
    role: 'Finance / ops',
    line: 'Handles risk, fulfillment, and billing.',
  },
  {
    role: 'Customer',
    line: 'Negotiates and confirms quotes.',
  },
  {
    role: 'Admin',
    line: 'Configures products, pricing, and rules.',
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
              <Link to="/login" className="btn btn-primary mt-8">
                Explore the roles
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
              <p className="type-eyebrow !text-white/50">DEAL HEALTH</p>
              <h2 className="type-display-md !text-white mt-4 text-balance max-w-[18ch]">
                Know which deals need attention.
              </h2>
              <p className="text-[15px] leading-relaxed text-white/75 mt-5 max-w-[52ch]">
                DealFlow360 surfaces stalled quotes, risky discounts, and fulfillment issues before they become lost deals.
              </p>
              <a href="#demo" className="btn btn-secondary mt-8">
                Open the demo
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

/* --- FAQ ----------------------------------------------------------------- */
const FAQS = [
  {
    q: 'How does approval routing work?',
    a: 'Discounts are evaluated against customer tiers, margin, and risk. Quotes that need approval are automatically routed to the right people.',
  },
  {
    q: 'Can one order mix hardware and subscriptions?',
    a: 'Yes. One-time products and recurring subscriptions can live on the same order, with each using the appropriate billing schedule.',
  },
  {
    q: 'What can customers do in the portal?',
    a: 'Customers can review quotes, comment, negotiate discounts, and confirm the final terms from one shared workspace.',
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
            <h2 className="type-display-md text-balance">Questions, answered.</h2>
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
            See DealFlow360 in action.
          </h2>
          <p className="type-body-md mt-4 max-w-[52ch] mx-auto">
            Explore a complete quote-to-cash workflow in the demo workspace.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/login" className="btn btn-primary btn-lg w-full sm:w-auto">
              Open demo workspace
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

function Footer() {
  return (
    <footer className="bg-canvas border-t border-hairline">
      <div className="page-container py-14">
        <div className="grid md:grid-cols-[1.4fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <DealFlowMark size={28} />
              <span className="text-[15px] font-medium text-ink tracking-tight">DealFlow360</span>
            </div>
            <p className="type-body-md mt-4 max-w-[34ch] text-subtle">
              Quote → Approval → Fulfillment → Billing
            </p>
          </div>

          <div>
            <ul className="space-y-2">
              <li><a href="#platform" className="text-[13px] text-subtle hover:text-ink transition-colors">Platform</a></li>
              <li><a href="#workflow" className="text-[13px] text-subtle hover:text-ink transition-colors">Workflow</a></li>
              <li><a href="#roles" className="text-[13px] text-subtle hover:text-ink transition-colors">Roles</a></li>
              <li className="pt-2"><a href="mailto:hello@dealflow360.app" className="text-[13px] text-subtle hover:text-ink transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-hairline flex flex-col sm:flex-row gap-3 justify-between">
          <p className="text-[13px] text-line-strong">
            © {new Date().getFullYear()} DealFlow360. Built for the Odoo hackathon.
          </p>
          <div className="flex gap-6">
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
        <CoralSignature />
        <FeatureTabs />
        <WorkflowGrid />
        <RolesBand />
        <DarkBand />

        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
