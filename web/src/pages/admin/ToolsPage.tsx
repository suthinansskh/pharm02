import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { useAdmin } from '../../admin';
import { useToast } from '../../components/Toast';
import { Card } from '../../components/State';

export default function ToolsPage() {
  const { token, handleError } = useAdmin();
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

  return (
    <Card title="เครื่องมือ">
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
