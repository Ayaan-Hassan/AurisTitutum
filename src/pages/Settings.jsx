import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import Switch from "../components/ui/Switch";
import { ConfirmModal } from "../components/Modals";
import {
  connectGoogleSheets,
  checkSheetsConnection,
  disconnectGoogleSheets,
  syncAllLogs,
  handleOAuthCallback,
} from "../services/sheetsApi";

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

  // Google Sheets state
  const [sheetsStatus, setSheetsStatus] = useState({
    connected: false,
    loading: true,
  });
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [sheetsMessage, setSheetsMessage] = useState(null);

  // Check sheets connection on mount and handle OAuth callback
  useEffect(() => {
    const init = async () => {
      // Handle OAuth callback params (user just returned from Google consent)
      const oauthResult = handleOAuthCallback();
      if (oauthResult.connected) {
        setSheetsMessage({
          type: "success",
          text: "✓ Google Sheets connected successfully!",
        });
        setSheetsStatus({
          connected: true,
          sheetUrl: oauthResult.sheetUrl,
          loading: false,
        });
        return;
      }
      if (oauthResult.error) {
        setSheetsMessage({
          type: "error",
          text: `Connection failed: ${oauthResult.error}`,
        });
        setSheetsStatus({ connected: false, loading: false });
        return;
      }

      // Check existing connection with server; fall back to localStorage cache
      const status = await checkSheetsConnection(user);
      setSheetsStatus({ ...status, loading: false });
    };

    init();
  }, [user]);

  // Clear message after 5 seconds
  useEffect(() => {
    if (sheetsMessage) {
      const timer = setTimeout(() => setSheetsMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [sheetsMessage]);

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
    const today = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `habitflow_pro_logs_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConnectSheets = () => {
    // Passes user email so the backend sets login_hint — Google will
    // auto-select the account the user is already signed in with,
    // skipping the account-picker screen on repeat connections.
    connectGoogleSheets(user);
  };

  const handleDisconnectSheets = async () => {
    try {
      await disconnectGoogleSheets(user);
      setSheetsStatus({ connected: false, loading: false });
      setSheetsMessage({ type: "success", text: "Google Sheets disconnected" });
    } catch (err) {
      setSheetsMessage({ type: "error", text: err.message });
    }
  };

  const handleSyncToSheets = async () => {
    if (!sheetsStatus.connected) return;

    setSyncingSheets(true);
    setSheetsMessage(null);

    try {
      const result = await syncAllLogs(user, habits);
      setSheetsMessage({
        type: "success",
        text: `✓ ${result.count} logs synced to Google Sheets.`,
      });
    } catch (err) {
      setSheetsMessage({ type: "error", text: err.message });
    } finally {
      setSyncingSheets(false);
    }
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Profile Identifier"
              value={userConfig.name || ""}
              onChange={(e) =>
                setUserConfig((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter your name"
            />
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

          <div className="h-px bg-border-color"></div>

          {/* Google Sheets Integration */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-text-primary">
                    Google Sheets Sync
                  </p>
                  {sheetsStatus.loading ? (
                    <span className="text-[9px] uppercase tracking-wider text-text-secondary animate-pulse">
                      Checking…
                    </span>
                  ) : sheetsStatus.connected ? (
                    <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Connected
                    </span>
                  ) : (
                    <span className="text-[9px] uppercase tracking-wider text-text-secondary bg-text-secondary/10 px-2 py-0.5 rounded-full">
                      Not connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  {sheetsStatus.connected
                    ? "Your habit logs sync to your personal Google Spreadsheet. Changes in the sheet reflect here automatically."
                    : "Connect your Google account once — uses the same account you signed in with. No re-authentication needed."}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                {sheetsStatus.connected ? (
                  <>
                    <Button
                      onClick={handleSyncToSheets}
                      variant="primary"
                      icon="cloud-sync"
                      className="w-full sm:w-auto"
                      disabled={syncingSheets || !user}
                    >
                      {syncingSheets ? "Syncing…" : "Sync Now"}
                    </Button>
                    <Button
                      onClick={handleDisconnectSheets}
                      variant="outline"
                      className="bg-bg-main w-full sm:w-auto"
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleConnectSheets}
                    variant="outline"
                    icon="file-spreadsheet"
                    className="bg-bg-main w-full sm:w-auto"
                    disabled={!user || sheetsStatus.loading}
                  >
                    Connect Google Sheets
                  </Button>
                )}
              </div>
            </div>

            {/* Open Sheet button — shown once connected */}
            {sheetsStatus.connected && sheetsStatus.sheetUrl && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-border-color bg-bg-main px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary">
                    Your Habit Spreadsheet
                  </p>
                  <p className="text-[10px] text-text-secondary mt-0.5 truncate">
                    {sheetsStatus.sheetUrl}
                  </p>
                </div>
                <a
                  href={sheetsStatus.sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-color bg-bg-main text-[10px] font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all shrink-0 w-full sm:w-auto justify-center"
                >
                  <Icon name="external-link" size={12} />
                  Open My Google Sheet
                </a>
              </div>
            )}

            {/* Status / feedback message */}
            {sheetsMessage && (
              <div
                className={`flex flex-col sm:flex-row sm:items-center gap-3 text-xs p-3 rounded-xl ${
                  sheetsMessage.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-danger/10 text-danger border border-danger/20"
                }`}
              >
                <span className="flex-1">{sheetsMessage.text}</span>
                {sheetsMessage.type === "success" && sheetsStatus.sheetUrl && (
                  <a
                    href={sheetsStatus.sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/10 transition-all shrink-0"
                  >
                    <Icon name="external-link" size={11} />
                    Open Sheet
                  </a>
                )}
              </div>
            )}

            {!user && (
              <p className="text-[10px] text-text-secondary">
                Sign in to enable Google Sheets sync.
              </p>
            )}
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
