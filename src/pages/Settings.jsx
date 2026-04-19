import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import Switch from "../components/ui/Switch";
import { ConfirmModal } from "../components/Modals";
import { getLocalDateKey } from "../utils/date";
import { db } from "../firebase.config";
import { doc, setDoc, getDoc } from "firebase/firestore";

const Settings = ({
  userConfig,
  setUserConfig,
  handleAvatarUpload,
  fileInputRef,
  habits,
}) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);



  const handleLogout = async () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const updateSetting = (key, value) => {
    setUserConfig((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  };

  const exportToCSV = () => {
    // Generate CSV content
    const headers = ["Habit Name", "Date", "Count", "Type"];
    const rows = habits.flatMap((habit) =>
      habit.logs.map((log) => [habit.name, log.date, log.count, habit.type]),
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = getLocalDateKey();
    link.href = url;
    link.download = `habitflow_pro_logs_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  return (
    <div className="page-fade max-w-7xl w-full space-y-12 pb-20">
      <section>
        <h2 className="text-2xl font-bold tracking-tighter mb-6 text-text-primary">
          User Configuration
        </h2>

        <Card className="p-8 space-y-8 hover:translate-y-0 hover:shadow-none hover:border-border-color">
          {/* Avatar Section */}
          <div className="flex items-center gap-6 pb-8 border-b border-border-color">
            <div
              className="w-20 h-20 rounded-2xl bg-bg-sidebar flex items-center justify-center border border-border-color overflow-hidden cursor-pointer hover:border-text-secondary transition-all group relative"
              onClick={() => fileInputRef.current?.click()}
            >
              {userConfig.avatar ? (
                <img
                  src={userConfig.avatar}
                  className="w-full h-full object-cover"
                  alt="Avatar"
                />
              ) : (
                <Icon
                  name="user"
                  size={32}
                  className="text-text-secondary group-hover:text-text-primary transition-colors"
                />
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Icon name="plus" size={20} className="text-white" />
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleAvatarUpload}
            />
            <div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="bg-bg-main"
              >
                Update Avatar
              </Button>
              <p className="text-[10px] text-text-secondary mt-2 uppercase tracking-tight">
                Format: JPG, PNG, WEBP (Max 2MB)
              </p>
            </div>
          </div>

          {/* Profile Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div>
              <Input
                label="Profile Identifier"
                value={userConfig.name || ""}
                onChange={(e) =>
                  setUserConfig((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter your name"
              />
              {user && (
                <div className="mt-2 text-[10px] text-text-secondary uppercase tracking-widest font-mono">
                  <strong>UID:</strong> {user.uid}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">
                System Email
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-border-color bg-bg-main px-4 py-2.5">
                <Icon
                  name="lock"
                  size={14}
                  className="text-text-secondary shrink-0"
                />
                <input
                  type="email"
                  readOnly
                  value={userConfig.email || ""}
                  placeholder="Sign in to sync"
                  className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary/50"
                />
              </div>
              <p className="text-[10px] text-text-secondary mt-1">
                Synced from sign-in. Sign in with Google/email to update.
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-bold tracking-tighter mb-6 text-text-primary">
          Titum Connect
        </h2>
        <Card className="p-8 space-y-6 hover:translate-y-0 hover:shadow-none hover:border-border-color">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="share-2" size={16} className="text-accent" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-primary">
              Secret Connection Code
            </h3>
          </div>
          <p className="text-xs text-text-secondary">
            Share this unique code with another user to connect your Titum AI chats. This allows for direct peer-to-peer behavioral coaching and accountability.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:flex-1 bg-bg-main border border-border-color rounded-xl px-4 py-3 flex items-center justify-between group">
              <span className="font-mono text-lg font-bold tracking-widest text-accent uppercase">
                {userConfig.secretCode || "NOT GENERATED"}
              </span>
              {userConfig.secretCode && (
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(userConfig.secretCode);
                    const toastEvent = new CustomEvent("showToast", {
                      detail: { message: "Code copied to clipboard!", type: "success" },
                    });
                    document.dispatchEvent(toastEvent);
                  }}
                  className="p-1.5 rounded-lg hover:bg-accent/10 text-text-secondary hover:text-accent transition-colors"
                  title="Copy Code"
                >
                  <Icon name="copy" size={14} />
                </button>
              )}
            </div>
            {!userConfig.secretCode && (
              <Button
                onClick={async () => {
                  if (!user) {
                    const toastEvent = new CustomEvent("showToast", {
                      detail: { message: "Sign in to generate a secret code.", type: "warning" },
                    });
                    document.dispatchEvent(toastEvent);
                    return;
                  }
                  // 1. Generate code locally first
                  const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                  
                  try {
                    // 2. Persist to User Profile FIRST (most important for "staying still")
                    await setUserConfig({ secretCode: newCode });
                    
                    // 3. Register in global registry (so others can find you)
                    const codeRef = doc(db, "secret_codes", newCode);
                    await setDoc(codeRef, { 
                      uid: user.uid, 
                      createdAt: new Date().toISOString() 
                    });

                    const toastEvent = new CustomEvent("showToast", {
                      detail: { message: "Secret code generated and saved permanently!", type: "success" },
                    });
                    document.dispatchEvent(toastEvent);
                  } catch (err) {
                    console.error("Critical failure during code generation:", err);
                    const toastEvent = new CustomEvent("showToast", {
                      detail: { 
                        message: err.code === 'permission-denied' 
                          ? "Database error: Please check your Firebase Rules." 
                          : "Failed to save code. Please try again.", 
                        type: "error" 
                      },
                    });
                    document.dispatchEvent(toastEvent);
                  }
                }}
                variant="outline"
                className="bg-bg-main w-full sm:w-auto"
              >
                Generate Fixed Code
              </Button>
            )}
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-bold tracking-tighter mb-6 text-text-primary">
          System Parameters
        </h2>

        {/* Appearance Settings */}
        <Card className="p-8 space-y-6 mb-6 hover:translate-y-0 hover:shadow-none hover:border-border-color">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="palette" size={16} className="text-text-secondary" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary">
              Appearance
            </h3>
          </div>

          {/* Compact Mode */}
          <Switch
            checked={userConfig.settings?.compactMode || false}
            onChange={(val) => updateSetting("compactMode", val)}
            label="Compact Mode"
            description="Reduce spacing and padding for a denser layout experience."
          />

          <div className="h-px bg-border-color"></div>

          {/* Reduce Animations */}
          <Switch
            checked={userConfig.settings?.reduceAnimations || false}
            onChange={(val) => updateSetting("reduceAnimations", val)}
            label="Reduce Animations"
            description="Minimize motion effects for better performance or accessibility."
          />
        </Card>

        {/* Interface Settings */}
        <Card className="p-8 space-y-6 mb-6 hover:translate-y-0 hover:shadow-none hover:border-border-color">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="layout" size={16} className="text-text-secondary" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary">
              Interface
            </h3>
          </div>

          {/* Glass Effects */}
          <Switch
            checked={userConfig.settings?.glassEffects !== false}
            onChange={(val) => updateSetting("glassEffects", val)}
            label="Glass Effects"
            description="Enable glassmorphism aesthetic on cards and panels."
          />

          <div className="h-px bg-border-color"></div>

          {/* Notifications */}
          <Switch
            checked={
              user && userConfig.settings?.notificationsEnabled !== false
            }
            onChange={(val) => updateSetting("notificationsEnabled", val)}
            label="Enable Notifications"
            description={
              user
                ? "Receive reminders for unlogged good habits."
                : "Sign in to enable smart reminders and push notifications."
            }
          />
        </Card>

        {/* Data Settings */}
        <Card className="p-8 space-y-6 mb-6 hover:translate-y-0 hover:shadow-none hover:border-border-color">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="database" size={16} className="text-text-secondary" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary">
              Data
            </h3>
          </div>

          {/* Data Persistence */}
          <Switch
            checked={userConfig.settings?.persistence !== false}
            onChange={(val) => updateSetting("persistence", val)}
            label="Data Persistence"
            description="Automatically save all habit data to browser local storage."
          />

          <div className="h-px bg-border-color"></div>

          {/* Export Logs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary">
                Export Habit Logs
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Download all habit logs as a CSV file for external analysis.
              </p>
            </div>
            <Button
              onClick={exportToCSV}
              variant="outline"
              icon="download"
              className="bg-bg-main shrink-0 w-full sm:w-auto"
              disabled={!user}
            >
              Export CSV
            </Button>
          </div>

        </Card>

        {/* Developer Settings */}
        <Card className="p-8 space-y-6 hover:translate-y-0 hover:shadow-none hover:border-border-color">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="code" size={16} className="text-text-secondary" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary">
              Developer
            </h3>
          </div>

          {/* Dev Console */}
          <Switch
            checked={userConfig.settings?.devConsole || false}
            onChange={(val) => updateSetting("devConsole", val)}
            label="Developer Console"
            description="Enable advanced debugging and development tools."
          />
        </Card>
      </section>

      {user && (
        <section className="pt-4">
          <Card className="p-8 hover:translate-y-0 hover:shadow-none hover:border-border-color">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-accent-dim border border-border-color flex items-center justify-center shrink-0">
                  <Icon
                    name="log-out"
                    size={20}
                    className="text-text-secondary"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-text-primary">
                    Log out
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Sign out of your account on this device.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleLogout}
                variant="danger"
                icon="log-out"
                className="bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg rounded-xl transition-all duration-200 shrink-0 px-6 py-2.5 w-full sm:w-auto"
              >
                Log out
              </Button>
            </div>
          </Card>
        </section>
      )}
      <ConfirmModal
        open={showLogoutConfirm}
        title="Log out"
        message="Are you sure you want to sign out of your account?"
        confirmLabel="Log out"
        variant="danger"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};

export default Settings;

