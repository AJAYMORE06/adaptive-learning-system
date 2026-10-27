import { Navigate, Outlet } from "react-router-dom";

interface ProtectedRouteProps {
  allowedRoles: string[];
}

export default function ProtectedRoute({
  allowedRoles,
}: ProtectedRouteProps) {
  const token = sessionStorage.getItem("access_token");
  const role = sessionStorage.getItem("user_role")?.trim().toLowerCase();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !allowedRoles.map((r) => r.toLowerCase()).includes(role)) {
    if (role === "admin") {
      return <Navigate to="/admin" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}