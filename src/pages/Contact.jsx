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
      // Direct Firestore submission for internal admin dashboard
      const { addDoc, collection } = await import("firebase/firestore");
      const { db } = await import("../firebase.config");
      
      await addDoc(collection(db, "inquiries"), {
        name: form.name.trim() || "Anonymous",
        email: form.email.trim() || "No Email",
        topic: form.type,
        priority: form.priority,
        subject: form.subject.trim(),
        message: form.message.trim(),
        createdAt: new Date().toISOString(),
        status: "pending"
      });

      setStatus("success");
      setForm({ name: "", email: "", type: "General Inquiry", subject: "", message: "", priority: "Normal" });
    } catch (err) {
      console.error("Firestore inquiry error:", err);
      setStatus("error");
      setErrorMsg(err.message || "Failed to deliver inquiry.");
    } finally {
      setLoading(false);
    }

  };

  const canSubmit = form.message.trim() && form.subject.trim();

  return (
    <div className="page-fade flex flex-col min-h-[calc(100vh-120px)] max-w-4xl mx-auto pb-12">

      {/* ── Contact Form ── */}
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary mb-2">
        Contact Support
      </h2>
      <p className="text-text-secondary text-sm mb-8 leading-relaxed">
        Have a question, feedback, or need help? Fill out the form below and we'll get back to you as soon as possible.
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
                  Name (Optional)
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
                  Email Address (Optional)
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
                  Topic
                </label>
                <div className="relative">
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="w-full h-[56px] appearance-none bg-bg-main border border-border-color px-4 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all"
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
                <div className="flex items-center gap-1.5 p-1.5 bg-bg-main border border-border-color rounded-xl h-[56px]">
                  {["Low", "Normal", "High"].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handlePriority(level)}
                      className={`flex-1 h-full text-[11px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center ${form.priority === level
                        ? level === "High" ? "bg-red-500/10 text-red-500 border border-red-500/20 shadow-sm"
                          : level === "Normal" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm"
                            : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm"
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
                Subject *
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
