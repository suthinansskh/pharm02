import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAdmin } from '../admin';
import { useCategories } from '../queries';
import { useToast } from '../components/Toast';
import { Card } from '../components/State';
import UserManager from '../components/UserManager';

export function LoginForm() {
  const { setToken } = useAdmin();
  const toast = useToast();
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => api.login(password),
    onSuccess: (res) => {
      setToken(res.token);
      setPassword('');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ', 'error'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password && !login.isPending) login.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="form form-narrow">
      <label className="field">
        <span>รหัสผ่านผู้ดูแลระบบ</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      <button className="btn btn-primary" type="submit" disabled={login.isPending}>
        {login.isPending ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  );
}

function CategoryManager() {
  const { token, handleError } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const categories = useCategories();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [name, setName] = useState('');

  const list = draft ?? categories.data ?? [];
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(categories.data ?? []);

  const save = useMutation({
    mutationFn: () => api.saveCategories(token!, list),
    onSuccess: (saved) => {
      qc.setQueryData(['categories'], saved);
      setDraft(null);
      toast('บันทึกประเภทกิจกรรมแล้ว', 'success');
    },
    onError: (err) => {
      handleError(err);
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error');
    },
  });

  function add(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (list.some((x) => x.toLowerCase() === n.toLowerCase())) {
      toast('มีประเภทนี้อยู่แล้ว', 'warning');
      return;
    }
    setDraft([...list, n]);
    setName('');
  }

  function move(i: number, d: -1 | 1) {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setDraft(next);
  }

  return (
    <div className="category-manager">
      <div>
        <h3>ประเภทกิจกรรม</h3>
        <p className="hint">รายการนี้ใช้เป็นตัวเลือกตอนสร้าง/แก้ไขกิจกรรม การลบประเภทออกไม่กระทบกิจกรรมที่สร้างไปแล้ว</p>
      </div>

      <form onSubmit={add} className="inline-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อประเภทใหม่ เช่น Morning Talk" maxLength={100} aria-label="ชื่อประเภทใหม่" />
        <button className="btn" type="submit">เพิ่ม</button>
      </form>

      {categories.isPending && !categories.data && <p className="hint">กำลังโหลด...</p>}
      {categories.isError && !categories.data && <p className="hint hint-error">{categories.error.message}</p>}
      {list.length === 0 && categories.data && <p className="hint">ยังไม่มีประเภทกิจกรรม</p>}

      <ul className="chip-list">
        {list.map((c, i) => (
          <li key={c} className="chip-row">
            <span>{c}</span>
            <span className="actions">
              <button className="btn btn-sm" type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`เลื่อน ${c} ขึ้น`}>↑</button>
              <button className="btn btn-sm" type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`เลื่อน ${c} ลง`}>↓</button>
              <button className="btn btn-sm btn-danger" type="button" onClick={() => setDraft(list.filter((x) => x !== c))} aria-label={`ลบ ${c}`}>ลบ</button>
            </span>
          </li>
        ))}
      </ul>

      <div className="actions">
        <button className="btn btn-primary" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? 'กำลังบันทึก...' : 'บันทึกประเภท'}
        </button>
        {dirty && (
          <button className="btn" onClick={() => setDraft(null)} disabled={save.isPending}>
            ยกเลิกการเปลี่ยนแปลง
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { token, setToken, handleError } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();

  const dedupe = useMutation({
    mutationFn: () => api.removeDuplicates(token!),
    onSuccess: (res) => {
      toast(res.removed ? `ลบข้อมูลซ้ำ ${res.removed} รายการ` : 'ไม่พบข้อมูลซ้ำ', 'success');
      qc.invalidateQueries({ queryKey: ['records'] });
    },
    onError: (err) => {
      handleError(err);
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error');
    },
  });

  if (!token) {
    return (
      <Card title="เข้าสู่ระบบผู้ดูแล">
        <LoginForm />
      </Card>
    );
  }

  return (
    <Card
      title="เครื่องมือผู้ดูแล"
      actions={
        <button className="btn" onClick={() => { setToken(null); qc.removeQueries({ queryKey: ['adminUsers'] }); }}>
          ออกจากระบบ
        </button>
      }
    >
      <UserManager />
      <hr className="divider" />
      <CategoryManager />
      <hr className="divider" />
      <div className="admin-tool">
        <div>
          <h3>ลบข้อมูลซ้ำ</h3>
          <p className="hint">ลบแถวใน record ที่มี ชื่อ + วันที่ + กิจกรรม ซ้ำกัน โดยเก็บแถวแรกไว้ (ย้อนกลับไม่ได้)</p>
        </div>
        <button
          className="btn btn-danger"
          disabled={dedupe.isPending}
          onClick={() => {
            if (window.confirm('ยืนยันลบข้อมูลที่ซ้ำกัน? การลบย้อนกลับไม่ได้')) dedupe.mutate();
          }}
        >
          {dedupe.isPending ? 'กำลังลบ...' : 'ลบข้อมูลซ้ำ'}
        </button>
      </div>
    </Card>
  );
}
