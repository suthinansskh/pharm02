import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { useAdmin } from '../admin';
import { useToast } from './Toast';

export default function LoginForm() {
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
