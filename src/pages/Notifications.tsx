import { useState } from 'react';
import { Bell, Plus, Users, Store, Bike, Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Drawer';
import { Field, Label } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { adminNotifications as seedNotifications } from '@/data/notifications';
import type { AdminNotification, NotificationAudience } from '@/types';
import { formatCompactNumber, timeAgo } from '@/lib/format';

const AUDIENCE_TONE: Record<NotificationAudience, 'brand' | 'violet' | 'indigo' | 'neutral'> = {
  customers: 'brand',
  vendors: 'violet',
  drivers: 'indigo',
  all: 'neutral',
};

const AUDIENCE_ICON: Record<NotificationAudience, typeof Users> = {
  customers: Users,
  vendors: Store,
  drivers: Bike,
  all: Megaphone,
};

const REACH_ESTIMATE: Record<NotificationAudience, number> = {
  customers: 48500,
  vendors: 312,
  drivers: 220,
  all: 53100,
};

const EMPTY_FORM = { title: '', body: '', audience: 'all' as NotificationAudience };

export function Notifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>(seedNotifications);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function handleSend() {
    if (!form.title.trim() || !form.body.trim()) return;
    const notification: AdminNotification = {
      id: `ntf-${Date.now()}`,
      title: form.title,
      body: form.body,
      audience: form.audience,
      sentAt: new Date().toISOString(),
      reach: REACH_ESTIMATE[form.audience],
    };
    setNotifications((list) => [notification, ...list]);
    setForm(EMPTY_FORM);
    setModalOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Broadcast announcements to customers, vendors and delivery partners"
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            New Announcement
          </Button>
        }
      />

      <Card>
        {notifications.length === 0 ? (
          <EmptyState icon={<Bell size={24} />} title="No announcements yet" description="Send your first broadcast to get started." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Announcement</Th>
                <Th>Audience</Th>
                <Th>Sent</Th>
                <Th className="text-right">Reach</Th>
              </Tr>
            </Thead>
            <tbody>
              {notifications.map((n) => {
                const Icon = AUDIENCE_ICON[n.audience];
                return (
                  <Tr key={n.id}>
                    <Td>
                      <div className="max-w-md">
                        <p className="font-semibold text-ink-800">{n.title}</p>
                        <p className="mt-0.5 truncate text-[12.5px] text-ink-500">{n.body}</p>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={AUDIENCE_TONE[n.audience]} className="capitalize">
                        <Icon size={12} />
                        {n.audience}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-500">{timeAgo(n.sentAt)}</Td>
                    <Td className="text-right font-semibold text-ink-800">{formatCompactNumber(n.reach)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Announcement"
        width={480}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend}>Send announcement</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Scheduled maintenance tonight"
              className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-800 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>
          <div>
            <Label>Message</Label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write the announcement body…"
              rows={4}
              className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <Label>Audience</Label>
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as NotificationAudience })}
              className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">Everyone</option>
              <option value="customers">Customers</option>
              <option value="vendors">Vendors</option>
              <option value="drivers">Drivers</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
