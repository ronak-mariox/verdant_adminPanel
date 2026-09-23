import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Field, Input, Label } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Drawer';
import { cn } from '@/lib/cn';

type SettingsTab = 'general' | 'commission' | 'notifications' | 'team';

const TAB_ITEMS: TabItem[] = [
  { value: 'general', label: 'General' },
  { value: 'commission', label: 'Commission & Fees' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'team', label: 'Team & Roles' },
];

type Role = 'Owner' | 'Admin' | 'Manager' | 'Support' | 'Viewer';

const ROLE_TONE: Record<Role, 'brand' | 'violet' | 'indigo' | 'teal' | 'neutral'> = {
  Owner: 'brand',
  Admin: 'violet',
  Manager: 'indigo',
  Support: 'teal',
  Viewer: 'neutral',
};

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastActive: string;
  avatarColor: string;
}

const SEED_TEAM: TeamMember[] = [
  { id: 'tm-1', name: 'Ananya Bose', email: 'ananya.bose@verdant.app', role: 'Owner', lastActive: 'Active now', avatarColor: '#1CA672' },
  { id: 'tm-2', name: 'Rohan Gupta', email: 'rohan.gupta@verdant.app', role: 'Admin', lastActive: '2h ago', avatarColor: '#3B82F6' },
  { id: 'tm-3', name: 'Kavita Iyer', email: 'kavita.iyer@verdant.app', role: 'Manager', lastActive: '1d ago', avatarColor: '#7C3AED' },
  { id: 'tm-4', name: 'Sameer Khan', email: 'sameer.khan@verdant.app', role: 'Support', lastActive: '3d ago', avatarColor: '#F79009' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-brand-600' : 'bg-ink-200',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink-100 py-4 last:border-0">
      <div>
        <p className="text-sm font-medium text-ink-800">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-500">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function Settings() {
  const [tab, setTab] = useState<SettingsTab>('general');
  const [saved, setSaved] = useState(false);

  const [general, setGeneral] = useState({
    platformName: 'Verdant',
    supportEmail: 'support@verdant.app',
    supportPhone: '+91 98765 43210',
  });

  const [fees, setFees] = useState({
    commissionRate: '12',
    deliveryFee: '25',
    platformFee: '5',
  });

  const [notifPrefs, setNotifPrefs] = useState({
    emailNewVendors: true,
    emailFailedPayouts: true,
    smsEscalations: false,
    weeklySummary: true,
  });

  const [team, setTeam] = useState<TeamMember[]>(SEED_TEAM);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  function handleSaveGeneral() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleInvite() {
    if (!inviteEmail.trim()) return;
    const name = inviteEmail.split('@')[0].replace(/[._]/g, ' ');
    setTeam((list) => [
      ...list,
      {
        id: `tm-${Date.now()}`,
        name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
        email: inviteEmail,
        role: 'Viewer',
        lastActive: 'Invited · pending',
        avatarColor: '#0891B2',
      },
    ]);
    setInviteEmail('');
    setInviteOpen(false);
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure platform preferences, fees, alerts and your admin team" />

      <div className="mb-5">
        <Tabs items={TAB_ITEMS} value={tab} onChange={(v) => setTab(v as SettingsTab)} />
      </div>

      {tab === 'general' && (
        <Card className="max-w-xl">
          <CardHeader title="General" subtitle="Basic platform identity and support contact details" />
          <CardBody className="space-y-4">
            <Field label="Platform name">
              <Input value={general.platformName} onChange={(e) => setGeneral({ ...general, platformName: e.target.value })} />
            </Field>
            <Field label="Support email">
              <Input
                type="email"
                value={general.supportEmail}
                onChange={(e) => setGeneral({ ...general, supportEmail: e.target.value })}
              />
            </Field>
            <Field label="Support phone">
              <Input value={general.supportPhone} onChange={(e) => setGeneral({ ...general, supportPhone: e.target.value })} />
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <Button onClick={handleSaveGeneral}>Save changes</Button>
              {saved && (
                <span className="flex items-center gap-1 text-[13px] font-medium text-success">
                  <Check size={14} /> Saved
                </span>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {tab === 'commission' && (
        <Card className="max-w-xl">
          <CardHeader title="Commission & Fees" subtitle="Default rates applied to new vendors and orders" />
          <CardBody className="space-y-4">
            <Field label="Default commission rate (%)" hint="Applied to new vendors unless overridden">
              <Input
                type="number"
                value={fees.commissionRate}
                onChange={(e) => setFees({ ...fees, commissionRate: e.target.value })}
              />
            </Field>
            <Field label="Delivery fee (₹)">
              <Input type="number" value={fees.deliveryFee} onChange={(e) => setFees({ ...fees, deliveryFee: e.target.value })} />
            </Field>
            <Field label="Platform fee (₹)">
              <Input type="number" value={fees.platformFee} onChange={(e) => setFees({ ...fees, platformFee: e.target.value })} />
            </Field>
            <div className="pt-1">
              <Button onClick={handleSaveGeneral}>Save changes</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {tab === 'notifications' && (
        <Card className="max-w-xl">
          <CardHeader title="Notifications" subtitle="Choose how the admin team gets alerted" />
          <CardBody>
            <ToggleRow
              title="New vendor sign-ups"
              description="Email me whenever a new vendor applies to join"
              checked={notifPrefs.emailNewVendors}
              onChange={(v) => setNotifPrefs({ ...notifPrefs, emailNewVendors: v })}
            />
            <ToggleRow
              title="Failed payouts"
              description="Email me when a vendor or driver payout fails"
              checked={notifPrefs.emailFailedPayouts}
              onChange={(v) => setNotifPrefs({ ...notifPrefs, emailFailedPayouts: v })}
            />
            <ToggleRow
              title="Escalated tickets"
              description="Send an SMS when a support ticket is escalated"
              checked={notifPrefs.smsEscalations}
              onChange={(v) => setNotifPrefs({ ...notifPrefs, smsEscalations: v })}
            />
            <ToggleRow
              title="Weekly summary"
              description="A weekly digest of revenue, orders and vendor activity"
              checked={notifPrefs.weeklySummary}
              onChange={(v) => setNotifPrefs({ ...notifPrefs, weeklySummary: v })}
            />
          </CardBody>
        </Card>
      )}

      {tab === 'team' && (
        <Card>
          <CardHeader
            title="Team & Roles"
            subtitle={`${team.length} admin team member${team.length === 1 ? '' : 's'}`}
            action={
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setInviteOpen(true)}>
                Invite teammate
              </Button>
            }
          />
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Last active</Th>
              </Tr>
            </Thead>
            <tbody>
              {team.map((member) => (
                <Tr key={member.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} color={member.avatarColor} size={32} />
                      <span className="font-medium text-ink-800">{member.name}</span>
                    </div>
                  </Td>
                  <Td className="text-ink-500">{member.email}</Td>
                  <Td>
                    <Badge tone={ROLE_TONE[member.role]}>{member.role}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-500">{member.lastActive}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite teammate"
        width={400}
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite}>Send invite</Button>
          </>
        }
      >
        <Label>Email address</Label>
        <Input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="teammate@verdant.app"
        />
      </Modal>
    </div>
  );
}
