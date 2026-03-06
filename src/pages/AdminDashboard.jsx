import { useState, useEffect } from "react";
import { collection, getDocs, collectionGroup, getCountFromServer } from "firebase/firestore";
import { db } from "../firebase.config";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/Button";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";

export default function AdminDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // NOTE: This assumes the user's UID has Firestore security rules giving them
    // permission to read entire collections/collectionGroups
    const adminUid = import.meta.env.VITE_ADMIN_UID;
    const isAdmin = user && adminUid && user.uid === adminUid;

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError(null);

            const usersSnapshot = await getCountFromServer(collection(db, "users"));
            const habitsSnapshot = await getCountFromServer(collectionGroup(db, "habits"));
            const remindersSnapshot = await getCountFromServer(collectionGroup(db, "reminders"));
            const notesSnapshot = await getCountFromServer(collectionGroup(db, "notes"));

            // For sheets connection, maybe count setting docs that are connected?
            // Or we can just read all 'settings' and filter, but collectionGroup may be heavy
            // Let's just do a rough count or query where sheetUrl != null
            // Sidenote: getCountFromServer doesn't support complex querying easily on nested maps,
            // We will leave Sheets Connections as N/A or compute it if necessary.

            setStats({
                users: usersSnapshot.data().count,
                habits: habitsSnapshot.data().count,
                reminders: remindersSnapshot.data().count,
                notes: notesSnapshot.data().count,
                dau: "Check PostHog for exact DAU",
                sheets: "N/A"
            });
        } catch (err) {
            console.error(err);
            setError("Failed to fetch admin stats. Ensure Firestore security rules permit collectionGroup queries for you.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            fetchStats();
        }
    }, [isAdmin]);

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center p-10">
                <Icon name="shield-check" size={48} className="text-text-secondary mb-4" />
                <h2 className="text-xl font-bold font-mono uppercase tracking-[0.2em] text-text-primary">
                    Access Denied
                </h2>
                <p className="text-sm text-text-secondary mt-2">
                    Only the authorized master UID can access the analytics dashboard.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tighter text-text-primary">
                        Platform Master Console
                    </h2>
                    <p className="text-text-secondary text-xs mt-1">
                        Global metrics generated live from Firestore infrastructure.
                    </p>
                </div>
                <Button onClick={fetchStats} variant="outline" size="sm" icon="rotate-ccw">
                    Refresh Data
                </Button>
            </div>

            {error ? (
                <Card className="p-4 border-danger/40 bg-danger/10 text-danger text-sm">
                    {error}
                </Card>
            ) : loading ? (
                <div className="flex items-center gap-3 text-text-secondary text-sm font-mono uppercase">
                    <Icon name="activity" className="animate-pulse" />
                    Aggregating nodes...
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <MetricCard title="Total Users" value={stats.users} icon="user" />
                    <MetricCard title="Habits Created" value={stats.habits} icon="activity" />
                    <MetricCard title="Reminders" value={stats.reminders} icon="bell" />
                    <MetricCard title="Notes" value={stats.notes} icon="file-text" />
                    <MetricCard title="Sheets Connected" value={stats.sheets} icon="file-spreadsheet" />
                    <MetricCard title="Active Today" value={stats.dau} icon="trending-up" />
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 mt-8">
                <Card className="p-6">
                    <h3 className="font-bold text-sm tracking-widest uppercase mb-2">Telemetry</h3>
                    <p className="text-xs text-text-secondary mb-4">
                        PostHog, Microsoft Clarity, GA4, and Sentry are installed locally.
                        All behavior paths and crash events are automatically piped out.
                    </p>
                    <a href="https://app.posthog.com" target="_blank" rel="noreferrer" className="text-accent text-xs font-bold hover:underline">
                        Open PostHog →
                    </a>
                </Card>
            </div>
        </div>
    );
}

function MetricCard({ title, value, icon }) {
    return (
        <Card className="p-5 flex flex-col gap-3">
            <div className="flex items-center text-text-secondary justify-between">
                <Icon name={icon} size={16} />
            </div>
            <div>
                <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] text-text-secondary mb-1">
                    {title}
                </h4>
                <div className="text-2xl font-black text-text-primary font-mono tracking-tighter">
                    {value}
                </div>
            </div>
        </Card>
    );
}
