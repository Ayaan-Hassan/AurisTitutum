import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import Icon from "./Icon";

const compressImage = (base64Str) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_SIZE = 128;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
  });
};

const Onboarding = ({ onAddHabit, habits = [], userConfig: propUserConfig, updateUserConfig: propUpdateUserConfig }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const fileInputRef = useRef(null);

  const [isVisible, setIsVisible] = useState(false);
  const trigger = sessionStorage.getItem("triggerOnboarding") === "true";

  // Use a listener to set state so it persists during the current app session if needed, 
  // but the immediate 'trigger' check handles the first render.
  useEffect(() => {
    if (trigger) {
      sessionStorage.removeItem("triggerOnboarding");
      setIsVisible(true);
    }
  }, [trigger, location.pathname]);

  const shouldShow = isVisible || trigger;

  // Use props if provided, otherwise fallback to context (though props are preferred here)
  const userConfig = propUserConfig;
  const updateUserConfig = propUpdateUserConfig;

  const [profile, setProfile] = useState({
    name: userConfig?.name || user?.displayName || "",
    age: userConfig?.age || "",
    gender: userConfig?.gender || "",
    avatar: userConfig?.avatar || null,
  });
  const [isGenderOpen, setIsGenderOpen] = useState(false);

  const isComplete = userConfig?.settings?.onboardingComplete;
  const isDashboard = location.pathname === "/app" || location.pathname === "/app/" || location.pathname === "/app/dashboard";
  
  const isReturningOperator = localStorage.getItem("auris_returning_operator") === "true";
  const isNewUserFlow = sessionStorage.getItem("auris_new_user_flow") === "true";
  
  // A first-time user who explicitly triggered onboarding should see it.
  // A returning operator who didn't trigger it should skip it.
  const shouldSkip = isReturningOperator && !isNewUserFlow;

  if (shouldSkip || !shouldShow || isComplete || !isDashboard || habits.length > 0 || isInitializing) return null;

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const compressed = await compressImage(event.target.result);
      setProfile((prev) => ({ ...prev, avatar: compressed }));
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      await updateUserConfig({
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        avatar: profile.avatar,
      });
      setStep(2);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartHabit = () => {
    setIsInitializing(true);
    onAddHabit();
    // Use a listener to detect when a habit is added and then mark onboarding as complete
    const checkHabitAdded = setInterval(() => {
        // Since we are checking parent provided habits, it might take a moment to sync
        if (habits.length > 0) {
            updateUserConfig({ settings: { ...userConfig.settings, onboardingComplete: true } });
            sessionStorage.setItem("auris_tour_permitted", "true");
            clearInterval(checkHabitAdded);
        }
    }, 1000);
    
    // Safety timeout to clear interval in case they cancel habit creation
    setTimeout(() => clearInterval(checkHabitAdded), 60000);
  };

   return (
    <div className={`fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300`}>
      <Card className="w-full max-w-lg p-8 space-y-8 bg-bg-main border border-border-color shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] relative">
        {/* Decorative Background */}
        <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-100px] left-[-100px] w-64 h-64 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

        {step === 1 ? (
          <div className="relative z-10 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-2">
                <Icon name="sparkles" size={14} className="text-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Welcome Operator</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">Complete Your Profile</h2>
              <p className="text-xs text-text-secondary">Tell us a bit about yourself to personalize your experience.</p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div 
                className="w-24 h-24 rounded-3xl bg-bg-sidebar flex items-center justify-center border-2 border-dashed border-border-color overflow-hidden cursor-pointer hover:border-accent group relative transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                {profile.avatar ? (
                  <img src={profile.avatar} className="w-full h-full object-cover" alt="Avatar" />
                ) : (
                  <div className="flex flex-col items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <Icon name="camera" size={24} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">Photo</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Icon name="plus" size={20} className="text-white" />
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-accent transition-colors"
              >
                {profile.avatar ? "Change Photo" : "Add Avatar"}
              </button>
            </div>

            <div className="space-y-4">
              <Input 
                label="Public Name" 
                placeholder="How should we address you?"
                value={profile.name}
                onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Age" 
                  type="number"
                  min="1"
                  max="120"
                  placeholder="Years"
                  value={profile.age}
                  onChange={(e) => {
                    const val = (e.target.value || "").replace(/[^0-9]/g, "");
                    if (val === "" || (parseInt(val) >= 1 && parseInt(val) <= 120)) {
                      setProfile(prev => ({ ...prev, age: val }));
                    }
                  }}
                />
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest block px-1">Gender</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsGenderOpen(!isGenderOpen)}
                      className="w-full h-[46px] rounded-xl border border-border-color bg-bg-main/50 backdrop-blur-md px-4 text-left text-xs text-text-primary outline-none focus:border-accent transition-all cursor-pointer hover:border-accent hover:bg-bg-sidebar/40 shadow-inner flex items-center justify-between group"
                    >
                      <span className={!profile.gender ? "text-text-secondary/50" : ""}>
                        {profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : "Select"}
                      </span>
                      <Icon name="chevron-down" size={14} className={`text-text-secondary transition-transform duration-300 ${isGenderOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isGenderOpen && (
                      <>
                        <div className="fixed inset-0 z-[90]" onClick={() => setIsGenderOpen(false)} />
                        <div className="absolute top-full left-0 right-0 mt-2 bg-bg-sidebar border border-border-color rounded-xl overflow-hidden shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                          {[
                            { value: "male", label: "Male" },
                            { value: "female", label: "Female" },
                            { value: "private", label: "Prefer not to say" }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setProfile(prev => ({ ...prev, gender: opt.value }));
                                setIsGenderOpen(false);
                              }}
                              className={`w-full px-4 py-3 text-left text-xs transition-colors hover:bg-accent/10 hover:text-accent ${profile.gender === opt.value ? 'bg-accent/5 text-accent font-bold' : 'text-text-primary'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Button 
                onClick={saveProfile} 
                disabled={loading || !profile.name.trim() || !profile.age || !profile.gender}
                variant="primary" 
                className="w-full h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-accent/20"
            >
              {loading ? "Processing..." : "Save & Continue"}
            </Button>
          </div>
        ) : (
          <div className="relative z-10 space-y-8 animate-in zoom-in-95 duration-500 text-center">
             <div className="w-20 h-20 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto text-success shadow-lg shadow-success/10">
                <Icon name="check" size={32} />
             </div>
             
             <div className="space-y-3">
                <h2 className="text-2xl font-bold tracking-tight text-text-primary">Profile Operational</h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Excellent work, {profile.name}. Your profile is synced and secured. <br />
                  Now, the system needs a fuel source: **Your first habit.**
                </p>
             </div>

             <div className="p-6 rounded-2xl bg-accent-dim border border-accent/20 space-y-3">
                <p className="text-[11px] font-medium text-text-primary">
                   Creating your first Habit will activate the full dashboard tracking capabilities and initialize your momentum matrix.
                </p>
             </div>

             <Button 
                onClick={handleStartHabit} 
                variant="primary" 
                className="w-full h-14 rounded-2xl text-[12px] font-black uppercase tracking-[0.1em] shadow-xl shadow-accent/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
             >
                Create First Habit
             </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Onboarding;
