import { useState } from "react";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";

// ─── Contact Us Page ─────────────────────────────────────────────────────────
const Contact = () => {
  const [form, setForm] = useState({ subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (status) setStatus(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setLoading(true);
    setStatus(null);
    setErrorMsg("");

    try {
      // Use Web3Forms (free, no backend needed) — replace ACCESS_KEY with your key
      const WEB3_ACCESS_KEY = "c4c3e862-d075-48eb-b187-94c0cc592d95";
      const payload = {
        access_key: WEB3_ACCESS_KEY,
        name: "AurisTitutum PRO User",
        email: "contact@auristitutum.com", // Default fallback if no auth used
        subject: form.subject.trim() || "AurisTitutum PRO — Contact Inquiry",
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
        setForm({ subject: "", message: "" });
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

  const canSubmit = form.message.trim();

  return (
    <div className="page-fade flex flex-col min-h-[calc(100vh-120px)] max-w-5xl mx-auto space-y-6 pb-12">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-xl border border-border-color bg-card-bg p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[80px] pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-16 h-16 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Icon name="mail" size={28} className="text-accent" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-secondary mb-1 font-mono">
              Support & Inquiries
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
              Contact Us
            </h2>
            <p className="text-text-secondary text-sm mt-2 max-w-xl leading-relaxed">
              Have a question, feedback, or feature request? Describe it below and we'll handle the rest.
            </p>
          </div>
        </div>
      </div>

      {/* ── Contact Form ── */}
      <Card className="flex-1 relative overflow-hidden rounded-xl bg-card-bg/50 border-border-color">
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-accent/5 blur-[80px] pointer-events-none" />
        <div className="relative z-10 p-2 sm:p-6 w-full max-w-3xl mx-auto">
          {status === "success" && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <Icon name="check-circle" size={16} className="text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-400">Message sent!</p>
                <p className="text-xs text-emerald-400/80 mt-0.5">
                  Thank you for reaching out. We've received your inquiry.
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10">
              <Icon name="alert-circle" size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-400">Failed to send</p>
                <p className="text-xs text-red-400/80 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Subject */}
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                Subject
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
                Message *
              </label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                placeholder="Describe your issue or inquiry in detail…"
                rows={12}
                required
                className="w-full bg-bg-main border border-border-color p-4 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40 resize-none flex-1 font-mono leading-relaxed"
              />
            </div>

            <div className="pt-4 border-t border-border-color/50">
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="w-full py-4 bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.3em] rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center gap-2"
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
                    Submit Inquiry
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
