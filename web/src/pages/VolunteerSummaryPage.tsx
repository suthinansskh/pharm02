import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAdmin } from '../admin';
import { useVolunteers } from '../queries';
import { useToast } from '../components/Toast';
import { Card, ErrorBox, Loading } from '../components/State';
import { currentRound, downloadCsv, evalRound, evalRounds, formatDate, formatNumber } from '../format';

const PAGE = 50;

interface Person {
  name: string;
  position: string;
  department: string;
  times: number;
  last: string;
}

export default function VolunteerSummaryPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { token, handleError } = useAdmin();
  const volunteers = useVolunteers();
  const [round, setRound] = useState(currentRound);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const items = volunteers.data?.items;

  const rounds = useMemo(() => evalRounds((items ?? []).map((v) => v.round || v.date)), [items]);

  const inRound = useMemo(
    () => (items ?? []).filter((v) => !round || (v.round || evalRound(v.date)) === round),
    [items, round],
  );

  const people = useMemo(() => {
    const map = new Map<string, Person>();
    for (const v of inRound) {
      let p = map.get(v.name);
      if (!p) {
        p = { name: v.name, position: v.position, department: v.department, times: 0, last: '' };
        map.set(v.name, p);
      }
      p.times++;
      if (v.date > p.last) p.last = v.date;
    }
    const q = search.trim().toLowerCase();
    return [...map.values()]
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.department.toLowerCase().includes(q))
      .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name, 'th'));
  }, [inRound, search]);

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? inRound.filter((v) => v.name.toLowerCase().includes(q) || v.activity.toLowerCase().includes(q)) : inRound;
  }, [inRound, search]);

  const totalTimes = people.reduce((s, p) => s + p.times, 0);

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteVolunteer(token!, id),
    onSuccess: () => {
      toast('ลบรายการแล้ว', 'success');
      qc.invalidateQueries({ queryKey: ['volunteers'] });
    },
    onError: (err) => {
      handleError(err);
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error');
    },
  });

  function exportCsv() {
    downloadCsv(`volunteer-${round ? round.replace('/', '-') : 'all'}.csv`, [
      ['ลำดับ', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'หน่วยงาน', 'จำนวนครั้ง', 'ล่าสุด'],
      ...people.map((p, i) => [i + 1, p.name, p.position, p.department, p.times, p.last]),
    ]);
  }

  return (
    <>
      <section className="hero">
        <h1>สรุปงานจิตอาสา</h1>
        <p>จำนวนครั้งต่อคนตามรอบประเมิน</p>
      </section>

      <Card
        title="สรุปจำนวนครั้งตามรอบประเมิน"
        actions={
          <div className="actions">
            <button className="btn" onClick={() => volunteers.refetch()} disabled={volunteers.isFetching}>
              {volunteers.isFetching ? 'กำลังอัปเดต...' : 'รีเฟรช'}
            </button>
            <button className="btn btn-primary" onClick={exportCsv} disabled={people.length === 0}>
              ส่งออก CSV
            </button>
          </div>
        }
      >
        <div className="filters">
          <label className="field">
            <span>รอบประเมิน</span>
            <select value={round} onChange={(e) => { setRound(e.target.value); setLimit(PAGE); }}>
              <option value="">ทุกรอบ</option>
              {rounds.map((r) => <option key={r} value={r}>รอบประเมิน {r}</option>)}
            </select>
          </label>
          <label className="field">
            <span>ค้นหา</span>
            <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }} placeholder="ชื่อ / หน่วยงาน / กิจกรรม" />
          </label>
        </div>

        {volunteers.isPending && !volunteers.data && <Loading />}
        {volunteers.isError && !volunteers.data && <ErrorBox error={volunteers.error} onRetry={() => volunteers.refetch()} />}

        {volunteers.data && (
          <>
            <div className="stats">
              <div className="stat"><b>{formatNumber(people.length)}</b><span>ผู้ทำกิจกรรม</span></div>
              <div className="stat"><b>{formatNumber(totalTimes)}</b><span>จำนวนครั้งรวม</span></div>
              <div className="stat"><b>{formatNumber(people.length ? totalTimes / people.length : 0)}</b><span>เฉลี่ยครั้ง/คน</span></div>
            </div>

            {people.length === 0 ? (
              <div className="state">ยังไม่มีบันทึกงานจิตอาสาในรอบนี้</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>#</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>หน่วยงาน</th><th className="num">จำนวนครั้ง</th><th>ล่าสุด</th></tr>
                  </thead>
                  <tbody>
                    {people.slice(0, limit).map((p, i) => (
                      <tr key={p.name}>
                        <td>{i + 1}</td>
                        <td>{p.name}</td>
                        <td>{p.position}</td>
                        <td>{p.department}</td>
                        <td className="num strong">{p.times}</td>
                        <td>{formatDate(p.last)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {people.length > limit && (
              <div className="center">
                <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>แสดงเพิ่ม ({people.length - limit} รายการ)</button>
              </div>
            )}
          </>
        )}
      </Card>

      {volunteers.data && entries.length > 0 && (
        <Card title="รายการที่บันทึก" actions={<span className="badge">{entries.length} รายการ</span>}>
          <ul className="event-list">
            {entries.slice(0, limit).map((v) => (
              <li key={v.id} className="event-row">
                <time className="event-date" dateTime={v.date}>{formatDate(v.date)}</time>
                <div className="event-main">
                  <h3>{v.activity}</h3>
                  <p className="meta">{v.name}{v.department && ` · ${v.department}`}</p>
                  {v.detail && <p className="meta">{v.detail}</p>}
                </div>
                <span className="pill">รอบ {v.round || evalRound(v.date)}</span>
                {token && (
                  <div className="actions">
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={remove.isPending}
                      onClick={() => { if (window.confirm(`ลบรายการของ ${v.name} (${v.activity})?`)) remove.mutate(v.id); }}
                    >
                      ลบ
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {entries.length > limit && (
            <div className="center">
              <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>แสดงเพิ่ม ({entries.length - limit} รายการ)</button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
