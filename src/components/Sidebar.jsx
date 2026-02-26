import { Link, useLocation } from "react-router-dom";
import Icon from "./Icon";
import { useTheme } from "./ThemeProvider";

const Sidebar = ({ userConfig, onOpenAuris }) => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const path = location.pathname;

  const navItems = [
    { id: "/app", icon: "layout-dashboard", label: "Main Console" },
    { id: "/app/habits", icon: "activity", label: "Habit Registry" },
    { id: "/app/logs", icon: "file-text", label: "Logs" },
    { id: "/app/notes", icon: "sticky-note", label: "Notes" },
    { id: "/app/analytics", icon: "bar-chart-3", label: "Analytics" },
    { id: "/app/reminders", icon: "bell", label: "Reminders" },
    { id: "/app/settings", icon: "settings-2", label: "Settings" },
  ];

  const isActive = (href) => {
    if (href === "/app") {
      return path === "/app" || path === "/app/";
    }
    return path.startsWith(href);
  };

  return (
    <>
      <aside className="w-64 bg-bg-sidebar border-r border-border-color flex flex-col shrink-0 h-screen transition-all duration-300 max-md:hidden md:flex">
        <div className="p-8">
          <Link
            to="/"
            className="flex items-center gap-3 mb-12 cursor-pointer group"
          >
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center transition-transform group-hover:scale-110">
              <div className="w-3 h-3 bg-bg-main rotate-45"></div>
            </div>
            <h1 className="font-bold tracking-tighter text-xl text-text-primary">
              AurisTitutum<span className="text-text-secondary">PRO</span>
            </h1>
          </Link>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={item.id}
                className={`sidebar-item w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.id)
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
              onClick={() => onOpenAuris?.()}
              className="sidebar-item w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-text-secondary hover:text-text-primary hover:bg-accent-dim"
            >
              <Icon name="brain" size={16} />
              Auris AI
            </button>
          </nav>
        </div>
        <div className="mt-auto p-6 space-y-4">
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

          <div className="flex items-center gap-3 p-2 rounded-xl bg-bg-main border border-border-color">
            <div className="w-8 h-8 rounded-lg bg-card-bg border border-border-color flex items-center justify-center overflow-hidden font-bold text-[10px] text-text-secondary">
              {userConfig.avatar ? (
                <img
                  src={userConfig.avatar}
                  className="w-full h-full object-cover"
                  alt="Avatar"
                />
              ) : (
                userConfig.name?.[0] || "?"
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold truncate text-text-primary">
                {userConfig.name}
              </p>
              <p className="text-[9px] text-text-secondary truncate uppercase font-mono tracking-tighter">
                System Operator
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
