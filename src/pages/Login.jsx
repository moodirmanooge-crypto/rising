import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Shield, BookOpen, GraduationCap, Wallet, ArrowLeft, User, KeyRound, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const TITLES = {
  admin: "Admin Portal",
  teacher: "Teacher Portal",
  student: "Student Portal",
  cashier: "Cashier Portal",
};

const USERNAME_LABEL = {
  admin: "Username or Email",
  teacher: "Username",
  student: "Student ID",
  cashier: "Username",
};

const ROLE_INFO = {
  admin: { Icon: Shield, text: "Manage students, teachers and review attendance live." },
  teacher: { Icon: BookOpen, text: "Take attendance for your class during your scheduled time." },
  student: { Icon: GraduationCap, text: "See your attendance for every subject, updated live." },
  cashier: { Icon: Wallet, text: "Receive monthly fees and print A5 receipts for every student." },
};

export default function Login() {
  const { role } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const info = ROLE_INFO[role] || ROLE_INFO.admin;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(role, username, password);
      navigate(`/${role}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`login-page role-${role}`}>
      <div className="login-shell">
        <div className="login-side">
          <Link to="/" className="login-back"><ArrowLeft size={16} /> Home</Link>
          <div className="login-side-body">
            <div className="login-side-icon"><info.Icon size={30} /></div>
            <h2>{TITLES[role] || "Login"}</h2>
            <p>{info.text}</p>
          </div>
          <span className="login-side-foot">Knowledge Today • Better Tomorrow</span>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <img src="/logo.png" alt="Rising Star School logo" className="login-logo" />
          <h1>Rising Star School</h1>
          <h2>Sign in to the {TITLES[role] || "portal"}</h2>

          {error && <p className="error">{error}</p>}

          <label>
            {USERNAME_LABEL[role] || "Username"}
            <div className="input-icon">
              <User size={17} />
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </label>
          <label>
            Password
            <div className="input-icon">
              <KeyRound size={17} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          <button type="submit" className="btn btn-primary btn-lg full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}