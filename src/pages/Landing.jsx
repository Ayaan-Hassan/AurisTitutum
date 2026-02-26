import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import Icon from "../components/Icon";

const Landing = ({ habits, user }) => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  const hasLocalData = useMemo(
    () => Array.isArray(habits) && habits.length > 0,
    [habits],
  );
  const isLoggedIn = !!user;

  useEffect(() => {
    if (hasLocalData || isLoggedIn) {
      const timer = setTimeout(() => navigate("/app", { replace: true }), 600);
      return () => clearTimeout(timer);
    }
  }, [hasLocalData, isLoggedIn, navigate]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleGetStarted = () => navigate("/app");
  const handleSignIn = () => navigate("/login");

  const features = [
    {
      icon: "activity",
      title: "Habit Tracking Done Right",
      desc: "Create streams for constructive or destructive behaviors. Log in one tap and review clean daily histories.",
    },
    {
      icon: "flame",
      title: "Streaks & Perfect Weeks",
      desc: "Stay motivated with streak visualizations, perfect week tracking, and a calendar that makes momentum obvious.",
    },
    {
      icon: "brain",
      title: "Auris AI (Coming Soon)",
      desc: "An intelligent companion to surface insights, spot patterns, and coach you on building better systems.",
    },
    {
      icon: "file-spreadsheet",
      title: "Exports & Data Ownership",
      desc: "Export structured logs and sync to Google Sheets so your data plugs into any external system you choose.",
    },
    {
      icon: "cloud-sync",
      title: "Sync Across Devices",
      desc: "Sign in to keep your habits, streaks, and analytics perfectly aligned across all your devices.",
    },
    {
      icon: "bell",
      title: "Smart Notifications",
      desc: "Intelligently-timed reminders keep you active without spamming or overlapping alerts.",
    },
  ];

  const steps = [
    {
      step: "01",
      title: "Create one clear habit",
      desc: "Start with a single, high-leverage habit. Name it, tag it as good or bad, and choose tap, count, or check mode.",
    },
    {
      step: "02",
      title: "Tap your day into the console",
      desc: "Use the dashboard or habit registry to log actions in seconds. Bad-habit logs stay separate and never inflate your streaks.",
    },
    {
      step: "03",
      title: "Review logs and streaks",
      desc: "Check the calendar and logs view to see which days you really showed up. Sign in to unlock analytics and Auris AI.",
    },
  ];

  const testimonials = [
    {
      initials: "AK",
      name: "Amara Khan",
      role: "Product Designer",
      quote:
        "Auristitutum replaced three separate trackers for me. The streaks and logs are minimal but insanely clear.",
    },
    {
      initials: "JL",
      name: "James Lee",
      role: "Software Engineer",
      quote:
        "The dashboard feels like a control room for my life. Perfect week tracking made it easy to plug into my own analytics.",
    },
    {
      initials: "RS",
      name: "Ritika Singh",
      role: "Indie Founder",
      quote:
        "I finally built a 90-day writing streak. The interface stays out of the way but the streak calendar quietly keeps me honest.",
    },
  ];

  return (
    <div className="min-h-screen bg-bg-main text-text-primary overflow-x-hidden">
      {/* ── HEADER ── */}
      <header
        className={`sticky top-0 z-30 border-b border-border-color/60 bg-bg-main/85 backdrop-blur-md transition-all duration-300 ${
          scrolled ? "shadow-[0_4px_24px_rgba(0,0,0,0.3)]" : ""
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-accent rounded-lg flex items-center justify-center">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-bg-main rotate-45" />
            </div>
            <span className="text-xs font-bold tracking-tighter leading-none">
              AurisTitutum<span className="text-text-secondary">PRO</span>
            </span>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSignIn}
              className="h-8 px-3 rounded-lg border border-border-color text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all"
            >
              Sign In
            </button>
            <button
              onClick={handleGetStarted}
              className="h-8 px-3 sm:px-4 rounded-lg bg-accent text-bg-main text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all"
            >
              <span className="sm:hidden">Open</span>
              <span className="hidden sm:inline">Open App</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative px-4 sm:px-8 pt-12 sm:pt-20 pb-14 sm:pb-20 border-b border-border-color/60 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-6xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* ── Hero Copy ── */}
            <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-500 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-color bg-accent-dim mx-auto lg:mx-0">
                <span className="w-1.5 h-1.5 rounded-full bg-success/80 animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary">
                  Habit Intelligence Platform
                </span>
              </div>

              <h1 className="text-[1.85rem] sm:text-4xl lg:text-5xl font-semibold tracking-tight text-text-primary leading-[1.15]">
                Operate your habits like an{" "}
                <span className="text-text-secondary">enterprise system.</span>
              </h1>

              <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-xl mx-auto lg:mx-0">
                A calm, data-grade console for building consistent routines,
                tracking streaks, and understanding behavior trends — without
                the noise.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1 justify-center lg:justify-start">
                <button
                  onClick={handleGetStarted}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-accent text-bg-main text-[11px] font-black uppercase tracking-widest hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                >
                  Open Habit Console
                </button>
                <button
                  onClick={handleSignIn}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-border-color text-[11px] font-black uppercase tracking-widest text-text-secondary hover:text-text-primary hover:border-text-secondary hover:bg-accent-dim transition-all"
                >
                  Sign In
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-3 sm:gap-5 pt-1 text-[10px] text-text-secondary uppercase tracking-wider justify-center lg:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <Icon
                    name="shield-check"
                    size={12}
                    className="text-text-secondary"
                  />{" "}
                  Privacy-first
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon
                    name="sparkles"
                    size={12}
                    className="text-text-secondary"
                  />{" "}
                  No ads
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon
                    name="line-chart"
                    size={12}
                    className="text-text-secondary"
                  />{" "}
                  Analytics
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="lock" size={12} className="text-text-secondary" />{" "}
                  Free to start
                </span>
              </div>
            </div>

            {/* ── Product Preview Card ── */}
            <div className="w-full max-w-sm mx-auto lg:mx-0 lg:ml-auto">
              <div className="rounded-2xl border border-border-color/80 bg-card-bg/80 shadow-[0_20px_60px_rgba(0,0,0,0.45)] p-4 sm:p-5 space-y-3.5 backdrop-blur-sm">
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary">
                    Today&apos;s snapshot
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 border border-success/30 px-2 py-0.5">
                    <Icon name="flame" size={9} className="text-success" />
                    <span className="text-[9px] font-mono text-success uppercase tracking-wider">
                      14d streak
                    </span>
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Habits", value: "6", color: "text-text-primary" },
                    { label: "Streak", value: "14d", color: "text-success" },
                    { label: "Focus", value: "82%", color: "text-accent" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl bg-bg-main border border-border-color p-3 space-y-0.5"
                    >
                      <p className="text-[9px] text-text-secondary uppercase tracking-wider">
                        {stat.label}
                      </p>
                      <p
                        className={`text-base sm:text-lg font-mono font-semibold ${stat.color}`}
                      >
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Mini bar chart */}
                <div className="rounded-xl bg-bg-main border border-border-color p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-mono uppercase tracking-wider text-text-secondary">
                      This week
                    </p>
                    <span className="text-[9px] text-text-secondary font-mono">
                      Mon–Sun
                    </span>
                  </div>
                  <div className="flex items-end gap-1 h-12 sm:h-14">
                    {[40, 72, 55, 90, 68, 52, 80].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm bg-accent/10 overflow-hidden"
                      >
                        <div
                          className="w-full bg-accent rounded-sm transition-all"
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Habit list preview */}
                <div className="space-y-1.5">
                  {[
                    { name: "Morning Run", done: true },
                    { name: "Read 30 min", done: true },
                    { name: "Cold Shower", done: false },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-bg-main border border-border-color"
                    >
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                          item.done
                            ? "bg-accent border-accent"
                            : "border-border-color"
                        }`}
                      >
                        {item.done && (
                          <Icon
                            name="check"
                            size={9}
                            className="text-bg-main"
                          />
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-medium ${item.done ? "text-text-secondary line-through" : "text-text-primary"}`}
                      >
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <main className="relative z-10 bg-bg-main">
        {/* ── FEATURES ── */}
        <section className="px-4 sm:px-8 py-14 sm:py-20 max-w-6xl mx-auto">
          <div className="mb-8 sm:mb-10 text-center sm:text-left">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-2">
              System Capabilities
            </p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              Everything you need to stay on track
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {features.map((f, i) => (
              <Card key={i} className="flex flex-col p-4 sm:p-5 gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-accent/10 border border-border-color flex items-center justify-center shrink-0">
                  <Icon name={f.icon} size={16} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-bold mb-1 text-text-primary">
                    {f.title}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ── DIVIDER ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="h-px bg-border-color/60" />
        </div>

        {/* ── HOW IT WORKS ── */}
        <section className="px-4 sm:px-8 py-14 sm:py-20 max-w-6xl mx-auto">
          <div className="mb-8 sm:mb-10 text-center sm:text-left">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-2">
              Simple daily loop
            </p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              Three steps to stay consistent
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {steps.map((s, i) => (
              <Card
                key={i}
                className="relative flex flex-col p-4 sm:p-5 gap-3 overflow-hidden"
              >
                <div className="absolute top-4 right-4 sm:top-5 sm:right-5 text-[40px] sm:text-[52px] font-black text-border-color/30 leading-none select-none pointer-events-none">
                  {s.step}
                </div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-text-secondary">
                  {s.step}
                </p>
                <h3 className="text-sm font-bold text-text-primary pr-8">
                  {s.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {s.desc}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* ── DIVIDER ── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="h-px bg-border-color/60" />
        </div>

        {/* ── TESTIMONIALS ── */}
        <section className="px-4 sm:px-8 py-14 sm:py-20 max-w-6xl mx-auto">
          <div className="mb-8 sm:mb-10 text-center sm:text-left">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-2">
              Operators in the wild
            </p>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              Trusted by disciplined builders
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {testimonials.map((t, i) => (
              <Card key={i} className="flex flex-col p-4 sm:p-5 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent-dim border border-border-color flex items-center justify-center text-xs font-bold shrink-0 text-text-primary">
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate text-text-primary">
                      {t.name}
                    </p>
                    <p className="text-[9px] text-text-secondary uppercase tracking-wider truncate">
                      {t.role}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-text-secondary flex-1 leading-relaxed">
                  &quot;{t.quote}&quot;
                </p>
                <div className="flex items-center gap-0.5 text-accent">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Icon key={j} name="star" size={11} />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ── FOOTER CTA ── */}
        <section className="px-4 sm:px-8 pb-12 sm:pb-16 max-w-6xl mx-auto">
          <div className="rounded-2xl border border-border-color bg-card-bg/60 p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-6">
              <div className="space-y-1.5">
                <p className="text-[9px] font-mono uppercase tracking-wider text-text-secondary">
                  Ready when you are
                </p>
                <h3 className="text-base sm:text-lg font-bold tracking-tight">
                  Start your next streak today
                </h3>
                <p className="text-xs text-text-secondary max-w-md leading-relaxed">
                  No forced login. Track one habit locally for free — then sign
                  in when you want sync, analytics, and Auris AI.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto shrink-0">
                <button
                  onClick={handleGetStarted}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-accent text-bg-main text-[11px] font-black uppercase tracking-widest hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Open Console
                </button>
                <button
                  onClick={handleSignIn}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl border border-border-color text-[11px] font-black uppercase tracking-widest text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t border-border-color/60 px-4 sm:px-8 py-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-accent rounded-md flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-bg-main rotate-45" />
              </div>
              <span className="text-[10px] font-bold tracking-tighter text-text-secondary">
                AurisTitutum PRO
              </span>
            </div>
            <p className="text-[9px] text-text-secondary/60 uppercase tracking-wider text-center">
              Habit Intelligence Platform &mdash; Built for disciplined
              operators
            </p>
          </div>
        </footer>
      </main>

      {/* ── MOBILE STICKY CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 sm:hidden bg-bg-main/95 backdrop-blur-md border-t border-border-color px-4 py-3 flex gap-2.5">
        <button
          onClick={handleSignIn}
          className="flex-1 py-3 rounded-xl border border-border-color text-[11px] font-black uppercase tracking-widest text-text-secondary hover:text-text-primary transition-all"
        >
          Sign In
        </button>
        <button
          onClick={handleGetStarted}
          className="flex-1 py-3 rounded-xl bg-accent text-bg-main text-[11px] font-black uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Open App
        </button>
      </div>

      {/* Bottom spacer for mobile sticky CTA */}
      <div className="h-16 sm:hidden" />
    </div>
  );
};

export default Landing;
