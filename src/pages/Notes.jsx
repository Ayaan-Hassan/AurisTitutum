import { useState, useMemo } from 'react';
import Icon from '../components/Icon';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/Modals';
import { useAuth } from '../contexts/AuthContext';

const Notes = ({ notes, setNotes }) => {
    const { user } = useAuth();
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editBody, setEditBody] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return notes;
        const q = search.toLowerCase();
        return notes.filter(n =>
            n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
        );
    }, [notes, search]);

    const addNote = () => {
        if (!newTitle.trim() && !newBody.trim()) return;
        const note = {
            id: Date.now().toString(),
            title: newTitle.trim() || 'Untitled',
            body: newBody.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setNotes(prev => [note, ...prev]);
        setNewTitle('');
        setNewBody('');
        setShowAdd(false);
    };

    const startEdit = (note) => {
        setEditingId(note.id);
        setEditTitle(note.title);
        setEditBody(note.body);
    };

    const saveEdit = () => {
        if (!editingId) return;
        setNotes(prev => prev.map(n =>
            n.id === editingId
                ? { ...n, title: editTitle.trim() || 'Untitled', body: editBody.trim(), updatedAt: new Date().toISOString() }
                : n
        ));
        setEditingId(null);
    };

    const formatDate = (iso) => {
        try {
            return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
        } catch {
            return '';
        }
    };

    if (!user) {
        return (
            <div className="page-fade space-y-6 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tighter text-text-primary">Synaptic Notes</h2>
                        <p className="text-text-secondary text-xs mt-1">
                            Secure cloud storage required for encrypted notes.
                        </p>
                    </div>
                </div>
                <Card className="p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 hover:translate-y-0 hover:shadow-none hover:border-border-color">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-accent-dim border border-border-color flex items-center justify-center">
                            <Icon name="lock" size={24} className="text-accent" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-text-primary">Sign in to unlock Notes</h3>
                            <p className="text-xs text-text-secondary mt-1 max-w-sm">
                                Capture thoughts, store private data, and sync seamlessly across your entire workspace network.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="primary"
                        className="w-full sm:w-auto"
                        onClick={() => { window.location.href = '/login'; }}
                    >
                        Sign in to continue
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="page-fade min-h-[calc(100vh-120px)] flex flex-col space-y-6 pb-12">

            {/* ── Header ── */}
            <div className="relative overflow-hidden rounded-xl border border-border-color bg-card-bg p-6 sm:p-8 shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[80px] pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-secondary mb-1 font-mono">
                            Knowledge Base
                        </p>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                            Synaptic Notes
                        </h2>
                        <p className="text-text-secondary text-sm mt-2 max-w-xl leading-relaxed">
                            A minimal block-storage system to log your thoughts, brain-dumps, and daily reflections.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="flex-1 sm:flex-initial relative">
                            <input
                                type="text"
                                placeholder="Search repository..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full sm:w-56 h-12 pl-10 pr-4 rounded-xl bg-bg-main border border-border-color text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent transition-all"
                            />
                            <Icon name="filter" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                        </div>
                        <button
                            onClick={() => setShowAdd(true)}
                            className="h-12 px-5 bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.2em] rounded-xl hover:opacity-90 active:scale-95 transition-all whitespace-nowrap flex items-center gap-2 shadow-lg"
                        >
                            <Icon name="plus" size={14} />
                            New Block
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Editor Overlay ── */}
            {showAdd && (
                <Card className="p-6 relative overflow-hidden bg-bg-sidebar border-accent/20 shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-accent/20" />
                    <div className="flex items-center justify-between mb-4 mt-2">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary">Drafting new generic block</h4>
                        <button onClick={() => { setShowAdd(false); setNewTitle(''); setNewBody(''); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-main transition-colors">
                            <Icon name="x" size={16} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="Data block title..."
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            className="w-full bg-bg-main border border-border-color p-4 rounded-xl text-lg font-bold text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent"
                            autoFocus
                        />
                        <textarea
                            placeholder="Inject syntax, text, or ideas..."
                            value={newBody}
                            onChange={e => setNewBody(e.target.value)}
                            rows={6}
                            className="w-full bg-bg-main border border-border-color p-4 rounded-xl text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent resize-none font-mono leading-relaxed"
                        />
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={addNote}
                                disabled={!newTitle.trim() && !newBody.trim()}
                                className="px-6 py-3 bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.2em] rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 flex items-center gap-2"
                            >
                                <Icon name="save" size={14} /> Commit Data
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            {/* ── Notes Grid ── */}
            {filtered.length > 0 ? (
                <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6 pt-2">
                    {filtered.map(note => (
                        <div key={note.id} className="break-inside-avoid">
                            <Card className="flex flex-col group relative overflow-hidden bg-card-bg border-border-color hover:border-accent hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 h-auto">
                                <div className="absolute top-0 left-0 w-1 h-full bg-accent/20 group-hover:bg-accent transition-colors" />

                                {editingId === note.id ? (
                                    <div className="p-5 space-y-4">
                                        <input
                                            type="text"
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            className="w-full bg-bg-main border border-border-color p-3 rounded-lg text-sm font-bold text-text-primary outline-none focus:border-accent"
                                            autoFocus
                                        />
                                        <textarea
                                            value={editBody}
                                            onChange={e => setEditBody(e.target.value)}
                                            rows={6}
                                            className="w-full bg-bg-main border border-border-color p-3 rounded-lg text-xs text-text-primary outline-none focus:border-accent resize-none font-mono leading-relaxed"
                                        />
                                        <div className="flex gap-3 justify-end pt-2">
                                            <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg text-xs font-bold text-text-secondary hover:bg-bg-main transition-colors">Cancel</button>
                                            <button onClick={saveEdit} className="px-4 py-2 bg-accent text-bg-main rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">Save</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-5 flex flex-col h-full">
                                        <div className="flex items-start justify-between gap-3 mb-4">
                                            <h4 className="text-base font-bold text-text-primary leading-tight flex-1">{note.title}</h4>

                                            {/* Action HUD */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-bg-main/50 p-1 rounded-lg backdrop-blur-md">
                                                <button onClick={() => startEdit(note)} className="w-8 h-8 rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-main transition-all">
                                                    <Icon name="pencil" size={14} />
                                                </button>
                                                <button onClick={() => setDeleteTarget(note.id)} className="w-8 h-8 rounded-md flex items-center justify-center text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-all">
                                                    <Icon name="trash" size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {note.body && (
                                            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap flex-1 mb-6 font-mono opacity-80">{note.body}</p>
                                        )}

                                        <div className="mt-auto pt-4 border-t border-border-color flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                                <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest">{formatDate(note.updatedAt)}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="relative overflow-hidden rounded-2xl border border-border-color bg-card-bg/50 flex-1 flex flex-col items-center justify-center min-h-[400px]">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-accent/5 blur-[100px] pointer-events-none" />
                    <div className="flex flex-col items-center justify-center text-center relative z-10 px-6">
                        <div className="w-20 h-20 rounded-2xl bg-bg-main border border-border-color flex items-center justify-center mb-6 shadow-2xl">
                            <Icon name="layers" size={32} className="text-text-secondary opacity-60" />
                        </div>
                        <p className="text-xl font-bold text-text-primary mb-3">
                            {search ? 'No data blocks aligned' : 'Repository is blank'}
                        </p>
                        <p className="text-sm text-text-secondary max-w-sm mx-auto leading-relaxed mb-8">
                            {search ? 'Adjust your filter queries to locate the knowledge block.' : 'Begin capturing text, encrypted strings, and daily brain-dumps to utilize the Synaptic network.'}
                        </p>
                        {!search && (
                            <button
                                onClick={() => setShowAdd(true)}
                                className="px-6 py-3 border border-border-color bg-bg-main text-text-primary text-[10px] font-black uppercase tracking-[0.25em] rounded-xl hover:bg-bg-sidebar hover:border-accent transition-all shadow-lg"
                            >
                                Initialize First Block
                            </button>
                        )}
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!deleteTarget}
                title="Purge Data Block"
                message="Are you absolutely certain? Purging this block will permanently delete its signature from the repository."
                confirmLabel="Purge"
                variant="danger"
                onConfirm={() => { if (deleteTarget) { setNotes(prev => prev.filter(n => n.id !== deleteTarget)); setDeleteTarget(null); } }}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
};

export default Notes;
