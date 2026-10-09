import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api';
import { useEvents, useRecords } from '../queries';
import { useToast } from '../components/Toast';
import PsCodeField, { usePsCode } from '../components/PsCodeField';
import { Card, ErrorBox, Loading } from '../components/State';
import { formatDate, formatDateTime } from '../format';

export default function RecordPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [eventId, setEventId] = useState('');
  const ps = usePsCode();

  const events = useEvents();
  const recent = useRecords(25);

  const openEvents = useMemo(
    () => (events.data ?? []).filter((e) => e.status === 'active').sort((a, b) => b.date.localeCompare(a.date)),
    [events.data],
  );
  const selected = openEvents.find((e) => e.id === eventId);

  const submit = useMutation({
    mutationFn: () => api.addRecord(ps.psCode, eventId),
    onSuccess: (res) => {
      toast(`บันทึกเรียบร้อย: ${res.name} — ${res.event}`, 'success');
      ps.reset();
      setEventId('');
      qc.invalidateQueries({ queryKey: ['records'] });
    },
    onError: (err) => {
      const dup = err instanceof ApiError && err.code === 'duplicate';
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', dup ? 'warning' : 'error');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (ps.user && selected && !submit.isPending) submit.mutate();
  }

  return (
    <>
      <section className="hero">
        <h1>บันทึกการเข้าร่วมประชุม</h1>
        <p>กรอก PS Code → เลือกกิจกรรม → บันทึก</p>
      </section>

      <Card title="บันทึกการเข้าร่วม">
        <form onSubmit={onSubmit} className="form">
          <PsCodeField state={ps} />

          <label className="field">
            <span>กิจกรรม</span>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} required disabled={events.isPending && !events.data}>
              <option value="">{events.isPending && !events.data ? 'กำลังโหลด...' : 'เลือกกิจกรรม'}</option>
              {openEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.points} นาที){ev.category ? ` - ${ev.category}` : ''}
                </option>
              ))}
            </select>
          </label>
          {events.isError && !events.data && <ErrorBox error={events.error} onRetry={() => events.refetch()} />}

          {selected && (
            <dl className="info">
              <div><dt>นาที</dt><dd>{selected.points}</dd></div>
              <div><dt>วันที่จัด</dt><dd>{formatDate(selected.date)}</dd></div>
              <div><dt>ผู้จัด</dt><dd>{selected.organizer || '-'}</dd></div>
            </dl>
          )}

          <button className="btn btn-primary" type="submit" disabled={!ps.user || !selected || submit.isPending}>
            {submit.isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
          <p className="hint">ระบบป้องกันการบันทึกซ้ำ (ชื่อ + วันที่ + กิจกรรมเดียวกัน)</p>
        </form>
      </Card>

      <Card title="การเข้าร่วมล่าสุด" actions={recent.data && <span className="badge">{recent.data.items.length} จาก {recent.data.total}</span>}>
        {recent.isPending && !recent.data && <Loading />}
        {recent.isError && !recent.data && <ErrorBox error={recent.error} onRetry={() => recent.refetch()} />}
        {recent.data && recent.data.items.length === 0 && <div className="state">ยังไม่มีข้อมูลการเข้าร่วม</div>}
        {recent.data && recent.data.items.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th><th>กิจกรรม</th><th className="num">นาที</th><th>วันที่</th><th>บันทึกเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {recent.data.items.map((r, i) => (
                  <tr key={r.timestamp + r.name + r.event}>
                    <td>{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.position}</td>
                    <td>{r.event}</td>
                    <td className="num">{r.points}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{formatDateTime(r.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
