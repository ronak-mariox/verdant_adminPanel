// Real backend SupportTicket shape + mapping logic, shared by the Topbar
// notification dropdown and the Support Tickets page.
import type { SupportTicketRecord, TicketStatus } from '@/types';
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
  status: string;
  orderId?: string;
  notes?: { text: string; at: string }[];
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Older rows were stored as 'in-progress' before the backend switched to
// 'in_progress'; normalise so the UI only ever sees one spelling.
export function normalizeTicketStatus(status: string): TicketStatus {
  if (status === 'in-progress' || status === 'in_progress') return 'in_progress';
  if (status === 'resolved' || status === 'escalated') return status;
  return 'open';
}

export function mapTicket(t: ApiSupportTicket): SupportTicketRecord {
  return {
    id: t.id,
    subject: t.subject,
    raisedByName: t.raisedByName,
    raisedByType: t.raisedByType,
    category: t.category,
    priority: t.priority,
    status: normalizeTicketStatus(t.status),
    description: t.description,
    orderId: t.orderId,
    notes: t.notes ?? [],
    resolvedAt: t.resolvedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
