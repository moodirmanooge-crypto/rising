import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const TITLES = {
  admin: "Admin Portal",
  teacher: "Teacher Portal",
  student: "Student Portal",
};

const USERNAME_LABEL = {
  admin: "Username or Email",
  teacher: "Username",
  student: "Student ID",
};

export default function Login() {
  const { role } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="login-page">
      <form className="card login-form" onSubmit={handleSubmit}>
        <img src="/logo.png" alt="Rising Star School logo" className="login-logo" />
        <h1>Rising Star School</h1>
        <h2>{TITLES[role] || "Login"}</h2>

        {error && <p className="error">{error}</p>}

        <label>
          {USERNAME_LABEL[role] || "Username"}
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
