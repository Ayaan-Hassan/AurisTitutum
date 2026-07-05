import { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import { onSnapshot, doc, updateDoc, getDoc, query, collection, where } from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  auth,
  db,
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
  upsertCollectionDoc,
  deleteCollectionDoc,
} from "../services/firestoreService";
import {
  aggregateHabitsFromDocs,
  replaceHabits,
  subscribeHabits,
  createHabit,
  updateHabit as serviceUpdateHabit,
  deleteHabit as serviceDeleteHabit,
} from "../services/habitService";
import { 
  replaceLogs, 
  serializeLogsFromHabits, 
  subscribeLogs,
  createLog,
  deleteLog as serviceDeleteLog,
  clearUserLogs,
} from "../services/logService";
import { replaceReminders, subscribeReminders } from "../services/reminderService";
import { identifyUser, trackEvent } from "../utils/telemetry";
import { syncService } from "../services/syncService";

const AuthContext = createContext(null);
let redirectUser = null;

const DEFAULT_USER_CONFIG = {
  name: "",
  email: "",
  age: "",
  gender: "",
  avatar: null,
  connectedPeerId: null,
  connectedPeerName: "",
  settings: {
    persistence: true,
    audit: true,
    devConsole: false,
    notificationsEnabled: true,
    hasSeenTour: false,
    onboardingComplete: false,
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
    date: note?.date || null,
    pinned: !!note?.pinned,
    isLocked: !!note?.isLocked,
    passcode: note?.passcode || "",
    adminCreated: !!note?.adminCreated,
    createdAt: note?.createdAt || now,
    updatedAt: note?.updatedAt || now,
  };
};

const normalizeReminder = (reminder = {}) => {
  const now = new Date().toISOString();
  return {
    id: String(reminder?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    title: reminder?.title || "Untitled",
    notes: reminder?.notes || "",
    date: reminder?.date || now.split('T')[0],
    time: reminder?.time || "09:00",
    repeat: reminder?.repeat || "none",
    color: reminder?.color || "white", // Default to white for better visibility
    createdAt: reminder?.createdAt || now,
    updatedAt: reminder?.updatedAt || now,
  };
};

const normalizeHabit = (habit = {}) => ({
  ...habit,
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


const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  );

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
const facebookProvider = new FacebookAuthProvider();

// Admin UID — this account is permanently exempt from ban enforcement
const ADMIN_UID = (import.meta.env.VITE_ADMIN_UID || "").replace(/['"]/g, '').trim();
const isAdminUid = (uid) => {
  if (!ADMIN_UID || !uid) return false;
  return uid.trim() === ADMIN_UID;
};

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
  const [hasAuthListenerFired, setHasAuthListenerFired] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isBanned, setIsBanned] = useState(false);
  const [isWiped, setIsWiped] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [showBanModal, setShowBanModal] = useState(false);


  const [habitDocs, setHabitDocs] = useState([]);
  const [logDocs, setLogDocs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reminders, setRemindersState] = useState([]);
  const [settingsDocs, setSettingsDocs] = useState([]);
  const [behavioralMemory, setBehavioralMemory] = useState([]);
  
  const sessionStartTime = useRef(new Date());
  const lastBannedState = useRef(false);

  const listenersRef = useRef([]);
  const authCycleRef = useRef(0);
  const writeQueueRef = useRef(Promise.resolve());

  const queueWrite = (operation) => {
    writeQueueRef.current = writeQueueRef.current.then(operation).catch((err) => {
      console.error("[WriteQueue] Operation failed:", err);
      throw err;
    });
    return writeQueueRef.current;
  };

  useEffect(() => {
    console.log("[AuthContext state log] authLoading:", authLoading, "| hasAuthListenerFired:", hasAuthListenerFired, "| user:", user ? user.uid : "null");
  }, [authLoading, hasAuthListenerFired, user]);

  const clearAllSyncedState = () => {
    setHabitDocs([]);
    setLogDocs([]);
    setNotes([]);
    setRemindersState([]);
    setSettingsDocs([]);
    setBehavioralMemory([]);
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





  const replaceHabitsAndLogs = async (uid, nextHabitsArg) => {
    const currentHabits = habits; // From context scope
    const nextHabits = typeof nextHabitsArg === "function" ? nextHabitsArg(currentHabits) : nextHabitsArg;
    const normalizedHabits = (Array.isArray(nextHabits) ? nextHabits : []).map(normalizeHabit);
    await replaceHabits(uid, normalizedHabits);
    await replaceLogs(uid, serializeLogsFromHabits(normalizedHabits));
  };

  const replaceNotes = async (uid, nextNotesArg) => {
    const currentNotes = notes; // From context scope
    const nextNotes = typeof nextNotesArg === "function" ? nextNotesArg(currentNotes) : nextNotesArg;
    const normalized = (Array.isArray(nextNotes) ? nextNotes : []).map(normalizeNote);
    await replaceCollectionById(uid, USER_SUBCOLLECTIONS.notes, normalized);
  };

  const replaceUserReminders = async (uid, nextRemindersArg) => {
    const currentReminders = reminders; // From context scope
    const nextReminders = typeof nextRemindersArg === "function" ? nextRemindersArg(currentReminders) : nextRemindersArg;
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
      USER_SUBCOLLECTIONS.behavioralMemory,
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
          // Populate cache from authoritative Firestore snapshot
          syncService.writeCache(uid, USER_SUBCOLLECTIONS.habits, docs);
          markLoaded(USER_SUBCOLLECTIONS.habits);
        },
        (err) => onListenerError(USER_SUBCOLLECTIONS.habits, err),
      ),
      subscribeLogs(
        uid,
        (docs) => {
          if (authCycleRef.current !== cycleId) return;
          setLogDocs(docs);
          syncService.writeCache(uid, USER_SUBCOLLECTIONS.logs, docs);
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
          syncService.writeCache(uid, USER_SUBCOLLECTIONS.notes, sorted);
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
          syncService.writeCache(uid, USER_SUBCOLLECTIONS.reminders, sorted);
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
          syncService.writeCache(uid, USER_SUBCOLLECTIONS.settings, docs);
          markLoaded(USER_SUBCOLLECTIONS.settings);
        },
        (err) => onListenerError(USER_SUBCOLLECTIONS.settings, err),
      ),
      subscribeToUserSubcollection(
        uid,
        USER_SUBCOLLECTIONS.behavioralMemory,
        (docs) => {
          if (authCycleRef.current !== cycleId) return;
          const sorted = docs.sort((a, b) => String(b.lastObserved || b.createdAt || "").localeCompare(String(a.lastObserved || a.createdAt || "")));
          setBehavioralMemory(sorted);
          syncService.writeCache(uid, USER_SUBCOLLECTIONS.behavioralMemory, sorted);
          markLoaded(USER_SUBCOLLECTIONS.behavioralMemory);
        },
        (err) => onListenerError(USER_SUBCOLLECTIONS.behavioralMemory, err),
      ),
      onSnapshot(doc(db, "users", uid), (snap) => {
          if (authCycleRef.current !== cycleId) return;
          // Admin is never subject to ban enforcement
          if (isAdminUid(uid)) return;
          const data = snap.exists() ? snap.data() : {};
          const banned = data.isBanned === true;
          const wiped = data.isWiped === true;
          const reason = data.banReason || "Your account is temporarily banned due to system protocol violations.";
          
          setIsBanned(banned);
          setIsWiped(wiped);


          if (banned && lastBannedState.current === false) {
              setBanReason(reason);
              setShowBanModal(true);
              
              // Force logout after a short delay
              setTimeout(() => {
                  try { auth.signOut(); } catch(e) {}
              }, 4000);
          } else if (!banned && lastBannedState.current === true) {
              setIsBanned(false);
              setShowBanModal(true); // To show "Access restored"
          }
          lastBannedState.current = banned;
      }, (err) => console.error("User doc listener error", err)),
      subscribeToUserSubcollection(
        uid,
        "systemMessages",
        (docs) => {
          if (authCycleRef.current !== cycleId) return;
          docs.forEach(docData => {
            if (!docData.read && docData.message) {
                const isOnlineMsg = docData.createdAt ? new Date(docData.createdAt) > sessionStartTime.current : true;
                if (isOnlineMsg) {
                    document.dispatchEvent(new CustomEvent("showSystemPopup", {
                        detail: { message: docData.message, id: docData.id }
                    }));
                } else {
                    document.dispatchEvent(new CustomEvent("addSystemNotification", {
                        detail: { title: "New Message", body: docData.message, level: "info" }
                    }));
                }
                updateDoc(doc(db, "users", uid, "systemMessages", docData.id), { read: true }).catch(()=>{});
            }
          });
        },
        (err) => console.error(err)
      ),
    ];

    listenersRef.current = subscriptions;
  };

  // Initialize syncService once on mount
  useEffect(() => {
    syncService.init();
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      console.warn("[AuthInit] Firebase is not configured or auth is null. Disabling loading states.");
      setAuthLoading(false);
      setDataLoading(false);
      return;
    }

    let unsubscribe = () => { };

    const initAuth = async () => {
      console.log("[AuthInit] Initializing Auth. Awaiting authPersistenceReady...");
      // Ensure persistence is initialized before we start
      const { authPersistenceReady } = await import("../firebase.config");
      await authPersistenceReady;
      console.log("[AuthInit] authPersistenceReady resolved.");
      
      // First, resolve any pending redirect result (mobile OAuth flow).
      // This MUST complete before we start listening to auth state changes
      // so that when onAuthStateChanged fires with the signed-in user we
      // don't accidentally treat it as a fresh sign-in that came from nowhere.
      let redirectUser = null;
      try {
        console.log("[AuthInit] Fetching redirect result...");
        // Wrap getRedirectResult in a timeout to prevent absolute hangs
        const redirectPromise = getRedirectResult(auth);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Auth redirect timeout")), 3000)
        );
        
        const redirectResult = await Promise.race([redirectPromise, timeoutPromise]).catch(err => {
          console.warn("[AuthInit] Redirect result failed or timed out:", err);
          return null;
        });

        if (redirectResult?.user) {
          redirectUser = redirectResult.user;
          console.log("[AuthInit] Redirect result found user:", redirectUser.uid);
          if (typeof window !== 'undefined' && window.location.pathname === '/login') {
            window.history.replaceState({}, '', '/app');
          }
        } else {
          console.log("[AuthInit] No redirect result user found.");
        }
      } catch (err) {
        console.warn("[AuthInit] getRedirectResult error (non-fatal):", err?.code);
        if (err?.code && err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/null-user') {
          setError(getErrorMessage(err?.code));
        }
      }

      // Now set up the ongoing auth listener
      console.log("[AuthInit] Registering onAuthStateChanged listener...");
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        // Set listener fired to true so other components know the first check resolved.
        setHasAuthListenerFired(true);

        console.log("[AuthInit] onAuthStateChanged callback triggered.");
        console.log("[AuthInit] firebaseUser (parameter):", firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email } : "null");
        console.log("[AuthInit] auth.currentUser:", auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email } : "null");

        const cycleId = authCycleRef.current + 1;
        authCycleRef.current = cycleId;

        stopAllListeners();
        clearAllSyncedState();

        // Use redirect user if onAuthStateChanged fires null immediately after redirect
        const resolvedUser = firebaseUser || redirectUser;

        if (!resolvedUser) {
          console.log("[AuthInit] No user resolved (user is logged out). Setting user to null.");
          setUser(null);
          setDataLoading(false);
          setAuthLoading(false);
          return;
        }

        // Clear redirectUser so subsequent real sign-outs work correctly
        redirectUser = null;

        const mappedUser = mapFirebaseUser(resolvedUser);
        const isUserAdmin = isAdminUid(mappedUser.uid);
        
        identifyUser(mappedUser.uid, mappedUser.email, mappedUser.name);
        
        try {
          // Pre-sync Ban Check (skip for admin)
          if (!isUserAdmin) {
            console.log("[AuthInit] Running pre-sync ban check for:", mappedUser.uid);
            const userDoc = await getDoc(doc(db, "users", resolvedUser.uid));
            if (userDoc.exists() && userDoc.data().isBanned === true) {
               const reason = userDoc.data().banReason || "Your account is temporarily suspended due to violation of system protocols.";
               console.warn("[AuthInit] User is banned. Reason:", reason);
               setIsBanned(true);
               setBanReason(reason);
               setError(reason);
               await auth.signOut();
               setUser(null);
               setAuthLoading(false);
               setDataLoading(false);
               return;
            }
          }

          // Set user immediately so the app knows who is logged in
          console.log("[AuthInit] User resolved and validated. Setting user state:", mappedUser.uid);
          setUser(mappedUser);

          const runSetup = async () => {
             try {
              console.log("[AuthInit] Running user database setup...");
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
              console.log("[AuthInit] Database setup and migration completed.");
            } catch (setupErr) {
              console.warn("[AuthInit] Firestore setup warning (non-fatal):", setupErr?.message);
            } finally {
              if (authCycleRef.current === cycleId) {
                console.log("[AuthInit] Mark auth loading complete (resolved user flow).");
                setAuthLoading(false);
              }
            }
          };

          // Run setup - regular users block on this, admin runs it async
          await runSetup();

          if (authCycleRef.current !== cycleId) return;
          console.log("[AuthInit] Starting real-time listeners for data syncing.");
          startRealtimeListeners(resolvedUser.uid, cycleId);
        } catch (err) {
          if (authCycleRef.current !== cycleId) return;
          console.error("[AuthInit] Failed to initialize user sync:", err);
          setError(err?.message || "Failed to initialize synced data");
          setDataLoading(false);
          setAuthLoading(false);
        }
      });
    };

    initAuth();

    return () => {
      console.log("[AuthInit Cleanup] Unsubscribing auth listeners...");
      stopAllListeners();
      unsubscribe();
    };
  }, []);

  const [uploadCooldown, setUploadCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (uploadCooldown > 0) {
      timer = setInterval(() => setUploadCooldown(prev => Math.max(0, prev - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [uploadCooldown]);

  const triggerUploadCooldown = () => setUploadCooldown(10);


  // Authenticated-user presence tracking (no guest tracking)
  useEffect(() => {
    if (!user?.uid) return;

    const isVisible = document.visibilityState === 'visible';
    updateUserPresence(user.uid, isVisible, 0);

    const handleVisibilityChange = () => {
      if (!user?.uid) return;
      updateUserPresence(user.uid, document.visibilityState === 'visible', 0);
    };

    const handleBeforeUnload = () => {
      if (user?.uid) updateUserPresence(user.uid, false, 0);
    };

    let secondsPassed = 0;
    const interval = setInterval(() => {
      secondsPassed++;
      if (secondsPassed >= 20) {
        if (user?.uid) updateUserPresence(user.uid, true, secondsPassed);
        secondsPassed = 0;
      }
    }, 1000);

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (user?.uid) updateUserPresence(user.uid, false, secondsPassed);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(interval);
    };
  }, [user?.uid]);

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
      
      // Strict Ban Check post-login (skip for admin)
      if (!isAdminUid(result.user.uid)) {
        const userDoc = await getDoc(doc(db, "users", result.user.uid));
        if (userDoc.exists() && userDoc.data().isBanned === true) {
            await auth.signOut();
            return { success: false, error: "Your account is temporarily suspended due to violation of system protocols." };
        }
      }

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

      // Strict Ban Check (skip for admin)
      if (!isAdminUid(result.user.uid)) {
        const userDoc = await getDoc(doc(db, "users", result.user.uid));
        if (userDoc.exists() && userDoc.data().isBanned === true) {
            await auth.signOut();
            return { success: false, error: "Your account is temporarily suspended due to violation of system protocols." };
        }
      }

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

      // Strict Ban Check (skip for admin)
      if (!isAdminUid(result.user.uid)) {
        const userDoc = await getDoc(doc(db, "users", result.user.uid));
        if (userDoc.exists() && userDoc.data().isBanned === true) {
            await auth.signOut();
            return { success: false, error: "Your account is temporarily suspended. Please send us an enquiry to appeal." };
        }
      }

      trackEvent("login", { method: "facebook" });
      return { success: true, user: result.user };
    } catch (err) {
      const errorMessage = getErrorMessage(err.code);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    // Clear the local cache for this user before signing out
    if (user?.uid) {
      syncService.clearUserCache(user.uid);
    }
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

  const checkOnlineStatus = () => {
    if (!navigator.onLine) {
      const toastEvent = new CustomEvent("showToast", {
        detail: { message: "You are offline. Action aborted to prevent data mismatch.", type: "error" }
      });
      document.dispatchEvent(toastEvent);
      return false;
    }
    return true;
  };

  const updateUserConfig = async (updater) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    
    const nextConfig = typeof updater === "function" 
      ? updater(userConfig) 
      : { ...userConfig, ...updater };
      
    // Filter out internal fields that shouldn't be saved to Firestore directly
    const { updater: internalUpdater, ...cleanConfig } = nextConfig;

    return queueWrite(() => upsertUserSetting(
      user.uid,
      "profile",
      mergeUserIdentityIntoConfig(normalizeUserConfig(cleanConfig), user),
      true,
    ));
  };

  const replaceHabitsState = async (nextHabits) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    return queueWrite(() => replaceHabitsAndLogs(user.uid, nextHabits));
  };

  const replaceNotesState = async (nextNotes) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    return queueWrite(() => replaceNotes(user.uid, nextNotes));
  };

  const replaceRemindersState = async (nextReminders) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    return queueWrite(() => replaceUserReminders(user.uid, nextReminders));
  };

  const addHabit = async (payload) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    // Optimistic: update cache via syncService, then write to Firestore
    const habit = { ...payload, updatedAt: new Date().toISOString() };
    syncService.enqueue({ type: 'upsert', uid: user.uid, collection: USER_SUBCOLLECTIONS.habits, id: String(habit.id), payload: habit });
    return queueWrite(() => createHabit(user.uid, payload));
  };

  const updateHabit = async (habitId, payload) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    syncService.enqueue({ type: 'upsert', uid: user.uid, collection: USER_SUBCOLLECTIONS.habits, id: String(habitId), payload: { ...payload, id: String(habitId) } });
    return queueWrite(() => serviceUpdateHabit(user.uid, habitId, payload));
  };

  const deleteHabit = async (habitId) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    syncService.enqueue({ type: 'delete', uid: user.uid, collection: USER_SUBCOLLECTIONS.habits, id: String(habitId) });
    return queueWrite(() => serviceDeleteHabit(user.uid, habitId));
  };

  const addLog = async (payload) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    const id = String(payload?.id || `${payload?.habitId || "habit"}_${Date.now()}`);
    const logPayload = { ...payload, id };
    // Optimistic cache update for instant UI feedback (offline support)
    syncService.enqueue({ type: 'upsert', uid: user.uid, collection: USER_SUBCOLLECTIONS.logs, id, payload: logPayload });
    return queueWrite(() => createLog(user.uid, payload));
  };

  const deleteLog = async (logId) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    syncService.enqueue({ type: 'delete', uid: user.uid, collection: USER_SUBCOLLECTIONS.logs, id: String(logId) });
    return queueWrite(() => serviceDeleteLog(user.uid, logId));
  };

  const upsertNote = async (payload) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    const normalized = normalizeNote(payload);
    syncService.enqueue({ type: 'upsert', uid: user.uid, collection: USER_SUBCOLLECTIONS.notes, id: normalized.id, payload: normalized });
    return queueWrite(() => upsertCollectionDoc(user.uid, USER_SUBCOLLECTIONS.notes, normalized.id, normalized, true));
  };

  const deleteNote = async (noteId) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    syncService.enqueue({ type: 'delete', uid: user.uid, collection: USER_SUBCOLLECTIONS.notes, id: String(noteId) });
    return queueWrite(() => deleteCollectionDoc(user.uid, USER_SUBCOLLECTIONS.notes, noteId));
  };

  const upsertReminder = async (payload) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    const normalized = normalizeReminder(payload);
    syncService.enqueue({ type: 'upsert', uid: user.uid, collection: USER_SUBCOLLECTIONS.reminders, id: normalized.id, payload: normalized });
    return queueWrite(() => upsertCollectionDoc(user.uid, USER_SUBCOLLECTIONS.reminders, normalized.id, normalized, true));
  };

  const deleteReminder = async (reminderId) => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    syncService.enqueue({ type: 'delete', uid: user.uid, collection: USER_SUBCOLLECTIONS.reminders, id: String(reminderId) });
    return queueWrite(() => deleteCollectionDoc(user.uid, USER_SUBCOLLECTIONS.reminders, reminderId));
  };

  const clearAllSyncedLogs = async () => {
    if (!user?.uid) return;
    if (!checkOnlineStatus()) return;
    // Clear logs from cache too
    syncService.writeCache(user.uid, USER_SUBCOLLECTIONS.logs, []);
    return queueWrite(() => clearUserLogs(user.uid));
  };

  const addBehavioralMemory = async (payload) => {
    if (!user?.uid) return;
    const id = payload.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const memPayload = { ...payload, id, lastObserved: payload.lastObserved || new Date().toISOString() };
    syncService.enqueue({ type: 'upsert', uid: user.uid, collection: USER_SUBCOLLECTIONS.behavioralMemory, id, payload: memPayload });
    return queueWrite(() => upsertCollectionDoc(user.uid, USER_SUBCOLLECTIONS.behavioralMemory, id, memPayload, true));
  };

  const deleteBehavioralMemory = async (id) => {
    if (!user?.uid) return;
    syncService.enqueue({ type: 'delete', uid: user.uid, collection: USER_SUBCOLLECTIONS.behavioralMemory, id: String(id) });
    return queueWrite(() => deleteCollectionDoc(user.uid, USER_SUBCOLLECTIONS.behavioralMemory, id));
  };


  const loading = authLoading || dataLoading;

  const value = {
    user,
    isAdmin: isAdminUid(user?.uid),
    loading,
    authLoading,
    hasAuthListenerFired,
    dataLoading,
    error,
    login,
    signup,
    loginWithGoogle,
    loginWithFacebook,
    logout,
    isAuthenticated: !!user,
    isBanned,
    isWiped,
    banReason,
    showBanModal,
    setShowBanModal,


    habits,
    logDocs,
    notes,
    reminders,
    userConfig,

    replaceHabitsState,
    replaceNotesState,
    replaceRemindersState,
    updateUserConfig,

    addHabit,
    updateHabit,
    deleteHabit,
    addLog,
    deleteLog,
    clearAllSyncedLogs,
    upsertNote,
    deleteNote,
    upsertReminder,
    deleteReminder,
    behavioralMemory,
    addBehavioralMemory,
    deleteBehavioralMemory,
    uploadCooldown,
    triggerUploadCooldown,
  };

  return (
    <AuthContext.Provider value={value}>
      {authLoading ? (
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
