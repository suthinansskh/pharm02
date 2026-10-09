import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAdmin } from '../admin';
import { useToast } from './Toast';
import { ErrorBox, Loading } from './State';
import type { AdminUser, AdminUserInput } from '../types';

const PAGE = 50;
const STATUS_LABEL = { active: 'เปิดใช้งาน', inactive: 'ปิดใช้งาน' } as const;

const empty = (): AdminUserInput => ({ psCode: '', name: '', group: '', level: '', unit: '', status: 'active' });

function UserForm({ editing, onDone }: { editing: AdminUser | null; onDone: () => void }) {
  const { token, handleError } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<AdminUserInput>(() => (editing ? { ...editing, originalPsCode: editing.psCode } : empty()));
  const set = <K extends keyof AdminUserInput>(k: K, v: AdminUserInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => api.saveUser(token!, { ...form, psCode: form.psCode.trim(), name: form.name.trim() }),
    onSuccess: () => {
      toast(editing ? 'บันทึกการแก้ไขผู้ใช้แล้ว' : 'เพิ่มผู้ใช้แล้ว', 'success');
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
      qc.invalidateQueries({ queryKey: ['user'] }); // drop cached PS Code lookups
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
      <label className="field">
        <span>PS Code</span>
        <input value={form.psCode} onChange={(e) => set('psCode', e.target.value)} maxLength={30} required disabled={Boolean(editing)} />
      </label>
      <label className="field">
        <span>สถานะ</span>
        <select value={form.status} onChange={(e) => set('status', e.target.value as AdminUserInput['status'])}>
          <option value="active">{STATUS_LABEL.active}</option>
          <option value="inactive">{STATUS_LABEL.inactive}</option>
        </select>
      </label>
      <label className="field span-2">
        <span>ชื่อ-นามสกุล</span>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} required />
      </label>
      <label className="field">
        <span>ตำแหน่ง / ระดับ</span>
        <input value={form.level} onChange={(e) => set('level', e.target.value)} maxLength={100} />
      </label>
      <label className="field">
        <span>หน่วยงาน</span>
        <input value={form.unit} onChange={(e) => set('unit', e.target.value)} maxLength={200} />
      </label>
      <label className="field span-2">
        <span>กลุ่ม</span>
        <input value={form.group} onChange={(e) => set('group', e.target.value)} maxLength={100} />
      </label>
      {editing && (
        <p className="hint span-2">
          PS Code เปลี่ยนไม่ได้ ส่วนการเปลี่ยนชื่อจะไม่แก้ประวัติที่บันทึกไปแล้ว (ประวัติเก่ายังเป็นชื่อเดิมและจะแยกเป็นคนละรายการในหน้าสรุปผล)
        </p>
      )}
      <div className="actions span-2">
        <button className="btn btn-primary" type="submit" disabled={save.isPending}>
          {save.isPending ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้'}
        </button>
        <button className="btn" type="button" onClick={onDone}>ยกเลิก</button>
      </div>
    </form>
  );
}

export default function UserManager() {
  const { token, handleError } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);

  const users = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => api.listUsers(token!),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
    meta: { persist: false }, // personal data: never written to localStorage
  });

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users.data ?? []).filter(
      (u) =>
        (!q || [u.psCode, u.name, u.unit, u.level, u.group].some((v) => v.toLowerCase().includes(q))) &&
        (!statusFilter || u.status === statusFilter),
    );
  }, [users.data, search, statusFilter]);

  const onError = (err: unknown) => {
    handleError(err);
    toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error');
  };

  const toggle = useMutation({
    mutationFn: (u: AdminUser) =>
      api.saveUser(token!, { ...u, originalPsCode: u.psCode, status: u.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: (_r, u) => {
      toast(u.status === 'active' ? `ปิดใช้งาน ${u.name} แล้ว` : `เปิดใช้งาน ${u.name} แล้ว`, 'success');
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
      qc.invalidateQueries({ queryKey: ['user'] });
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (u: AdminUser) => api.deleteUser(token!, u.psCode),
    onSuccess: (_r, u) => {
      toast(`ลบ ${u.name} แล้ว`, 'success');
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
      qc.invalidateQueries({ queryKey: ['user'] });
    },
    onError,
  });

  const formOpen = creating || editing !== null;
  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };
  const busy = toggle.isPending || remove.isPending;

  return (
    <div className="category-manager">
      <div className="card-head">
        <div>
          <h3>ผู้ใช้งาน</h3>
          <p className="hint">เพิ่ม แก้ไข ปิดใช้งาน หรือลบผู้ใช้ ผู้ใช้ที่ปิดใช้งานจะบันทึกการเข้าร่วมไม่ได้ แต่ประวัติเดิมยังอยู่ (เลขบัตรประชาชนและรหัสผ่านไม่แสดงและไม่ถูกแก้ไขที่นี่)</p>
        </div>
        {!formOpen && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + เพิ่มผู้ใช้
          </button>
        )}
      </div>

      {formOpen && <UserForm key={editing?.psCode ?? 'new'} editing={editing} onDone={closeForm} />}

      <div className="filters">
        <input type="search" placeholder="ค้นหา PS Code / ชื่อ / หน่วยงาน" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }} aria-label="ค้นหาผู้ใช้" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setLimit(PAGE); }} aria-label="สถานะ">
          <option value="">ทุกสถานะ</option>
          <option value="active">{STATUS_LABEL.active}</option>
          <option value="inactive">{STATUS_LABEL.inactive}</option>
        </select>
        {users.data && <span className="badge">{shown.length} / {users.data.length} คน</span>}
      </div>

      {users.isPending && users.fetchStatus !== 'idle' && <Loading />}
      {users.isError && <ErrorBox error={users.error} onRetry={() => users.refetch()} />}
      {users.data && shown.length === 0 && <div className="state">ไม่พบผู้ใช้</div>}

      {shown.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>PS Code</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>หน่วยงาน</th><th>สถานะ</th><th /></tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((u) => (
                <tr key={u.psCode}>
                  <td>{u.psCode}</td>
                  <td>{u.name}</td>
                  <td>{u.level}</td>
                  <td>{u.unit}</td>
                  <td><span className={`pill pill-${u.status}`}>{STATUS_LABEL[u.status]}</span></td>
                  <td>
                    <span className="actions">
                      <button className="btn btn-sm" disabled={busy} onClick={() => toggle.mutate(u)}>
                        {u.status === 'active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      </button>
                      <button className="btn btn-sm" onClick={() => { setCreating(false); setEditing(u); }}>แก้ไข</button>
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={busy}
                        onClick={() => { if (window.confirm(`ลบผู้ใช้ "${u.name}" (${u.psCode})? การลบย้อนกลับไม่ได้ หากเพียงต้องการหยุดการใช้งาน ให้ใช้ "ปิดใช้งาน" แทน`)) remove.mutate(u); }}
                      >
                        ลบ
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {shown.length > limit && (
        <div className="center">
          <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>แสดงเพิ่ม ({shown.length - limit} รายการ)</button>
        </div>
      )}
    </div>
  );
}
