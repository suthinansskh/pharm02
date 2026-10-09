import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'บันทึกการเข้าร่วม', end: true },
  { to: '/events', label: 'กิจกรรม' },
  { to: '/summary', label: 'สรุปผล' },
  { to: '/volunteer', label: 'จิตอาสา' },
  { to: '/admin', label: 'ผู้ดูแล' },
];

export default function Layout() {
  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-brand">บันทึกการประชุมกลุ่มงานเภสัชกรรม</div>
          <div className="nav-links">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                {l.label}
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
