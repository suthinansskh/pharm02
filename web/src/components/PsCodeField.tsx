import { useEffect, useState } from 'react';
import { useUser } from '../queries';
import type { UserInfo } from '../types';

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * State for a "type your PS Code, see who you are" field.
 * `user` is only set once the debounced lookup matches what is currently typed.
 */
export function usePsCode() {
  const [input, setInput] = useState('');
  const typed = input.trim();
  const psCode = useDebounced(typed, 400);
  const query = useUser(psCode);
  const settled = typed === psCode;
  const user: UserInfo | null = settled && query.data ? query.data : null;
  return { input, setInput, psCode, typed, settled, query, user, reset: () => setInput('') };
}

export type PsCodeState = ReturnType<typeof usePsCode>;

export default function PsCodeField({ state }: { state: PsCodeState }) {
  const { input, setInput, typed, settled, query, user } = state;
  return (
    <>
      <label className="field">
        <span>PS Code</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="กรอก PS Code"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={30}
          required
          aria-invalid={settled && query.isError}
        />
      </label>

      {typed && !settled && <p className="hint">กำลังตรวจสอบ...</p>}
      {typed && settled && query.isFetching && <p className="hint">กำลังค้นหาผู้ใช้...</p>}
      {typed && settled && query.isError && (
        <p className="hint hint-error" role="alert">
          {query.error instanceof Error ? query.error.message : 'ค้นหาไม่สำเร็จ'}
        </p>
      )}
      {user && (
        <dl className="info ok">
          <div><dt>ชื่อ-นามสกุล</dt><dd>{user.name}</dd></div>
          <div><dt>ตำแหน่ง</dt><dd>{user.position || '-'}</dd></div>
          <div><dt>หน่วยงาน</dt><dd>{user.department || '-'}</dd></div>
        </dl>
      )}
    </>
  );
}
