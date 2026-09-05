export interface Customer {
  id: string;
  name: string;
  email: string;
  tier: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  unitPrice: string;
  description: string | null;
}

export interface QuotationLine {
  id: string;
  lineNumber: number;
  productId: string;
  productName: string;
  productSku: string | null;
  category: string;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
  grossAmount: string;
  discountAmount: string;
  lineTotal: string;
  margin: string;
  marginPercent: string;
  maxDiscountPercent: string;
  isOverDiscountLimit: boolean;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  status: string;
  notes: string | null;
  customerId: string;
  customer: Customer;
  salesRepId: string;
  quotationDiscountPercent: string;
  subtotal: string;
  lineDiscountAmount?: string;
  quotationDiscountAmount?: string;
  discountAmount: string;
  taxableAmount?: string;
  taxAmount: string;
  grandTotal: string;
  margin: string;
  marginPercent: string;
  blendedRiskScore: string;
  requiresApproval: boolean;
  requiredApprovalLevel: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines: QuotationLine[];
}
