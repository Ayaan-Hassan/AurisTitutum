import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import RealTimeClock from "./RealTimeClock";
import Icon from "./Icon";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "./ThemeProvider";
import AurisChat from "./AurisChat";

const Layout = ({
  children,
  userConfig,
  onAddHabit,
  habits = [],
  notifications = [],
  onNotificationsRead,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [aurisOpen, setAurisOpen] = useState(false);

  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (aurisOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [aurisOpen]);

  // Map path to view name for header
  const pathname = location.pathname;
  let viewName = "dashboard";
  if (pathname.startsWith("/app/habits")) viewName = "habits";
  else if (pathname.startsWith("/app/logs")) viewName = "logs";
  else if (pathname.startsWith("/app/notes")) viewName = "notes";
  else if (pathname.startsWith("/app/analytics")) viewName = "analytics";
  else if (pathname.startsWith("/app/settings")) viewName = "settings";
  else if (pathname.startsWith("/app/reminders")) viewName = "reminders";

  // Compute daily streak: consecutive days with at least one constructive ("Good") habit log
  const streak = (() => {
    const goodHabits = habits.filter((h) => h.type === "Good");
    const dateSet = new Set(
      goodHabits.flatMap((h) => (h.logs || []).map((l) => l.date)),
    );
    let count = 0;
    for (let i = 0; i < dateSet.size; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      const expectedStr = expectedDate.toISOString().split("T")[0];
      if (dateSet.has(expectedStr)) count++;
      else break;
    }
    return count;
  })();

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex h-screen overflow-hidden bg-bg-main text-text-primary font-sans transition-colors duration-300">
      <Sidebar userConfig={userConfig} onOpenAuris={() => setAurisOpen(true)} />

      <main className="flex-1 overflow-y-auto custom-scrollbar bg-bg-main relative transition-colors duration-300">
        <header className="h-16 sm:h-20 border-b border-border-color flex items-center justify-between px-3 sm:px-4 md:px-10 sticky top-0 bg-bg-main/80 backdrop-blur-xl z-20 transition-colors duration-300">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
            <button
              type="button"
              className="md:hidden w-9 h-9 rounded-xl border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-main/80"
              onClick={() => setMobileNavOpen(true)}
            >
              <div className="flex flex-col gap-1.5">
                <div className="w-4 h-0.5 bg-current rounded"></div>
                <div className="w-4 h-0.5 bg-current rounded"></div>
                <div className="w-4 h-0.5 bg-current rounded"></div>
              </div>
            </button>
            <h2 className="hidden sm:block text-[10px] font-mono text-text-secondary uppercase tracking-[0.25em] sm:tracking-[0.4em] truncate">
              {viewName}
            </h2>
            <div className="hidden sm:block h-4 w-[1px] bg-border-color"></div>
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 py-1.5 rounded-lg bg-success/10 border border-success/30 ${!user ? "px-2 sm:px-3" : "px-3"}`}
              >
                <Icon name="flame" size={12} className="text-success" />
                <span className="text-[10px] font-mono font-bold text-success uppercase tracking-wider">
                  {!user ? (
                    <>
                      <span className="sm:hidden">{streak}d</span>
                      <span className="hidden sm:inline">
                        {streak} day{streak !== 1 ? "s" : ""} streak
                      </span>
                    </>
                  ) : (
                    `${streak} day${streak !== 1 ? "s" : ""} streak`
                  )}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <button
              type="button"
              className="relative w-9 h-9 rounded-xl border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-main/70"
              onClick={() => {
                if (!user) {
                  const toastEvent = new CustomEvent("showToast", {
                    detail: {
                      message:
                        "Sign in to enable cross-device and smart notifications.",
                      type: "info",
                      id: Date.now(),
                    },
                  });
                  document.dispatchEvent(toastEvent);
                  return;
                }
                setNotificationsOpen((open) => !open);
                if (!notificationsOpen) {
                  onNotificationsRead?.();
                }
              }}
              title={!user ? "Notifications are available after sign in." : ""}
            >
              <Icon name="bell" size={15} />
              {unreadCount > 0 && user && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-accent text-bg-main text-[9px] font-bold flex items-center justify-center px-1">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <div className="hidden sm:block">
              <RealTimeClock />
            </div>
            <button
              onClick={onAddHabit}
              className="hidden sm:inline-flex px-3 sm:px-5 py-2 sm:py-2.5 bg-accent text-bg-main text-[10px] font-black rounded-lg hover:opacity-90 transition-all uppercase tracking-widest hover:scale-105 active:scale-95 h-9 sm:h-10 items-center"
            >
              <span className="sm:hidden flex items-center gap-1.5">
                <Icon name="plus" size={13} />
                <span className="text-[10px]">Add Habit</span>
              </span>
              <span className="hidden sm:inline">Add Habit</span>
            </button>
            {!user && (
              <button
                onClick={() => navigate("/login")}
                className="px-5 py-2.5 bg-bg-main border border-border-color text-text-secondary text-[10px] font-black rounded-lg hover:text-text-primary hover:bg-accent-dim transition-all uppercase tracking-widest hover:scale-105 active:scale-95 h-10"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        <div className="p-3 sm:p-4 md:p-10 max-w-7xl mx-auto pb-24 sm:pb-10">
          {children}
        </div>

        <button
          type="button"
          onClick={onAddHabit}
          className="sm:hidden fixed bottom-6 right-4 z-30 w-14 h-14 rounded-full bg-accent text-bg-main shadow-[0_12px_30px_rgba(0,0,0,0.45)] border border-white/20 flex items-center justify-center active:scale-95"
          aria-label="Add habit"
        >
          <Icon name="plus" size={22} />
        </button>

        {/* Mobile overlay navigation */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute top-0 bottom-0 left-0 w-72 max-w-[80%] bg-bg-sidebar border-r border-border-color p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between mb-4">
                <Link
                  to="/"
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                    <div className="w-3 h-3 bg-bg-main rotate-45" />
                  </div>
                  <h1 className="font-bold tracking-tighter text-lg text-text-primary">
                    AurisTitutum<span className="text-text-secondary">PRO</span>
                  </h1>
                </Link>
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-main/60"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
              <nav className="space-y-1 flex-1 overflow-y-auto custom-scrollbar">
                {[
                  {
                    href: "/app",
                    icon: "layout-dashboard",
                    label: "Main Console",
                  },
                  {
                    href: "/app/habits",
                    icon: "activity",
                    label: "Habit Registry",
                  },
                  { href: "/app/logs", icon: "file-text", label: "Logs" },
                  { href: "/app/notes", icon: "sticky-note", label: "Notes" },
                  {
                    href: "/app/analytics",
                    icon: "bar-chart-3",
                    label: "Analytics",
                  },
                  {
                    href: "/app/reminders",
                    icon: "bell",
                    label: "Reminders",
                  },
                  {
                    href: "/app/settings",
                    icon: "settings-2",
                    label: "Settings",
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`sidebar-item w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      (
                        item.href === "/app"
                          ? pathname === "/app" || pathname === "/app/"
                          : pathname.startsWith(item.href)
                      )
                        ? "active text-text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-accent-dim"
                    }`}
                  >
                    <Icon name={item.icon} size={16} />
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    setAurisOpen(true);
                  }}
                  className="sidebar-item w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-text-secondary hover:text-text-primary hover:bg-accent-dim"
                >
                  <Icon name="brain" size={16} />
                  Auris AI
                </button>
              </nav>
              {/* Theme Switcher */}
              <div className="flex bg-bg-main p-1 rounded-xl border border-border-color">
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${theme === "dark" ? "bg-accent text-bg-main shadow-lg" : "text-text-secondary hover:text-text-primary"}`}
                >
                  <Icon name="moon" size={12} />
                  Dark
                </button>
                <button
                  onClick={() => setTheme("light")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${theme === "light" ? "bg-accent text-bg-main shadow-lg" : "text-text-secondary hover:text-text-primary"}`}
                >
                  <Icon name="sun" size={12} />
                  Light
                </button>
              </div>
              {/* User profile card */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-bg-main border border-border-color">
                <div className="w-8 h-8 rounded-lg bg-card-bg border border-border-color flex items-center justify-center overflow-hidden font-bold text-[10px] text-text-secondary shrink-0">
                  {userConfig?.avatar ? (
                    <img
                      src={userConfig.avatar}
                      className="w-full h-full object-cover"
                      alt="Avatar"
                    />
                  ) : (
                    userConfig?.name?.[0] || "?"
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate text-text-primary">
                    {userConfig?.name || "User"}
                  </p>
                  <p className="text-[9px] text-text-secondary truncate uppercase font-mono tracking-tighter">
                    System Operator
                  </p>
                </div>
              </div>
              {!user && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    navigate("/login");
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-bg-main border border-border-color text-text-secondary text-[11px] font-black uppercase tracking-[0.3em] mt-2"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notification dropdown */}
        {notificationsOpen && user && (
          <div className="fixed top-16 sm:top-20 right-3 sm:right-4 md:right-10 z-30 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm">
            <div className="glass-card p-4 rounded-2xl border border-border-color bg-bg-main/95 backdrop-blur-xl shadow-xl max-h-80 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary">
                  Notifications
                </p>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    className="text-[10px] text-text-secondary hover:text-text-primary"
                    onClick={() => {
                      onNotificationsRead?.();
                      setNotificationsOpen(false);
                    }}
                  >
                    Mark read
                  </button>
                )}
              </div>
              {notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-xl border px-3 py-2 text-xs ${n.read ? "border-border-color/60 bg-bg-main" : "border-accent/40 bg-accent/5"}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-text-primary">
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                        )}
                      </div>
                      <p className="text-[11px] text-text-secondary">
                        {n.body}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-text-secondary">
                    No recent notifications.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <AurisChat isOpen={aurisOpen} onClose={() => setAurisOpen(false)} />
    </div>
  );
};

export default Layout;
