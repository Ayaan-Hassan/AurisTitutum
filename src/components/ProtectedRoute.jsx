import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute — Centralized authentication gate.
 *
 * Behavior:
 *  - While Firebase is restoring the auth session (authLoading): shows a branded
 *    loading screen. No redirect fires prematurely.
 *  - Once loading resolves and user is NOT authenticated: redirects to /login,
 *    preserving the attempted destination in location state for post-login redirect.
 *  - Once loading resolves and user IS authenticated: renders children.
 *
 * This is the ONLY place authentication is enforced for protected routes.
 * No component inside /app/* should need to check auth state for access control.
 */
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, authLoading } = useAuth();
    const location = useLocation();

    // Show a branded loading screen while Firebase restores the auth token.
    // This prevents a false redirect to /login on page refresh.
    if (authLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-bg-main gap-6">
                {/* Logo mark */}
                <div className="relative">
                    <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(var(--accent-rgb,99,102,241),0.3)]">
                        <div className="w-5 h-5 bg-bg-main rotate-45" />
                    </div>
                    {/* Orbit ring */}
                    <div
                        className="absolute inset-0 rounded-2xl border-2 border-accent/30 animate-ping"
                        style={{ animationDuration: '1.8s' }}
                    />
                </div>

                {/* Label */}
                <div className="flex flex-col items-center gap-2">
                    <p className="text-text-primary text-sm font-bold tracking-tight">
                        AurisTitutum <span className="text-text-secondary">PRO</span>
                    </p>
                    <p className="text-text-secondary text-[10px] font-mono uppercase tracking-[0.35em] animate-pulse">
                        Restoring session...
                    </p>
                </div>
            </div>
        );
    }

    // Auth resolved — gate unauthenticated users to /login.
    // We preserve the originally requested path so the user lands there after sign-in.
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

export default ProtectedRoute;

