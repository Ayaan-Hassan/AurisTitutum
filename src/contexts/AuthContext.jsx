import { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import { onSnapshot, doc, updateDoc } from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  auth,
  authPersistenceReady,
  isFirebaseConfigured,
} from "../firebase.config";
import {
  USER_SUBCOLLECTIONS,
  clearLegacyLocalCoreData,
  ensureUserDocument,
  hasAnyRemoteCoreData,
  readLegacyLocalCoreData,
  replaceCollectionById,
  subscribeToUserSubcollection,
  upsertUserSetting,
  getUserSetting,
  updateUserPresence,
} from "../services/firestoreService";
import {
  aggregateHabitsFromDocs,
  replaceHabits,
  subscribeHabits,
} from "../services/habitService";
import { replaceLogs, serializeLogsFromHabits, subscribeLogs } from "../services/logService";
import { replaceReminders, subscribeReminders } from "../services/reminderService";
import { identifyUser, trackEvent } from "../utils/telemetry";

const AuthContext = createContext(null);

const DEFAULT_USER_CONFIG = {
  name: "",
  email: "",
  avatar: null,
  settings: {
    persistence: true,
    audit: true,
    devConsole: false,
    notificationsEnabled: true,
  },
};

const mapFirebaseUser = (firebaseUser) => ({
  uid: firebaseUser.uid,
  id: firebaseUser.uid,
  email: firebaseUser.email,
  name: firebaseUser.displayName || firebaseUser.email?.split("@")[0],
  photoURL: firebaseUser.photoURL || null,
  createdAt: firebaseUser.metadata.creationTime,
});

const normalizeUserConfig = (raw = {}) => ({
  ...DEFAULT_USER_CONFIG,
  ...(raw || {}),
  settings: {
    ...DEFAULT_USER_CONFIG.settings,
    ...((raw && raw.settings) || {}),
  },
});

const mergeUserIdentityIntoConfig = (config = {}, user = null) => {
  const normalized = normalizeUserConfig(config);
  if (!user) return normalized;

  const fallbackName = user?.email ? user.email.split("@")[0] : "";
  return {
    ...normalized,
    email: user?.email || normalized.email || "",
    name: normalized.name || user?.name || fallbackName,
    avatar: normalized.avatar || user?.photoURL || null,
  };
};

const normalizeNote = (note = {}) => {
  const now = new Date().toISOString();
  return {
    id: String(note?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    title: note?.title || "Untitled",
    body: note?.body || "",
    color: note?.color || "default",
    pinned: !!note?.pinned,
    createdAt: note?.createdAt || now,
    updatedAt: note?.updatedAt || now,
  };
};

const normalizeReminder = (reminder = {}) => {
  const now = new Date().toISOString();
  return {
    id: String(reminder?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    title: reminder?.title || "",
    notes: reminder?.notes || "",
    date: reminder?.date || "",
    time: reminder?.time || "09:00",
    repeat: reminder?.repeat || "none",
    createdAt: reminder?.createdAt || now,
    updatedAt: reminder?.updatedAt || now,
  };
};

const normalizeHabit = (habit = {}) => ({
  id: String(habit?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
  name: habit?.name || "",
  type: habit?.type || "Good",
  mode: habit?.mode || "quick",
  unit: habit?.unit || "",
  emoji: habit?.emoji || "",
  createdAt: habit?.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  totalLogs: Number(habit?.totalLogs) || 0,
  logs: Array.isArray(habit?.logs) ? habit.logs : [],
});

const normalizeSheetsState = (raw = {}) => ({
  connected: !!raw?.connected,
  sheetUrl: raw?.sheetUrl || null,
  spreadsheetId: raw?.spreadsheetId || null,
  connectedAt: raw?.connectedAt || null,
  error: raw?.error || null,
  loading: !!raw?.loading,
});

const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  );

const googleProvider = new GoogleAuthProvider();
// Request offline access so we get a refresh_token for Google Sheets OAuth
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('email');
googleProvider.addScope('profile');
const facebookProvider = new FacebookAuthProvider();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState(null);

  const [habitDocs, setHabitDocs] = useState([]);
  const [logDocs, setLogDocs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reminders, setRemindersState] = useState([]);
  const [settingsDocs, setSettingsDocs] = useState([]);

  const listenersRef = useRef([]);
  const authCycleRef = useRef(0);

  const clearAllSyncedState = () => {
    setHabitDocs([]);
    setLogDocs([]);
    setNotes([]);
    setRemindersState([]);
    setSettingsDocs([]);
  };

  const stopAllListeners = () => {
    listenersRef.current.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch {
        // ignore listener teardown failures
      }
    });
    listenersRef.current = [];
  };

  const habits = useMemo(
    () => aggregateHabitsFromDocs(habitDocs, logDocs),
    [habitDocs, logDocs],
  );

  const settingsMap = useMemo(() => {
    const map = {};
    settingsDocs.forEach((item) => {
      if (!item?.id) return;
      map[item.id] = item;
    });
    return map;
  }, [settingsDocs]);

  const userConfig = useMemo(() => {
    const profile = settingsMap.profile || {};
    return mergeUserIdentityIntoConfig(normalizeUserConfig(profile), user);
  }, [settingsMap.profile, user]);

  const sheetsConnection = useMemo(
    () => normalizeSheetsState(settingsMap.sheets || {}),
    [settingsMap.sheets],
  );

  const replaceHabitsAndLogs = async (uid, nextHabits) => {
    const normalizedHabits = (Array.isArray(nextHabits) ? nextHabits : []).map(
      normalizeHabit,
    );
    await replaceHabits(uid, normalizedHabits);
    await replaceLogs(uid, serializeLogsFromHabits(normalizedHabits));
  };

  const replaceNotes = async (uid, nextNotes) => {
    const normalized = (Array.isArray(nextNotes) ? nextNotes : []).map(normalizeNote);
    await replaceCollectionById(uid, USER_SUBCOLLECTIONS.notes, normalized);
  };

  const replaceUserReminders = async (uid, nextReminders) => {
    const normalized = (Array.isArray(nextReminders) ? nextReminders : []).map(
      normalizeReminder,
    );
    await replaceReminders(uid, normalized);
  };

  const migrateLegacyDataIfNeeded = async (firebaseUser) => {
    const uid = firebaseUser.uid;
    const migrationDoc = await getUserSetting(uid, "migration");
    if (migrationDoc?.legacyMigratedAt) {
      clearLegacyLocalCoreData(uid);
      return;
    }

    const localData = readLegacyLocalCoreData(uid);

    if (!localData) {
      await upsertUserSetting(uid, "migration", {
        legacyMigratedAt: new Date().toISOString(),
        source: "none",
        imported: false,
      });
      return;
    }

    const remoteHasData = await hasAnyRemoteCoreData(uid);

    if (!remoteHasData) {
      const migratedHabits = (localData.habits || []).map(normalizeHabit);
      const migratedNotes = (localData.notes || []).map(normalizeNote);
      const migratedReminders = (localData.reminders || []).map(normalizeReminder);
      const migratedConfig = mergeUserIdentityIntoConfig(
        normalizeUserConfig(localData.userConfig || {}),
        mapFirebaseUser(firebaseUser),
      );

      await replaceHabits(uid, migratedHabits);
      await replaceLogs(uid, serializeLogsFromHabits(migratedHabits));
      await replaceCollectionById(uid, USER_SUBCOLLECTIONS.notes, migratedNotes);
      await replaceReminders(uid, migratedReminders);
      await upsertUserSetting(uid, "profile", migratedConfig, true);
    }

    clearLegacyLocalCoreData(uid);

    await upsertUserSetting(uid, "migration", {
      legacyMigratedAt: new Date().toISOString(),
      source: "localStorage",
      imported: !remoteHasData,
    });
  };

  const startRealtimeListeners = (uid, cycleId) => {
    setDataLoading(true);

    const pending = new Set([
      USER_SUBCOLLECTIONS.habits,
      USER_SUBCOLLECTIONS.logs,
      USER_SUBCOLLECTIONS.notes,
      USER_SUBCOLLECTIONS.reminders,
      USER_SUBCOLLECTIONS.settings,
    ]);

    const markLoaded = (collectionId) => {
      pending.delete(collectionId);
      if (pending.size === 0 && authCycleRef.current === cycleId) {
        setDataLoading(false);
      }
    };

    const onListenerError = (collectionId, err) => {
      console.error(`[firestore:${collectionId}]`, err);
      markLoaded(collectionId);
    };

    const subscriptions = [
      subscribeHabits(
        uid,
        (docs) => {
          if (authCycleRef.current !== cycleId) return;
          setHabitDocs(docs);
          markLoaded(USER_SUBCOLLECTIONS.habits);
        },
        (err) => onListenerError(USER_SUBCOLLECTIONS.habits, err),
      ),
      subscribeLogs(
        uid,
        (docs) => {
          if (authCycleRef.current !== cycleId) return;
          setLogDocs(docs);
          markLoaded(USER_SUBCOLLECTIONS.logs);
        },
        (err) => onListenerError(USER_SUBCOLLECTIONS.logs, err),
      ),
      subscribeToUserSubcollection(
        uid,
        USER_SUBCOLLECTIONS.notes,
        (docs) => {
          if (authCycleRef.current !== cycleId) return;
          const sorted = docs
            .map(normalizeNote)
            .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
          setNotes(sorted);
          markLoaded(USER_SUBCOLLECTIONS.notes);
        },
        (err) => onListenerError(USER_SUBCOLLECTIONS.notes, err),
      ),
      subscribeReminders(
        uid,
        (docs) => {
          if (authCycleRef.current !== cycleId) return;
          const sorted = docs
            .map(normalizeReminder)
            .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
          setRemindersState(sorted);
          markLoaded(USER_SUBCOLLECTIONS.reminders);
        },
        (err) => onListenerError(USER_SUBCOLLECTIONS.reminders, err),
      ),
      subscribeToUserSubcollection(
        uid,
        USER_SUBCOLLECTIONS.settings,
        (docs) => {
          if (authCycleRef.current !== cycleId) return;
          setSettingsDocs(docs);
          markLoaded(USER_SUBCOLLECTIONS.settings);
        },
        (err) => onListenerError(USER_SUBCOLLECTIONS.settings, err),
      ),
      onSnapshot(doc(db, "users", uid), (snap) => {
          if (authCycleRef.current !== cycleId) return;
          if (snap.exists() && snap.data().isBanned === true) {
             alert("Account Access Restricted: You have been banned by the Administrator.");
             logout();
          }
      }, (err) => console.error("User doc listener error", err)),
      subscribeToUserSubcollection(
        uid,
        "systemMessages",
        (docs) => {
          if (authCycleRef.current !== cycleId) return;
          docs.forEach(docData => {
            if (!docData.read && docData.message) {
                document.dispatchEvent(new CustomEvent("showToast", {
                    detail: { message: docData.message, type: "info" }
                }));
                document.dispatchEvent(new CustomEvent("addSystemNotification", {
                    detail: { key: docData.id, title: "System Message", body: docData.message, level: "info" }
                }));
                updateDoc(doc(db, "users", uid, "systemMessages", docData.id), { read: true }).catch(()=>{});
            }
          });
        },
        (err) => console.error(err)
      ),
    ];

    listenersRef.current = subscriptions;
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthLoading(false);
      setDataLoading(false);
      return;
    }

    let unsubscribe = () => { };

    const initAuth = async () => {
      // First, resolve any pending redirect result (mobile OAuth flow).
      // This MUST complete before we start listening to auth state changes
      // so that when onAuthStateChanged fires with the signed-in user we
      // don't accidentally treat it as a fresh sign-in that came from nowhere.
      let redirectUser = null;
      try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user) {
          redirectUser = redirectResult.user;
          // Navigate to app immediately after successful redirect so we
          // don't get stuck on the login page
          if (typeof window !== 'undefined' && window.location.pathname === '/login') {
            window.history.replaceState({}, '', '/app');
          }
        }
      } catch (err) {
        // Non-fatal: log but continue. Errors here are usually popup_closed_by_user etc.
        console.warn("getRedirectResult error (non-fatal):", err?.code);
        if (err?.code && err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/null-user') {
          setError(getErrorMessage(err?.code));
        }
      }

      // Now set up the ongoing auth listener
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        const cycleId = authCycleRef.current + 1;
        authCycleRef.current = cycleId;

        stopAllListeners();
        clearAllSyncedState();

        // Use redirect user if onAuthStateChanged fires null immediately after redirect
        const resolvedUser = firebaseUser || redirectUser;

        if (!resolvedUser) {
          setUser(null);
          setDataLoading(false);
          setAuthLoading(false);
          return;
        }

        // Clear redirectUser so subsequent real sign-outs work correctly
        redirectUser = null;

        const mappedUser = mapFirebaseUser(resolvedUser);
        identifyUser(mappedUser.uid, mappedUser.email, mappedUser.name);
        setUser(mappedUser);
        setAuthLoading(false);

        try {
          await ensureUserDocument({
            uid: resolvedUser.uid,
            email: resolvedUser.email,
            displayName: resolvedUser.displayName,
          });

          await upsertUserSetting(
            resolvedUser.uid,
            "profile",
            mergeUserIdentityIntoConfig({}, mappedUser),
            true,
          );

          await migrateLegacyDataIfNeeded(resolvedUser);

          if (authCycleRef.current !== cycleId) return;
          startRealtimeListeners(resolvedUser.uid, cycleId);
        } catch (err) {
          if (authCycleRef.current !== cycleId) return;
          console.error("Failed to initialize user sync:", err);
          setError(err?.message || "Failed to initialize synced data");
          setDataLoading(false);
        }
      });
    };

    initAuth();

    return () => {
      stopAllListeners();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !user.uid) return;

    updateUserPresence(user.uid, true, 0);

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      updateUserPresence(user.uid, isVisible, 0);
    };

    const handleBeforeUnload = () => {
      updateUserPresence(user.uid, false, 0);
    };

    let secondsPassed = 0;
    const interval = setInterval(() => {
       if (document.visibilityState === 'visible') {
          secondsPassed++;
          if (secondsPassed >= 60) {
              updateUserPresence(user.uid, true, secondsPassed);
              secondsPassed = 0;
          }
       }
    }, 1000);

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      updateUserPresence(user.uid, false, secondsPassed);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(interval);
    };
  }, [user]);

  const login = async (email, password) => {
    if (!isFirebaseConfigured) {
      return {
        success: false,
        error: "Firebase is not configured. Please check your .env file.",
      };
    }
    setError(null);
    try {
      await authPersistenceReady;
      const result = await signInWithEmailAndPassword(auth, email, password);
      trackEvent("login", { method: "email" });
      return { success: true, user: result.user };
    } catch (err) {
      const errorMessage = getErrorMessage(err.code);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const signup = async (name, email, password) => {
    if (!isFirebaseConfigured) {
      return {
        success: false,
        error: "Firebase is not configured. Please check your .env file.",
      };
    }
    setError(null);
    try {
      await authPersistenceReady;
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, {
        displayName: name,
      });
      trackEvent("signup", { method: "email" });
      return { success: true, user: result.user };
    } catch (err) {
      const errorMessage = getErrorMessage(err.code);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured) {
      return {
        success: false,
        error: "Firebase is not configured. Please check your .env file.",
      };
    }
    setError(null);
    try {
      await authPersistenceReady;
      const result = await signInWithPopup(auth, googleProvider);
      trackEvent("login", { method: "google" });
      return { success: true, user: result.user };
    } catch (err) {
      const errorMessage = getErrorMessage(err.code);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const loginWithFacebook = async () => {
    if (!isFirebaseConfigured) {
      return {
        success: false,
        error: "Firebase is not configured. Please check your .env file.",
      };
    }
    setError(null);
    try {
      await authPersistenceReady;
      const result = await signInWithPopup(auth, facebookProvider);
      trackEvent("login", { method: "facebook" });
      return { success: true, user: result.user };
    } catch (err) {
      const errorMessage = getErrorMessage(err.code);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    if (!isFirebaseConfigured) {
      setUser(null);
      clearAllSyncedState();
      stopAllListeners();
      return { success: true };
    }
    try {
      await signOut(auth);
      return { success: true };
    } catch (err) {
      const errorMessage = getErrorMessage(err.code);
      return { success: false, error: errorMessage };
    }
  };

  const updateUserConfig = async (updater) => {
    if (!user?.uid) return;
    const nextConfig =
      typeof updater === "function" ? updater(userConfig) : updater || userConfig;
    await upsertUserSetting(
      user.uid,
      "profile",
      mergeUserIdentityIntoConfig(normalizeUserConfig(nextConfig), user),
      true,
    );
  };

  const replaceHabitsState = async (nextHabits) => {
    if (!user?.uid) return;
    await replaceHabitsAndLogs(user.uid, nextHabits);
  };

  const replaceNotesState = async (nextNotes) => {
    if (!user?.uid) return;
    await replaceNotes(user.uid, nextNotes);
  };

  const replaceRemindersState = async (nextReminders) => {
    if (!user?.uid) return;
    await replaceUserReminders(user.uid, nextReminders);
  };

  const upsertSheetsConnectionState = async (payload) => {
    if (!user?.uid) return;
    await upsertUserSetting(user.uid, "sheets", normalizeSheetsState(payload), true);
  };

  const loading = authLoading || dataLoading;

  const value = {
    user,
    loading,
    authLoading,
    dataLoading,
    error,
    login,
    signup,
    loginWithGoogle,
    loginWithFacebook,
    logout,
    isAuthenticated: !!user,

    habits,
    notes,
    reminders,
    userConfig,
    sheetsConnection,

    replaceHabitsState,
    replaceNotesState,
    replaceRemindersState,
    updateUserConfig,
    upsertSheetsConnectionState,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg-main">
          <div className="logo-box">
            <div className="logo-inner"></div>
          </div>
          <p className="preloader-title">
            AurisTitutum <span>| PRO</span>
          </p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

function getErrorMessage(errorCode) {
  switch (errorCode) {
    case "auth/invalid-email":
      return "Invalid email address format";
    case "auth/user-disabled":
      return "This account has been disabled";
    case "auth/user-not-found":
      return "No account found with this email. Please sign up first.";
    case "auth/wrong-password":
      return "Incorrect password. Please check and try again.";
    case "auth/invalid-credential":
      return "Invalid email or password. Please check your credentials.";
    case "auth/invalid-login-credentials":
      return "Invalid email or password. Please check your credentials.";
    case "auth/email-already-in-use":
      return "Email already registered. Please sign in instead.";
    case "auth/weak-password":
      return "Password should be at least 6 characters";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled. Please contact support.";
    case "auth/popup-closed-by-user":
      return "Sign-in cancelled";
    case "auth/cancelled-popup-request":
      return "Sign-in cancelled";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    case "auth/popup-blocked":
      return "Sign-in popup was blocked. Please allow popups and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    default:
      return "Authentication error. Please try again.";
  }
}
