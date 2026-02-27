import { createContext, useContext, useState, useEffect } from "react";
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

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

const mapFirebaseUser = (firebaseUser) => ({
  uid: firebaseUser.uid,
  id: firebaseUser.uid,
  email: firebaseUser.email,
  name: firebaseUser.displayName || firebaseUser.email?.split("@")[0],
  photoURL: firebaseUser.photoURL,
  createdAt: firebaseUser.metadata.creationTime,
});

const isMobileDevice = () =>
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  );

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setUser(mapFirebaseUser(result.user));
        }
      })
      .catch((err) => {
        const errorMessage = getErrorMessage(err?.code);
        setError(errorMessage);
      });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(mapFirebaseUser(firebaseUser));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      // Update profile with display name
      await updateProfile(result.user, {
        displayName: name,
      });
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
      if (isMobileDevice()) {
        await signInWithRedirect(auth, googleProvider);
        return { success: true };
      }
      const result = await signInWithPopup(auth, googleProvider);
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
      if (isMobileDevice()) {
        await signInWithRedirect(auth, facebookProvider);
        return { success: true };
      }
      const result = await signInWithPopup(auth, facebookProvider);
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

  const value = {
    user,
    loading,
    error,
    login,
    signup,
    loginWithGoogle,
    loginWithFacebook,
    logout,
    isAuthenticated: !!user,
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

// Helper function to convert Firebase error codes to user-friendly messages
function getErrorMessage(errorCode) {
  switch (errorCode) {
    case "auth/invalid-email":
      return "Invalid email address format";
    case "auth/user-disabled":
      return "This account has been disabled";
    case "auth/user-not-found":
      return "No account found with this email";
    case "auth/wrong-password":
      return "Incorrect password";
    case "auth/email-already-in-use":
      return "Email already registered";
    case "auth/weak-password":
      return "Password should be at least 6 characters";
    case "auth/operation-not-allowed":
      return "Operation not allowed";
    case "auth/popup-closed-by-user":
      return "Sign-in cancelled";
    case "auth/cancelled-popup-request":
      return "Sign-in cancelled";
    default:
      return "Authentication error. Please try again";
  }
}
