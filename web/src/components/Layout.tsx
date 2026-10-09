import { NavLink, Outlet, useLocation } from 'react-router-dom';

interface Tab {
  to: string;
  label: string;
  end?: boolean;
}

interface Section {
  key: string;
  label: string;
  /** Path prefix that marks this section as current. */
  match: (path: string) => boolean;
  tabs: Tab[];
}

// Site map: three sections, each with its own tabs.
const SECTIONS: Section[] = [
  {
    key: 'record',
    label: 'บันทึก',
    match: (p) => p === '/' || p.startsWith('/volunteer'),
    tabs: [
      { to: '/', label: 'การเข้าร่วมประชุม', end: true },
      { to: '/volunteer', label: 'งานจิตอาสา' },
    ],
  },
  {
    key: 'summary',
    label: 'สรุปผล',
    match: (p) => p.startsWith('/summary'),
    tabs: [
      { to: '/summary', label: 'การประชุม', end: true },
      { to: '/summary/volunteer', label: 'งานจิตอาสา' },
    ],
  },
  {
    key: 'admin',
    label: 'จัดการ',
    match: (p) => p.startsWith('/admin'),
    tabs: [
      { to: '/admin/events', label: 'กิจกรรมประชุม' },
      { to: '/admin/volunteer-activities', label: 'กิจกรรมจิตอาสา' },
      { to: '/admin/users', label: 'ผู้ใช้งาน' },
      { to: '/admin/categories', label: 'ประเภทกิจกรรม' },
      { to: '/admin/tools', label: 'เครื่องมือ' },
    ],
  },
];

export default function Layout() {
  const { pathname } = useLocation();
  const current = SECTIONS.find((s) => s.match(pathname)) ?? SECTIONS[0];

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-brand">บันทึกการประชุมกลุ่มงานเภสัชกรรม</div>
          <div className="nav-links">
            {SECTIONS.map((s) => (
              <NavLink
                key={s.key}
                to={s.tabs[0].to}
                className={'nav-link' + (s.key === current.key ? ' active' : '')}
                aria-current={s.key === current.key ? 'page' : undefined}
              >
                {s.label}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="subnav">
          <div className="nav-inner subnav-inner">
            {current.tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => 'subnav-link' + (isActive ? ' active' : '')}>
                {t.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
