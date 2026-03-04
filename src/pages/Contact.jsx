import { useState } from "react";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

// ─── Contact Us Page ─────────────────────────────────────────────────────────
const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (status) setStatus(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setLoading(true);
    setStatus(null);
    setErrorMsg("");

    try {
      // Use Web3Forms (free, no backend needed) — replace ACCESS_KEY with your key
      const WEB3_ACCESS_KEY = "c4c3e862-d075-48eb-b187-94c0cc592d95";
      const payload = {
        access_key: WEB3_ACCESS_KEY,
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim() || "AurisTitutum PRO — Contact Inquiry",
        message: form.message.trim(),
        // Redirect replies to owner's email — set this in Web3Forms dashboard
      };

      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setForm({ name: "", email: "", subject: "", message: "" });
      } else {
        throw new Error(data.message || "Submission failed");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = form.name.trim() && form.email.trim() && form.message.trim();

  return (
    <div className="page-fade space-y-10 pb-20 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border-color bg-card-bg p-8 sm:p-12">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-accent/5 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-accent/3 blur-[60px] pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Icon name="mail" size={28} className="text-accent" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-secondary mb-1 font-mono">
              Support & Inquiries
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tighter text-text-primary">
              Contact Us
            </h2>
            <p className="text-text-secondary text-sm mt-2 max-w-lg leading-relaxed">
              Have a question, feedback, or a feature request? Send us a message and
              we'll get back to you as soon as possible.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Contact Info Cards ── */}
        <div className="space-y-4">
          {[
            {
              icon: "mail",
              title: "Email Support",
              detail: "contact@auristitutum.com",
              sub: "We reply within 24 hours",
            },
            {
              icon: "message-circle",
              title: "General Inquiries",
              detail: "Use the form",
              sub: "Feature requests, feedback",
            },
            {
              icon: "shield",
              title: "Privacy Concerns",
              detail: "privacy@auristitutum.com",
              sub: "Data & security questions",
            },
            {
              icon: "zap",
              title: "Quick Response",
              detail: "Mon – Fri, 9 AM – 6 PM",
              sub: "We aim for same-day replies",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-4 p-4 rounded-2xl border border-border-color bg-card-bg"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <Icon name={item.icon} size={16} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-text-primary">{item.title}</p>
                <p className="text-[11px] text-text-secondary mt-0.5 truncate">{item.detail}</p>
                <p className="text-[10px] text-text-secondary/60 mt-0.5">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Contact Form ── */}
        <div className="lg:col-span-2">
          <Card className="relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/5 rounded-full blur-[60px] pointer-events-none" />
            <div className="relative z-10">
              <div className="mb-6">
                <h3 className="text-base font-bold tracking-tight text-text-primary uppercase">
                  Send a Message
                </h3>
                <p className="text-[10px] text-text-secondary uppercase tracking-[0.2em] mt-0.5 font-mono">
                  All fields marked * are required
                </p>
              </div>

              {status === "success" && (
                <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                  <Icon name="check-circle" size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-400">Message sent!</p>
                    <p className="text-xs text-emerald-400/80 mt-0.5">
                      Thank you for reaching out. We'll get back to you soon.
                    </p>
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl border border-red-500/30 bg-red-500/10">
                  <Icon name="alert-circle" size={16} className="text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-400">Failed to send</p>
                    <p className="text-xs text-red-400/80 mt-0.5">{errorMsg}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name + Email row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      autoComplete="off"
                      required
                      className="w-full bg-bg-main border border-border-color p-3.5 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="john@example.com"
                      autoComplete="email"
                      required
                      className="w-full bg-bg-main border border-border-color p-3.5 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                    Subject{" "}
                    <span className="font-normal normal-case tracking-normal opacity-50">(optional)</span>
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    placeholder="Bug report, feature request, general feedback…"
                    className="w-full bg-bg-main border border-border-color p-3.5 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40"
                  />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                    Message *
                  </label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Describe your issue or inquiry in detail…"
                    rows={6}
                    required
                    className="w-full bg-bg-main border border-border-color p-3.5 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40 resize-none"
                  />
                </div>

                {/* Category chips */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                    Category
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Bug Report", "Feature Request", "Account Help", "Billing", "Other"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            subject: prev.subject === cat ? "" : cat,
                          }))
                        }
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${form.subject === cat
                            ? "bg-accent text-bg-main border-accent"
                            : "bg-bg-main border-border-color text-text-secondary hover:border-text-secondary hover:bg-accent-dim"
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit || loading}
                  className="w-full py-4 bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.3em] rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      <Icon name="send" size={14} />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Contact;
