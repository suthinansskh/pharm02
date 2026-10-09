import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { useAdmin } from '../../admin';
import { useVolunteerActivities } from '../../queries';
import { useToast } from '../../components/Toast';
import { Card, ErrorBox, Loading } from '../../components/State';
import { evalRound, formatDate, roundOptions, todayString } from '../../format';
import type { VolunteerActivity, VolunteerActivityInput } from '../../types';

const STATUS_LABEL: Record<string, string> = { active: 'เปิดใช้งาน', inactive: 'ปิดใช้งาน' };

const emptyForm = (): VolunteerActivityInput => {
  const date = todayString();
  return { name: '', date, round: evalRound(date), status: 'active', description: '' };
};

function ActivityForm({ editing, onDone }: { editing: VolunteerActivity | null; onDone: () => void }) {
  const { token, handleError } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<VolunteerActivityInput>(() => (editing ? { ...editing } : emptyForm()));
  // The round follows the date until the admin picks one by hand.
  const roundPicked = useRef(Boolean(editing));
  const rounds = useMemo(() => roundOptions([form.round, evalRound(form.date)]), [form.round, form.date]);
  const set = <K extends keyof VolunteerActivityInput>(k: K, v: VolunteerActivityInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.saveVolunteerActivity(token!, { ...form, name: form.name.trim() }),
    onSuccess: () => {
      toast(editing ? 'อัปเดตกิจกรรมจิตอาสาแล้ว' : 'สร้างกิจกรรมจิตอาสาแล้ว', 'success');
      qc.invalidateQueries({ queryKey: ['volunteerActivities'] });
      onDone();
    },
    onError: (err) => {
      handleError(err);
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!save.isPending) save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="form grid-2 subform">
      <label className="field span-2">
        <span>ชื่อกิจกรรมจิตอาสา</span>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} placeholder="เช่น วันปิยมหาราช, งานกีฬาโรงพยาบาล" required />
      </label>
      <label className="field">
        <span>วันที่จัดกิจกรรม</span>
        <input
          type="date"
          value={form.date}
          onChange={(e) => {
            const date = e.target.value;
            setForm((f) => ({ ...f, date, round: roundPicked.current || !date ? f.round : evalRound(date) }));
          }}
          required
        />
      </label>
      <label className="field">
        <span>รอบประเมิน</span>
        <select value={form.round} onChange={(e) => { roundPicked.current = true; set('round', e.target.value); }} required>
          {rounds.map((r) => <option key={r} value={r}>รอบประเมิน {r}</option>)}
        </select>
      </label>
      <label className="field">
        <span>สถานะ</span>
        <select value={form.status} onChange={(e) => set('status', e.target.value)}>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="field span-2">
        <span>รายละเอียด</span>
        <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} />
      </label>
      <div className="actions span-2">
        <button className="btn btn-primary" type="submit" disabled={save.isPending}>
          {save.isPending ? 'กำลังบันทึก...' : editing ? 'อัปเดตกิจกรรม' : 'สร้างกิจกรรม'}
        </button>
        <button className="btn" type="button" onClick={onDone}>ยกเลิก</button>
      </div>
    </form>
  );
}

export default function VolunteerActivitiesPage() {
  const { token, handleError } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const activities = useVolunteerActivities();
  const [search, setSearch] = useState('');
  const [round, setRound] = useState('');
  const [editing, setEditing] = useState<VolunteerActivity | null>(null);
  const [creating, setCreating] = useState(false);

  const rounds = useMemo(
    () => [...new Set((activities.data ?? []).map((a) => a.round).filter(Boolean))].sort().reverse(),
    [activities.data],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (activities.data ?? [])
      .filter((a) => (!q || a.name.toLowerCase().includes(q)) && (!round || a.round === round))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [activities.data, search, round]);

  const onError = (err: unknown) => {
    handleError(err);
    toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error');
  };

  const toggle = useMutation({
    mutationFn: (a: VolunteerActivity) => api.saveVolunteerActivity(token!, { ...a, status: a.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: (_r, a) => {
      toast(a.status === 'active' ? 'ปิดใช้งานกิจกรรมแล้ว' : 'เปิดใช้งานกิจกรรมแล้ว', 'success');
      qc.invalidateQueries({ queryKey: ['volunteerActivities'] });
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteVolunteerActivity(token!, id),
    onSuccess: () => {
      toast('ลบกิจกรรมแล้ว', 'success');
      qc.invalidateQueries({ queryKey: ['volunteerActivities'] });
    },
    onError,
  });

  const formOpen = creating || editing !== null;
  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <Card
      title="กิจกรรมจิตอาสา"
      actions={
        !formOpen && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + สร้างกิจกรรมจิตอาสา
          </button>
        )
      }
    >
      <p className="hint section-hint">สร้างกิจกรรมไว้ล่วงหน้า (เช่น วันปิยมหาราช, งานกีฬาโรงพยาบาล) บุคลากรจะเลือกจากรายการนี้ตอนบันทึกงานจิตอาสา และนับจำนวนครั้งตามรอบประเมินของกิจกรรม</p>

      {formOpen && <ActivityForm key={editing?.id ?? 'new'} editing={editing} onDone={closeForm} />}

      <div className="filters">
        <input type="search" placeholder="ค้นหาชื่อกิจกรรม" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="ค้นหากิจกรรม" />
        <select value={round} onChange={(e) => setRound(e.target.value)} aria-label="รอบประเมิน">
          <option value="">ทุกรอบ</option>
          {rounds.map((r) => <option key={r} value={r}>รอบประเมิน {r}</option>)}
        </select>
        {activities.data && <span className="badge">{shown.length} / {activities.data.length}</span>}
      </div>

      {activities.isPending && !activities.data && <Loading />}
      {activities.isError && !activities.data && <ErrorBox error={activities.error} onRetry={() => activities.refetch()} />}
      {activities.data && shown.length === 0 && <div className="state">ยังไม่มีกิจกรรมจิตอาสา</div>}

      <ul className="event-list">
        {shown.map((a) => (
          <li key={a.id} className="event-row">
            <time className="event-date" dateTime={a.date}>{formatDate(a.date)}</time>
            <div className="event-main">
              <h3>{a.name}</h3>
              <p className="meta">รอบ {a.round}</p>
              {a.description && <p className="meta">{a.description}</p>}
            </div>
            <div className="event-side">
              <span className={`pill pill-${a.status}`}>{STATUS_LABEL[a.status] ?? a.status}</span>
            </div>
            <div className="actions">
              <button className="btn btn-sm" disabled={toggle.isPending} onClick={() => toggle.mutate(a)}>
                {a.status === 'active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
              </button>
              <button className="btn btn-sm" onClick={() => { setCreating(false); setEditing(a); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>แก้ไข</button>
              <button
                className="btn btn-sm btn-danger"
                disabled={remove.isPending}
                onClick={() => { if (window.confirm(`ลบกิจกรรม "${a.name}"? (บันทึกที่มีอยู่แล้วยังคงอยู่)`)) remove.mutate(a.id); }}
              >
                ลบ
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
