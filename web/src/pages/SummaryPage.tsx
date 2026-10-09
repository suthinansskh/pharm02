import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useEvents, useRecords } from '../queries';
import { Card, ErrorBox, Loading } from '../components/State';
import { MIN_HOURS_PER_ROUND, MIN_MINUTES_PER_ROUND } from '../config';
import { currentRound, downloadCsv, evalRound, evalRounds, formatDate, formatNumber } from '../format';

interface Attendance {
  event: string;
  date: string;
  points: number;
  timestamp: string;
}

interface Participant {
  name: string;
  position: string;
  department: string;
  count: number;
  points: number;
  last: string;
  attendances: Attendance[];
}

const PAGE = 50;

export default function SummaryPage() {
  const events = useEvents();
  const records = useRecords();
  const [round, setRound] = useState(currentRound); // defaults to the current evaluation round
  const [passFilter, setPassFilter] = useState<'' | 'pass' | 'fail'>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [detail, setDetail] = useState<Participant | null>(null);
  const deferredSearch = useDeferredValue(search);

  // Event details by id and by name, so old rows (no EventID) still resolve.
  const lookup = useMemo(() => {
    const byId = new Map<string, { points: number; date: string; round: string }>();
    const byName = new Map<string, { points: number; date: string; round: string }>();
    for (const e of events.data ?? []) {
      byId.set(e.id, e);
      byName.set(e.name, e);
    }
    return { byId, byName };
  }, [events.data]);

  const rows = records.data?.items;
  // The 10-hour minimum is per round, so it only means something once a single round is selected.
  const showCriteria = round !== '';

  const departments = useMemo(() => [...new Set((rows ?? []).map((r) => r.department).filter(Boolean))].sort(), [rows]);
  const eventNames = useMemo(() => [...new Set((rows ?? []).map((r) => r.event).filter(Boolean))].sort(), [rows]);
  const rounds = useMemo(
    () => evalRounds([...(rows ?? []).map((r) => r.date), ...(events.data ?? []).map((e) => e.round || e.date)]),
    [rows, events.data],
  );

  const participants = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const r of rows ?? []) {
      const ev = (r.eventId && lookup.byId.get(r.eventId)) || lookup.byName.get(r.event);
      const date = ev?.date || r.date;
      const points = ev ? ev.points : r.points;
      // The round set on the event wins; older events fall back to the one their date falls in.
      if (round && (ev?.round || evalRound(date)) !== round) continue;
      if (dateFrom && date < dateFrom) continue;
      if (dateTo && date > dateTo) continue;
      if (eventFilter && r.event !== eventFilter) continue;
      if (deptFilter && r.department !== deptFilter) continue;

      let p = map.get(r.name);
      if (!p) {
        p = { name: r.name, position: r.position, department: r.department, count: 0, points: 0, last: '', attendances: [] };
        map.set(r.name, p);
      }
      p.count++;
      p.points += points;
      if (date > p.last) p.last = date;
      p.attendances.push({ event: r.event, date, points, timestamp: r.timestamp });
    }
    return [...map.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'th'));
  }, [rows, lookup, round, dateFrom, dateTo, eventFilter, deptFilter]);

  const visible = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return participants.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || p.position.toLowerCase().includes(q)) &&
        (!showCriteria || !passFilter || (passFilter === 'pass') === (p.points >= MIN_MINUTES_PER_ROUND)),
    );
  }, [participants, deferredSearch, showCriteria, passFilter]);

  const stats = useMemo(() => {
    const attendance = visible.reduce((s, p) => s + p.count, 0);
    const points = visible.reduce((s, p) => s + p.points, 0);
    const passed = visible.filter((p) => p.points >= MIN_MINUTES_PER_ROUND).length;
    return { people: visible.length, attendance, passed, avg: visible.length ? points / visible.length : 0 };
  }, [visible]);

  const byDepartment = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of visible) m.set(p.department || 'ไม่ระบุ', (m.get(p.department || 'ไม่ระบุ') ?? 0) + p.count);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [visible]);
  const maxDept = byDepartment[0]?.[1] ?? 1;

  function clearFilters() {
    setRound(currentRound());
    setPassFilter('');
    setDateFrom('');
    setDateTo('');
    setEventFilter('');
    setDeptFilter('');
    setSearch('');
    setLimit(PAGE);
  }

  function exportCsv() {
    downloadCsv('attendance-summary.csv', [
      [
        'ลำดับ', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'หน่วยงาน', 'จำนวนครั้ง', 'นาทีรวม', 'เข้าร่วมล่าสุด',
        ...(showCriteria ? [`ผ่านเกณฑ์ ${MIN_HOURS_PER_ROUND} ชม.`] : []),
      ],
      ...visible.map((p, i) => [
        i + 1, p.name, p.position, p.department, p.count, p.points, p.last,
        ...(showCriteria ? [p.points >= MIN_MINUTES_PER_ROUND ? 'ผ่าน' : 'ไม่ผ่าน'] : []),
      ]),
    ]);
  }

  const loading = (records.isPending && !records.data) || (events.isPending && !events.data);
  const error = records.isError && !records.data ? records.error : events.isError && !events.data ? events.error : null;

  return (
    <>
      <Card
        title="สรุปการเข้าร่วม"
        actions={
          <div className="actions">
            <button className="btn" onClick={() => { records.refetch(); events.refetch(); }} disabled={records.isFetching}>
              {records.isFetching ? 'กำลังอัปเดต...' : 'รีเฟรช'}
            </button>
            <button className="btn btn-primary" onClick={exportCsv} disabled={visible.length === 0}>
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
          <label className="field"><span>ตั้งแต่</span><input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setLimit(PAGE); }} /></label>
          <label className="field"><span>ถึง</span><input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setLimit(PAGE); }} /></label>
          <label className="field">
            <span>กิจกรรม</span>
            <select value={eventFilter} onChange={(e) => { setEventFilter(e.target.value); setLimit(PAGE); }}>
              <option value="">ทั้งหมด</option>
              {eventNames.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <label className="field">
            <span>หน่วยงาน</span>
            <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setLimit(PAGE); }}>
              <option value="">ทั้งหมด</option>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="field"><span>ค้นหาชื่อ</span><input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }} placeholder="ชื่อ / ตำแหน่ง" /></label>
          {showCriteria && (
            <label className="field">
              <span>เกณฑ์ขั้นต่ำ {MIN_HOURS_PER_ROUND} ชม.</span>
              <select value={passFilter} onChange={(e) => { setPassFilter(e.target.value as '' | 'pass' | 'fail'); setLimit(PAGE); }}>
                <option value="">ทั้งหมด</option>
                <option value="pass">ผ่านเกณฑ์</option>
                <option value="fail">ยังไม่ผ่านเกณฑ์</option>
              </select>
            </label>
          )}
          <button className="btn" onClick={clearFilters}>ล้างตัวกรอง</button>
        </div>

        {loading && <Loading />}
        {error && <ErrorBox error={error} onRetry={() => { records.refetch(); events.refetch(); }} />}

        {!loading && !error && (
          <>
            <div className="stats">
              <div className="stat"><b>{formatNumber(stats.people)}</b><span>ผู้เข้าร่วม</span></div>
              {showCriteria && (
                <div className="stat stat-pass">
                  <b>{formatNumber(stats.passed)}<small> / {formatNumber(stats.people)}</small></b>
                  <span>ผ่านเกณฑ์ {MIN_HOURS_PER_ROUND} ชม. (รอบ {round})</span>
                </div>
              )}
              <div className="stat"><b>{formatNumber(stats.attendance)}</b><span>ครั้งที่เข้าร่วม</span></div>
              <div className="stat"><b>{formatNumber(events.data?.length ?? 0)}</b><span>กิจกรรมทั้งหมด</span></div>
              <div className="stat"><b>{formatNumber(stats.avg)}</b><span>นาทีเฉลี่ย/คน</span></div>
            </div>

            {byDepartment.length > 0 && (
              <div className="bars" aria-label="จำนวนครั้งที่เข้าร่วมแยกตามหน่วยงาน">
                {byDepartment.map(([d, n]) => (
                  <div key={d} className="bar-row">
                    <span className="bar-label">{d}</span>
                    <span className="bar"><span style={{ width: `${(n / maxDept) * 100}%` }} /></span>
                    <span className="bar-n">{n}</span>
                  </div>
                ))}
              </div>
            )}

            {visible.length === 0 ? (
              <div className="state">ไม่พบข้อมูลตามเงื่อนไข</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>#</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>หน่วยงาน</th><th className="num">ครั้ง</th><th className="num">นาทีรวม</th>{showCriteria && <th>เกณฑ์ {MIN_MINUTES_PER_ROUND} นาที</th>}<th>ล่าสุด</th><th /></tr>
                  </thead>
                  <tbody>
                    {visible.slice(0, limit).map((p, i) => (
                      <tr key={p.name}>
                        <td>{i + 1}</td>
                        <td>{p.name}</td>
                        <td>{p.position}</td>
                        <td>{p.department}</td>
                        <td className="num">{p.count}</td>
                        <td className="num strong">{formatNumber(p.points)}</td>
                        {showCriteria && (
                          <td>
                            <span className="progress" role="img" aria-label={`${formatNumber(p.points)} จาก ${MIN_MINUTES_PER_ROUND} นาที`}>
                              <span style={{ width: `${Math.min(100, (p.points / MIN_MINUTES_PER_ROUND) * 100)}%` }} />
                            </span>
                            {p.points >= MIN_MINUTES_PER_ROUND ? (
                              <span className="pill pill-active">ผ่าน</span>
                            ) : (
                              <span className="pill pill-fail">ขาด {formatNumber(MIN_MINUTES_PER_ROUND - p.points)} นาที</span>
                            )}
                          </td>
                        )}
                        <td>{formatDate(p.last)}</td>
                        <td><button className="btn btn-sm" onClick={() => setDetail(p)}>รายละเอียด</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {visible.length > limit && (
              <div className="center">
                <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>แสดงเพิ่ม ({visible.length - limit} รายการ)</button>
              </div>
            )}
          </>
        )}
      </Card>

      {detail && <DetailDialog p={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function DetailDialog({ p, onClose }: { p: Participant; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const sorted = [...p.attendances].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <header className="card-head">
        <h2>{p.name}</h2>
        <button className="btn btn-sm" onClick={() => ref.current?.close()} aria-label="ปิด">✕</button>
      </header>
      <p className="meta">{p.position} · {p.department} · {p.count} ครั้ง · {formatNumber(p.points)} นาที</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>กิจกรรม</th><th>วันที่</th><th className="num">นาที</th></tr></thead>
          <tbody>
            {sorted.map((a, i) => (
              <tr key={a.timestamp + i}><td>{a.event}</td><td>{formatDate(a.date)}</td><td className="num">{formatNumber(a.points)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </dialog>
  );
}
