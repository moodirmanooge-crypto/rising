import { Link } from "react-router-dom";
import {
  Shield, BookOpen, GraduationCap, ArrowRight,
  Plane, Sun, Star, Users, Trophy, Heart,
} from "lucide-react";

const PORTALS = [
  {
    to: "/login/admin",
    title: "Admin Portal",
    desc: "Register students & teachers, manage records and settings",
    Icon: Shield,
    className: "admin",
  },
  {
    to: "/login/teacher",
    title: "Teacher Portal",
    desc: "Mark daily attendance for your students",
    Icon: BookOpen,
    className: "teacher",
  },
  {
    to: "/login/student",
    title: "Student Portal",
    desc: "View your information & attendance history",
    Icon: GraduationCap,
    className: "student",
  },
];

const BADGES = [
  { Icon: Users, label: "Quality Education", className: "admin" },
  { Icon: Trophy, label: "Bright Future", className: "teacher" },
  { Icon: BookOpen, label: "Skilled Teachers", className: "student" },
  { Icon: Heart, label: "Safe Learning", className: "danger" },
];

export default function Home() {
  return (
    <div className="home">
      <div className="home-sky">
        <Plane className="float-icon plane" />
        <Sun className="float-icon sun" />
        <BookOpen className="float-icon book" />
        <GraduationCap className="float-icon cap" />
      </div>

      <div className="home-hero">
        <div className="home-logo-ring">
          <img src="/logo.png" alt="Rising Star School logo" className="home-logo" />
        </div>

        <h1>
          <span className="accent">Rising Star</span> Primary &amp; Secondary School
        </h1>

        <div className="tagline">
          <span className="tagline-line" />
          <span>Knowledge Today &nbsp;•&nbsp; Better Tomorrow</span>
          <span className="tagline-line" />
        </div>
        <Star className="tagline-star" fill="currentColor" />

        <p className="choose-text">Choose a portal to continue</p>
      </div>

      <div className="portal-links">
        {PORTALS.map(({ to, title, desc, Icon, className }) => (
          <div key={to} className={`portal-card ${className}`}>
            <div className="portal-card-header">
              <span className="deco-dot d1" />
              <span className="deco-dot d2" />
              <div className="portal-icon-circle">
                <Icon size={30} strokeWidth={2.2} />
              </div>
            </div>
            <div className="portal-card-body">
              <h3>{title}</h3>
              <p>{desc}</p>
              <Link className="portal-btn" to={to}>
                Enter {title} <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="home-badges">
        {BADGES.map(({ Icon, label, className }, i) => (
          <span key={label} className="badge-item">
            {i > 0 && <span className="badge-divider" />}
            <span className={`badge-icon ${className}`}>
              <Icon size={14} />
            </span>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}