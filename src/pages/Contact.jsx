import { useState } from "react";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";

// ─── Contact Us Page ─────────────────────────────────────────────────────────
const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", type: "General Inquiry", subject: "", message: "", priority: "Normal" });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (status) setStatus(null);
  };

  const handlePriority = (val) => {
    setForm((prev) => ({ ...prev, priority: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.message.trim() || !form.subject.trim()) return;
    setLoading(true);
    setStatus(null);
    setErrorMsg("");

    try {
      // Use Web3Forms (free, no backend needed) — replace ACCESS_KEY with your key
      const WEB3_ACCESS_KEY = "c4c3e862-d075-48eb-b187-94c0cc592d95";
      const payload = {
        access_key: WEB3_ACCESS_KEY,
        name: form.name.trim() || "AurisTitutum PRO User",
        email: form.email.trim() || "contact@auristitutum.com",
        subject: `[${form.priority} Priority - ${form.type}] ${form.subject.trim()}`,
        message: form.message.trim(),
      };

      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setForm({ name: "", email: "", type: "General Inquiry", subject: "", message: "", priority: "Normal" });
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

  const canSubmit = form.message.trim() && form.subject.trim();

  return (
    <div className="page-fade flex flex-col min-h-[calc(100vh-120px)] max-w-4xl mx-auto pb-12">

      {/* ── Advanced Contact Form ── */}
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary mb-2">
        Priority Support Gateway
      </h2>
      <p className="text-text-secondary text-sm mb-8 leading-relaxed">
        Submit inquiries, bug reports, or partnership proposals. Select the appropriate classification to ensure your request reaches the right queue.
      </p>

      <Card className="flex-1 relative overflow-hidden rounded-xl bg-card-bg/50 border-border-color shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[80px] pointer-events-none" />
        <div className="relative z-10 p-4 sm:p-8 w-full mx-auto">
          {status === "success" && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <Icon name="check-circle" size={16} className="text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-400">Message dispatched successfully!</p>
                <p className="text-xs text-emerald-400/80 mt-0.5">
                  Your ticket has been placed in the queue. We will review it shortly.
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10">
              <Icon name="alert-circle" size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-400">Failed to establish connection</p>
                <p className="text-xs text-red-400/80 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Optional Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                  Identifier (Optional)
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/50">
                    <Icon name="user" size={16} />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your name or alias"
                    className="w-full bg-bg-main border border-border-color p-4 pl-12 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40"
                  />
                </div>
              </div>

              {/* Optional Email */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                  Comms Channel (Optional)
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/50">
                    <Icon name="mail" size={16} />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Return email address"
                    className="w-full bg-bg-main border border-border-color p-4 pl-12 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Inquiry Type */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                  Classification
                </label>
                <div className="relative">
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="w-full appearance-none bg-bg-main border border-border-color p-4 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all"
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Account Issue">Account Issue</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
                    <Icon name="chevron-down" size={16} />
                  </div>
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] block">
                  Priority Level
                </label>
                <div className="flex items-center gap-2 p-1 bg-bg-main border border-border-color rounded-xl">
                  {["Low", "Normal", "High"].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handlePriority(level)}
                      className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${form.priority === level
                          ? level === "High" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-accent text-bg-main shadow-md"
                          : "text-text-secondary hover:bg-bg-sidebar hover:text-text-primary"
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                Subject Header *
              </label>
              <input
                type="text"
                name="subject"
                value={form.subject}
                onChange={handleChange}
                placeholder="Brief summary of your message…"
                className="w-full bg-bg-main border border-border-color p-4 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40"
              />
            </div>

            {/* Message */}
            <div className="space-y-2 relative flex-1 flex flex-col">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                Payload Data *
              </label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                placeholder="Describe your issue or inquiry in detail…"
                rows={8}
                required
                className="w-full bg-bg-main border border-border-color p-4 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40 resize-y min-h-[150px] font-mono leading-relaxed"
              />
            </div>

            <div className="pt-6 border-t border-border-color/50">
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="w-full py-4 bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.3em] rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Transmitting…
                  </>
                ) : (
                  <>
                    <Icon name="send" size={14} />
                    Submit Ticket
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default Contact;
