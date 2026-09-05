// ─── Billing types — Phase 7 ──────────────────────────────────────────────────

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | 'OVERDUE';
export type InvoiceType   = 'ONE_TIME' | 'SUBSCRIPTION';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
export type BillingCycle  = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type ScheduleEntryStatus = 'UPCOMING' | 'INVOICED' | 'SKIPPED';

export interface InvoiceLineSnapshot {
  productName: string;
  productSku: string | null;
  category: string;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
  grossAmount: string;
  discountAmount: string;
  lineTotal: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  quotationId: string;
  customerId: string;
  subscriptionId: string | null;
  type: InvoiceType;
  status: InvoiceStatus;
  lineSnapshot: InvoiceLineSnapshot[];
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  dueDate: string;
  paidAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingScheduleEntry {
  id: string;
  subscriptionId: string;
  dueDate: string;
  amount: string;
  status: ScheduleEntryStatus;
  invoiceId: string | null;
  createdAt: string;
}

export interface Subscription {
  id: string;
  subscriptionNumber: string;
  quotationId: string;
  quotationLineId: string;
  customerId: string;
  productId: string;
  subscriptionPlanId: string | null;
  productName: string;
  billingCycle: BillingCycle;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
  taxRate: string;
  cycleAmount: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  lastProratedAmount: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  scheduleEntries?: BillingScheduleEntry[];
}

export interface BillingSummary {
  quotationId: string;
  invoice: Invoice | null;
  subscriptions: (Subscription & { scheduleEntries: BillingScheduleEntry[] })[];
}

export interface ProratePreview {
  proratedAmount: string;
  credit: string;
  newCharge: string;
  remainingDays: number;
}
