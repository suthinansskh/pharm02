import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAdmin } from '../admin';
import { useCategories, useEvents } from '../queries';
import { useToast } from '../components/Toast';
import { Card, ErrorBox, Loading } from '../components/State';
import { evalRound, formatDate, roundOptions, todayString } from '../format';
import type { EventInput, EventItem } from '../types';

const STATUS_LABEL: Record<string, string> = {
  active: 'เปิดใช้งาน',
  inactive: 'ปิดใช้งาน',
};

const emptyForm = (): EventInput => {
  const date = todayString();
  return { name: '', category: '', points: 1, date, organizer: '', status: 'active', description: '', round: evalRound(date) };
};

function EventForm({ editing, onDone }: { editing: EventItem | null; onDone: () => void }) {
  const { token, handleError } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<EventInput>(() =>
    editing ? { ...editing, round: editing.round || evalRound(editing.date) } : emptyForm(),
  );
  // The round follows the date until the admin picks one by hand.
  const roundPicked = useRef(Boolean(editing?.round));
  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const rounds = useMemo(() => roundOptions([form.round, evalRound(form.date)]), [form.round, form.date]);
  const categories = useCategories();
  // Keep an event's existing category selectable even if the admin has since removed it from the list.
  const categoryList = useMemo(() => {
    const list = categories.data ?? [];
    return form.category && !list.includes(form.category) ? [...list, form.category] : list;
  }, [categories.data, form.category]);

  const save = useMutation({
    mutationFn: () => api.saveEvent(token!, form),
    onSuccess: () => {
      toast(editing ? 'อัปเดตกิจกรรมเรียบร้อยแล้ว' : 'สร้างกิจกรรมเรียบร้อยแล้ว', 'success');
      qc.invalidateQueries({ queryKey: ['events'] });
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
    <form onSubmit={onSubmit} className="form grid-2">
      <label className="field span-2">
        <span>ชื่อกิจกรรม</span>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} required />
      </label>
      <label className="field">
        <span>ประเภท</span>
        {categoryList.length > 0 ? (
          <select value={form.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">ไม่ระบุประเภท</option>
            {categoryList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input value={form.category} onChange={(e) => set('category', e.target.value)} maxLength={100} placeholder="เช่น ประชุม, อบรม" />
        )}
      </label>
      <label className="field">
        <span>นาที</span>
        <input type="number" min={0} max={1000} step="any" value={form.points} onChange={(e) => set('points', Number(e.target.value))} required />
      </label>
      <label className="field">
        <span>วันที่</span>
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
        <select
          value={form.round}
          onChange={(e) => {
            roundPicked.current = true;
            set('round', e.target.value);
          }}
          required
        >
          {rounds.map((r) => (
            <option key={r} value={r}>รอบประเมิน {r}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>ผู้จัด</span>
        <input value={form.organizer} onChange={(e) => set('organizer', e.target.value)} maxLength={200} />
      </label>
      <label className="field">
        <span>สถานะ</span>
        <select value={form.status} onChange={(e) => set('status', e.target.value)}>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label className="field span-2">
        <span>รายละเอียด</span>
        <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} />
      </label>
      <div className="actions span-2">
        <button className="btn btn-primary" type="submit" disabled={save.isPending}>
          {save.isPending ? 'กำลังบันทึก...' : editing ? 'อัปเดตกิจกรรม' : 'สร้างกิจกรรม'}
        </button>
        {editing && (
          <button className="btn" type="button" onClick={onDone}>
            ยกเลิก
          </button>
        )}
      </div>
    </form>
  );
}

export default function EventsPage() {
  const { token, handleError } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const events = useEvents();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [creating, setCreating] = useState(false);

  const categories = useMemo(
    () => [...new Set((events.data ?? []).map((e) => e.category).filter(Boolean))].sort(),
    [events.data],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (events.data ?? [])
      .filter((e) => (!q || e.name.toLowerCase().includes(q) || e.organizer.toLowerCase().includes(q)) && (!category || e.category === category) && (!status || e.status === status))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [events.data, search, category, status]);

  const toggle = useMutation({
    mutationFn: (ev: EventItem) => api.saveEvent(token!, { ...ev, status: ev.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: (_res, ev) => {
      toast(ev.status === 'active' ? 'ปิดใช้งานกิจกรรมแล้ว' : 'เปิดใช้งานกิจกรรมแล้ว', 'success');
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => {
      handleError(err);
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteEvent(token!, id),
    onSuccess: () => {
      toast('ลบกิจกรรมเรียบร้อยแล้ว', 'success');
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => {
      handleError(err);
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error');
    },
  });

  const formOpen = creating || editing !== null;
  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <>
      <Card
        title="กิจกรรมประชุม"
        actions={
          !formOpen && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + สร้างกิจกรรม
            </button>
          )
        }
      >
        {formOpen ? (
          <EventForm key={editing?.id ?? 'new'} editing={editing} onDone={closeForm} />
        ) : (
          <p className="hint section-hint">สร้างกิจกรรมประชุม/อบรมที่บุคลากรเลือกตอนบันทึกการเข้าร่วม พร้อมกำหนดนาที วันที่ และรอบประเมิน</p>
        )}
      </Card>

      <Card title="รายการกิจกรรม" actions={events.data && <span className="badge">{shown.length} / {events.data.length}</span>}>
        <div className="filters">
          <input type="search" placeholder="ค้นหาชื่อกิจกรรม / ผู้จัด" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">ทุกประเภท</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {events.isPending && !events.data && <Loading />}
        {events.isError && !events.data && <ErrorBox error={events.error} onRetry={() => events.refetch()} />}
        {events.data && shown.length === 0 && <div className="state">ไม่พบกิจกรรม</div>}

        <ul className="event-list">
          {shown.map((ev) => (
            <li key={ev.id} className="event-row">
              <time className="event-date" dateTime={ev.date}>{formatDate(ev.date)}</time>
              <div className="event-main">
                <h3>{ev.name}</h3>
                <p className="meta">
                  รอบ {ev.round || evalRound(ev.date)} · {ev.category || 'ไม่ระบุประเภท'}
                  {ev.organizer && ` · ผู้จัด: ${ev.organizer}`}
                </p>
                {ev.description && <p className="meta">{ev.description}</p>}
              </div>
              <div className="event-side">
                <span className="event-hours">{ev.points} นาที</span>
                <span className={`pill pill-${ev.status}`}>{STATUS_LABEL[ev.status] ?? ev.status}</span>
              </div>
              {token && (
                <div className="actions">
                  <button className="btn btn-sm" disabled={toggle.isPending} onClick={() => toggle.mutate(ev)}>
                    {ev.status === 'active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                  <button className="btn btn-sm" onClick={() => { setCreating(false); setEditing(ev); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    แก้ไข
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={remove.isPending}
                    onClick={() => { if (window.confirm(`ลบกิจกรรม "${ev.name}"?`)) remove.mutate(ev.id); }}
                  >
                    ลบ
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
