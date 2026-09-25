import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ role, children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to={`/login/${role}`} replace />;
  if (user.role !== role) return <Navigate to={`/login/${role}`} replace />;

  return children;
}
