import { Link } from "react-router-dom";

const PORTALS = [
  {
    to: "/login/admin",
    title: "Admin Portal",
    desc: "Register students & teachers, manage records",
    icon: "🛡️",
    className: "admin",
  },
  {
    to: "/login/teacher",
    title: "Teacher Portal",
    desc: "Mark daily attendance for your students",
    icon: "📘",
    className: "teacher",
  },
  {
    to: "/login/student",
    title: "Student Portal",
    desc: "View your info & attendance history",
    icon: "🎓",
    className: "student",
  },
];

export default function Home() {
  return (
    <div className="home">
      <div className="home-hero">
        <img src="/logo.png" alt="Rising Star School logo" className="home-logo" />
        <h1>Rising Star Primary &amp; Secondary School</h1>
        <p>Choose a portal to continue</p>
      </div>

      <div className="portal-links">
        {PORTALS.map((p) => (
          <Link key={p.to} className={`portal-card ${p.className}`} to={p.to}>
            <span className="portal-icon">{p.icon}</span>
            <span className="portal-title">{p.title}</span>
            <span className="portal-desc">{p.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
