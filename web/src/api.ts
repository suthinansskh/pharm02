import type { AdminUser, AdminUserInput, EventInput, EventItem, RecordsPage, UserInfo, VolunteerActivity, VolunteerActivityInput, VolunteersPage } from './types';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;
const TIMEOUT_MS = 20000;

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: string; message: string };

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new ApiError('http_' + res.status, 'เซิร์ฟเวอร์ตอบกลับผิดปกติ');
    const body = (await res.json()) as Envelope<T>;
    if (!body.ok) throw new ApiError(body.error, body.message);
    return body.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') throw new ApiError('timeout', 'เซิร์ฟเวอร์ใช้เวลานานเกินไป');
    throw new ApiError('network', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
  } finally {
    clearTimeout(timer);
  }
}

function base(): string {
  if (!API_URL) throw new ApiError('config', 'ยังไม่ได้ตั้งค่า VITE_API_URL');
  return API_URL;
}

function get<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ action, ...params });
  return send<T>(`${base()}?${qs}`);
}

// text/plain keeps the POST a "simple request": no CORS preflight (Apps Script can't answer one).
function post<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  return send<T>(base(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...body }),
  });
}

export const api = {
  events: () => get<EventItem[]>('events'),
  categories: () => get<string[]>('categories'),
  records: (limit?: number) => get<RecordsPage>('records', limit ? { limit: String(limit) } : {}),
  volunteers: () => get<VolunteersPage>('volunteers'),
  volunteerActivities: () => get<VolunteerActivity[]>('volunteerActivities'),
  lookup: (psCode: string) => get<UserInfo>('lookup', { psCode }),
  addRecord: (psCode: string, eventId: string) =>
    post<{ name: string; event: string; points: number }>('addRecord', { psCode, eventId }),
  addVolunteer: (v: { psCode: string; activityId: string; detail: string }) =>
    post<{ id: string; name: string; activity: string; round: string }>('addVolunteer', v),
  saveVolunteerActivity: (token: string, a: VolunteerActivityInput) => post<{ id: string }>('saveVolunteerActivity', { token, ...a }),
  deleteVolunteerActivity: (token: string, id: string) => post<{ id: string }>('deleteVolunteerActivity', { token, id }),
  deleteVolunteer: (token: string, id: string) => post<{ id: string }>('deleteVolunteer', { token, id }),
  listUsers: (token: string) => post<AdminUser[]>('listUsers', { token }),
  saveUser: (token: string, user: AdminUserInput) => post<{ psCode: string }>('saveUser', { token, ...user }),
  deleteUser: (token: string, psCode: string) => post<{ psCode: string }>('deleteUser', { token, psCode }),
  login: (password: string) => post<{ token: string; expiresIn: number }>('login', { password }),
  saveEvent: (token: string, event: EventInput) => post<{ id: string }>('saveEvent', { token, ...event }),
  deleteEvent: (token: string, id: string) => post<{ id: string }>('deleteEvent', { token, id }),
  saveCategories: (token: string, names: string[]) => post<string[]>('saveCategories', { token, names }),
  removeDuplicates: (token: string) => post<{ removed: number }>('removeDuplicates', { token }),
};
