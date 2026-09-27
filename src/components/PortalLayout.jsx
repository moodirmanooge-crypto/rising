import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { STATUS_META } from "../config/schoolOptions";

const ROLE_LABEL = {
  admin: "Administrator",
  teacher: "Teacher",
  student: "Student",
};

export function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

// Coloured status pill: Present / Absent / Late / Excused
export function StatusPill({ status, small }) {
  const meta = STATUS_META[status] || { label: status || "—", so: "", tone: "gray" };
  return (
    <span className={`pill pill-${meta.tone} ${small ? "pill-sm" : ""}`}>
      <span className="pill-dot" />
      {meta.label}
      {!small && meta.so && <em>{meta.so}</em>}
    </span>
  );
}

export function LiveBadge({ label = "LIVE" }) {
  return (
    <span className="live-badge">
      <span className="live-dot" />
      {label}
    </span>
  );
}

// Shared shell for the three portals: sidebar on desktop, top bar with
// scrollable nav on mobile.
// nav = [{ key, label, Icon, badge }]
export default function PortalLayout({ role, title, subtitle, nav = [], active, onNavigate, actions, children }) {
  const { user, logout } = useAuth();
  const name = user?.fullName || user?.username || "";

  return (
    <div className={`layout role-${role}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Rising Star School" />
          <div>
            <strong>Rising Star</strong>
            <span>School System</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {nav.map(({ key, label, Icon, badge }) => (
            <button
              key={key}
              type="button"
              className={`nav-item ${active === key ? "active" : ""}`}
              onClick={() => onNavigate?.(key)}
            >
              {Icon && <Icon size={18} />}
              <span>{label}</span>
              {badge ? <b className="nav-badge">{badge}</b> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">
            {user?.photoUrl ? <img src={user.photoUrl} alt={name} /> : initials(name)}
          </div>
          <div className="sidebar-user-text">
            <strong>{name}</strong>
            <span>{ROLE_LABEL[role]}</span>
          </div>
          <button type="button" className="icon-btn" onClick={logout} title="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-mobile-brand">
            <img src="/logo.png" alt="" />
          </div>
          <div className="topbar-title">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar-actions">
            {actions}
            <button type="button" className="btn btn-ghost mobile-logout" onClick={logout}>
              <LogOut size={16} /> Log out
            </button>
          </div>
        </header>

        {nav.length > 1 && (
          <nav className="mobile-nav">
            {nav.map(({ key, label, Icon, badge }) => (
              <button
                key={key}
                type="button"
                className={`mobile-nav-item ${active === key ? "active" : ""}`}
                onClick={() => onNavigate?.(key)}
              >
                {Icon && <Icon size={16} />}
                {label}
                {badge ? <b className="nav-badge">{badge}</b> : null}
              </button>
            ))}
          </nav>
        )}

        <div className="content">{children}</div>
      </main>
    </div>
  );
}