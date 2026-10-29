
import { Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";

interface ProtectedRouteProps {
  allowedRoles: string[];
}

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_LOGOUT_MS = 60 * 1000;
const LAST_ACTIVITY_KEY = "last_activity";

function logout() {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("user_role");
  sessionStorage.removeItem(LAST_ACTIVITY_KEY);

  fetch("http://localhost:8000/api/auth/logout", {
    method: "POST",
    credentials: "include",
  }).finally(() => {
    window.location.replace("/login");
  });
}

export default function ProtectedRoute({
  allowedRoles,
}: ProtectedRouteProps) {
  const token = sessionStorage.getItem("access_token");
  const role = sessionStorage.getItem("user_role")?.trim().toLowerCase();

  useEffect(() => {
    if (!token) return;

    let warningTimeout: ReturnType<typeof setTimeout>;
    let logoutTimeout: ReturnType<typeof setTimeout>;

    const clearTimers = () => {
      clearTimeout(warningTimeout);
      clearTimeout(logoutTimeout);
    };

    const scheduleFromLastActivity = () => {
      clearTimers();

      const lastActivity = Number(
        sessionStorage.getItem(LAST_ACTIVITY_KEY) || Date.now()
      );

      const remaining =
        INACTIVITY_LIMIT_MS - (Date.now() - lastActivity);

      if (remaining <= 0) {
        logout();
        return;
      }

      const warningDelay =
        remaining - WARNING_BEFORE_LOGOUT_MS;

      if (warningDelay <= 0) {
        warningTimeout = setTimeout(showInactivityWarning, 0);
      } else {
        warningTimeout = setTimeout(
          showInactivityWarning,
          warningDelay
        );
      }

      logoutTimeout = setTimeout(logout, remaining);
    };

    function showInactivityWarning() {
      const lastActivity = Number(
        sessionStorage.getItem(LAST_ACTIVITY_KEY) || Date.now()
      );

      const remaining =
        INACTIVITY_LIMIT_MS - (Date.now() - lastActivity);

      if (remaining <= 0) {
        logout();
        return;
      }

      // Native browser dialog: mouse movement cannot dismiss it.
      const stayLoggedIn = window.confirm(
        "You have been inactive. Select OK to stay logged in, or Cancel to log out."
      );

      if (stayLoggedIn) {
        sessionStorage.setItem(
          LAST_ACTIVITY_KEY,
          String(Date.now())
        );
        scheduleFromLastActivity();
      } else {
        logout();
      }
    }

    const resetInactivityTimer = () => {
      sessionStorage.setItem(
        LAST_ACTIVITY_KEY,
        String(Date.now())
      );
      scheduleFromLastActivity();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const lastActivity = Number(
          sessionStorage.getItem(LAST_ACTIVITY_KEY) || Date.now()
        );

        if (Date.now() - lastActivity >= INACTIVITY_LIMIT_MS) {
          logout();
        } else {
          scheduleFromLastActivity();
        }
      }
    };

    const lastActivity = Number(
      sessionStorage.getItem(LAST_ACTIVITY_KEY) || Date.now()
    );

    if (Date.now() - lastActivity >= INACTIVITY_LIMIT_MS) {
      logout();
      return;
    }

    scheduleFromLastActivity();

    const activityEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer, {
        passive: true,
      });
    });

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      clearTimers();

      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [token]);

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
