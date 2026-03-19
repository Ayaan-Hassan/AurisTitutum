import { useState } from "react";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";

// ─── Contact Us Page ─────────────────────────────────────────────────────────
const Contact = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({ type: "General Inquiry", subject: "", message: "", priority: "Normal" });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState("");
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);

  const topics = [
    { value: "General Inquiry", icon: "info", desc: "For general questions about the platform." },
    { value: "Bug Report", icon: "alert-triangle", desc: "Report technical issues or errors." },
    { value: "Feature Request", icon: "zap", desc: "Suggest new tools or improvements." },
    { value: "Partnership", icon: "user-check", desc: "Inquire about business collaborations." },
    { value: "Account Issue", icon: "lock", desc: "Help with logging in or security." }
  ];

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (status) setStatus(null);
  };

  const handlePriority = (val) => {
    setForm((prev) => ({ ...prev, priority: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      addToast("You must be signed in to send an inquiry.", "error");
      return;
    }
    if (!form.message.trim() || !form.subject.trim()) return;
    setLoading(true);
    setStatus(null);
    setErrorMsg("");

    try {
      // Direct Firestore submission for internal admin dashboard
      const { addDoc, collection } = await import("firebase/firestore");
      const { db } = await import("../firebase.config");

      await addDoc(collection(db, "inquiries"), {
        uid: user.uid,
        name: user.displayName || user.name || "User",
        email: user.email,
        topic: form.type,
        priority: form.priority,
        subject: form.subject.trim(),
        message: form.message.trim(),
        createdAt: new Date().toISOString(),
        status: "pending"
      });

      setStatus("success");
      setForm({ type: "General Inquiry", subject: "", message: "", priority: "Normal" });
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
          {!user ? (
            <div className="py-20 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
               <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mb-6">
                  <Icon name="lock" size={32} />
               </div>
               <h3 className="text-xl font-bold tracking-tight text-text-primary mb-2">Session Required</h3>
               <p className="text-sm text-text-secondary max-w-xs mx-auto mb-8 leading-relaxed">
                  Please sign in to your dashboard to send inquiries. This helps us track your tickets and provide faster support.
               </p>
               <a href="/login" className="px-8 py-3 bg-accent text-bg-main text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg">
                  Sign In to Continue
               </a>
            </div>
          ) : (
            <>
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
                <div className="p-4 bg-accent/5 rounded-xl border border-accent/20 flex items-center gap-4 mb-2">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                        {(user?.displayName || user?.name || "A").charAt(0)}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-text-primary">{user?.displayName || user?.name || "Anonymous User"}</p>
                        <p className="text-[10px] text-text-secondary opacity-70">{user?.email || "No email linked"}</p>
                    </div>
                    <div className="ml-auto px-2 py-1 bg-accent/10 rounded text-[8px] font-black uppercase text-accent tracking-tighter">Verified Session</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Inquiry Type */}
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] pl-1">
                      Inquiry Topic
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowTopicDropdown(!showTopicDropdown)}
                        className={`w-full h-[56px] flex items-center justify-between bg-bg-main border px-5 rounded-xl transition-all duration-300 ${showTopicDropdown ? 'border-accent ring-4 ring-accent/5' : 'border-border-color hover:border-accent/40'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${showTopicDropdown ? 'bg-accent/20 text-accent' : 'bg-white/5 text-text-secondary'}`}>
                            <Icon name={topics.find(t => t.value === form.type)?.icon || "info"} size={14} />
                          </div>
                          <span className="text-sm font-bold text-text-primary tracking-tight">
                            {form.type}
                          </span>
                        </div>
                        <Icon 
                          name="chevron-down" 
                          size={16} 
                          className={`text-text-secondary transition-transform duration-300 ${showTopicDropdown ? 'rotate-180 text-accent' : ''}`} 
                        />
                      </button>

                      {showTopicDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-[60]" 
                            onClick={() => setShowTopicDropdown(false)} 
                          />
                          <div className="absolute top-full left-0 right-0 mt-3 bg-card-bg/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[70] overflow-hidden py-2 animate-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-2 mb-1">
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-secondary opacity-50">Select Destination</p>
                            </div>
                            {topics.map((t) => (
                              <button
                                key={t.value}
                                type="button"
                                onClick={() => {
                                  setForm(prev => ({ ...prev, type: t.value }));
                                  setShowTopicDropdown(false);
                                }}
                                className={`w-full px-4 py-3.5 flex items-center gap-4 transition-all hover:bg-white/5 relative group ${form.type === t.value ? 'bg-accent/10 border-r-2 border-accent' : ''}`}
                              >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${form.type === t.value ? 'bg-accent/20 text-accent' : 'bg-white/5 text-text-secondary group-hover:text-text-primary'}`}>
                                  <Icon name={t.icon} size={16} />
                                </div>
                                <div className="text-left">
                                  <p className={`text-[13px] font-bold ${form.type === t.value ? 'text-accent' : 'text-text-primary'}`}>{t.value}</p>
                                  <p className="text-[9px] text-text-secondary font-mono tracking-tighter opacity-70">{t.desc}</p>
                                </div>
                                {form.type === t.value && (
                                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--accent-rgb),1)]" />
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
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
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Contact;
