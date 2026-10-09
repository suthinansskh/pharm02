import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api';
import { useVolunteerActivities, useVolunteers } from '../queries';
import { useToast } from '../components/Toast';
import PsCodeField, { usePsCode } from '../components/PsCodeField';
import { Card, ErrorBox, Loading } from '../components/State';
import { formatDate, formatDateTime, todayString } from '../format';

export default function VolunteerRecordPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const ps = usePsCode();
  const activities = useVolunteerActivities();
  const recent = useVolunteers();
  const [activityId, setActivityId] = useState('');
  const [detail, setDetail] = useState('');
  const today = todayString();

  const open = useMemo(
    () => (activities.data ?? []).filter((a) => a.status === 'active').sort((a, b) => b.date.localeCompare(a.date)),
    [activities.data],
  );
  const selected = open.find((a) => a.id === activityId);
  const notYet = selected ? selected.date > today : false;

  const submit = useMutation({
    mutationFn: () => api.addVolunteer({ psCode: ps.psCode, activityId, detail: detail.trim() }),
    onSuccess: (res) => {
      toast(`บันทึกงานจิตอาสาเรียบร้อย: ${res.name} — ${res.activity}`, 'success');
      ps.reset();
      setActivityId('');
      setDetail('');
      qc.invalidateQueries({ queryKey: ['volunteers'] });
    },
    onError: (err) => {
      const dup = err instanceof ApiError && err.code === 'duplicate';
      toast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', dup ? 'warning' : 'error');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (ps.user && selected && !notYet && !submit.isPending) submit.mutate();
  }

  const latest = recent.data?.items.slice(0, 25) ?? [];

  return (
    <>
      <section className="hero">
        <h1>บันทึกงานจิตอาสา</h1>
        <p>กรอก PS Code → เลือกกิจกรรมจิตอาสา → บันทึก</p>
      </section>

      <Card title="บันทึกงานจิตอาสา">
        <form onSubmit={onSubmit} className="form">
          <PsCodeField state={ps} />

          <label className="field">
            <span>กิจกรรมจิตอาสา</span>
            <select value={activityId} onChange={(e) => setActivityId(e.target.value)} required disabled={activities.isPending && !activities.data}>
              <option value="">{activities.isPending && !activities.data ? 'กำลังโหลด...' : 'เลือกกิจกรรมจิตอาสา'}</option>
              {open.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatDate(a.date)}){a.date > today ? ' — ยังไม่ถึงวันจัด' : ''}
                </option>
              ))}
            </select>
          </label>
          {activities.isError && !activities.data && <ErrorBox error={activities.error} onRetry={() => activities.refetch()} />}
          {activities.data && open.length === 0 && (
            <p className="hint">ยังไม่มีกิจกรรมจิตอาสาที่เปิดอยู่ ให้ผู้ดูแลสร้างกิจกรรมที่เมนู จัดการ → กิจกรรมจิตอาสา</p>
          )}

          {selected && (
            <dl className="info">
              <div><dt>วันที่จัด</dt><dd>{formatDate(selected.date)}</dd></div>
              <div><dt>รอบประเมิน</dt><dd>{selected.round}</dd></div>
              {selected.description && <div><dt>รายละเอียด</dt><dd>{selected.description}</dd></div>}
            </dl>
          )}
          {notYet && <p className="hint hint-error" role="alert">ยังไม่ถึงวันจัดกิจกรรม จึงยังบันทึกไม่ได้</p>}

          <label className="field">
            <span>บันทึกเพิ่มเติม (ไม่บังคับ)</span>
            <textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={1000} />
          </label>

          <button className="btn btn-primary" type="submit" disabled={!ps.user || !selected || notYet || submit.isPending}>
            {submit.isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
          <p className="hint">บันทึกได้ครั้งเดียวต่อคนต่อกิจกรรม</p>
        </form>
      </Card>

      <Card title="บันทึกล่าสุด" actions={recent.data && <span className="badge">{latest.length} จาก {recent.data.total}</span>}>
        {recent.isPending && !recent.data && <Loading />}
        {recent.isError && !recent.data && <ErrorBox error={recent.error} onRetry={() => recent.refetch()} />}
        {recent.data && latest.length === 0 && <div className="state">ยังไม่มีบันทึกงานจิตอาสา</div>}
        {latest.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>ชื่อ-นามสกุล</th><th>กิจกรรม</th><th>วันที่</th><th>รอบ</th><th>บันทึกเมื่อ</th></tr>
              </thead>
              <tbody>
                {latest.map((v, i) => (
                  <tr key={v.id}>
                    <td>{i + 1}</td>
                    <td>{v.name}</td>
                    <td>{v.activity}</td>
                    <td>{formatDate(v.date)}</td>
                    <td>{v.round}</td>
                    <td>{formatDateTime(v.timestamp)}</td>
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
