// Real backend SupportTicket shape + mapping logic, shared by the Topbar
// notification dropdown and the Support Tickets page.
import type { SupportTicketRecord } from '@/types';
import { ApiError } from '@/lib/api';

export interface ApiSupportTicket {
  id: string;
  raisedByType: 'customer' | 'vendor' | 'driver';
  raisedById: string;
  raisedByName: string;
  subject: string;
  description?: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in-progress' | 'resolved' | 'escalated';
  orderId?: string;
  createdAt: string;
  updatedAt: string;
}

export function mapTicket(t: ApiSupportTicket): SupportTicketRecord {
  return {
    id: t.id,
    subject: t.subject,
    raisedByName: t.raisedByName,
    raisedByType: t.raisedByType,
    category: t.category,
    priority: t.priority,
    status: t.status,
    description: t.description,
    orderId: t.orderId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
