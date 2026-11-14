import type { FormSchema, FormValues, LineItem, QuoteSchema, TenderType } from '@/lib/types';

export interface WorkOrder {
  id: string;
  code: string;
  status: 'active' | 'completed' | 'cancelled';
  amount: number;
  created_at: string;
  tender: {
    id: string; code: string; title: string; description: string | null; category_name: string; tender_type: TenderType;
    form_data: FormValues; form_schema: FormSchema | null; address: string | null; area_label: string | null; city_name: string;
    pincode: string | null; start_date: string | null;
  };
  quote: {
    id: string; line_items: LineItem[]; extra: FormValues; gst_percent: number; subtotal: number; gst_amount: number; total: number;
    timeline_days: number | null; warranty_months: number | null; payment_terms: string | null; notes: string | null;
  };
  buyer: { name: string | null; phone: string | null; email: string | null };
  vendor: { business_name: string; gstin: string | null; contact_name: string | null; phone: string | null; email: string | null; verified: boolean };
  quote_schema?: QuoteSchema | null;
}
