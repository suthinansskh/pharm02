import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAdmin } from '../admin';
import { useCategories } from '../queries';
import { useToast } from './Toast';

export default function CategoryManager() {
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
