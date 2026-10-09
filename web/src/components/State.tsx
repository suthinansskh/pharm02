import type { ReactNode } from 'react';

export function Loading({ text = 'กำลังโหลดข้อมูล...' }: { text?: string }) {
  return <div className="state">{text}</div>;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
  return (
    <div className="state state-error" role="alert">
      <p>{msg}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          ลองใหม่
        </button>
      )}
    </div>
  );
}

export function Card({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      <header className="card-head">
        <h2>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}
