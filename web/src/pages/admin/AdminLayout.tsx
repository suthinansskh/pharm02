import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAdmin } from '../../admin';
import { Card } from '../../components/State';
import LoginForm from '../../components/LoginForm';

/** One login for the whole "จัดการ" section; the section's tabs live in the shared Layout. */
export default function AdminLayout() {
  const { token, setToken } = useAdmin();
  const qc = useQueryClient();

  if (!token) {
    return (
      <Card title="เข้าสู่ระบบผู้ดูแล">
        <LoginForm />
      </Card>
    );
  }

  return (
    <>
      <div className="admin-bar">
        <span>เข้าสู่ระบบผู้ดูแลแล้ว</span>
        <button
          className="btn btn-sm"
          onClick={() => {
            setToken(null);
            qc.removeQueries({ queryKey: ['adminUsers'] });
          }}
        >
          ออกจากระบบ
        </button>
      </div>
      <Outlet />
    </>
  );
}
