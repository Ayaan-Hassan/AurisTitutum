import { useState, useMemo } from 'react';
import Icon from '../components/Icon';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/Modals';
import { useAuth } from '../contexts/AuthContext';
import { trackEvent } from '../utils/telemetry';

const NOTE_COLORS = [
    { id: 'default', colorClass: 'var(--card-bg)' },
    { id: 'blue', colorClass: 'rgba(59, 130, 246, 0.2)' },
    { id: 'emerald', colorClass: 'rgba(16, 185, 129, 0.2)' },
    { id: 'amber', colorClass: 'rgba(245, 158, 11, 0.2)' },
    { id: 'rose', colorClass: 'rgba(244, 63, 94, 0.2)' },
    { id: 'purple', colorClass: 'rgba(168, 85, 247, 0.2)' },
];

const Notes = ({ notes, setNotes }) => {
    const { user } = useAuth();
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editBody, setEditBody] = useState('');
    const [editColor, setEditColor] = useState('default');

    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [newColor, setNewColor] = useState('default');
    const [showAdd, setShowAdd] = useState(false);
    const [featureLockOpen, setFeatureLockOpen] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [search, setSearch] = useState('');
    const [filterPinned, setFilterPinned] = useState(false);
    const [expandedNoteId, setExpandedNoteId] = useState(null);

    const sortedNotes = useMemo(() => {
        // Sort explicitly: By pinned first, then by latest updated
        return [...notes].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
    }, [notes]);

    const filtered = useMemo(() => {
        let result = sortedNotes;
        if (filterPinned) {
            result = result.filter(n => n.pinned);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(n =>
                n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
            );
        }
        return result;
    }, [sortedNotes, search, filterPinned]);

    const addNote = () => {
        if (!newTitle.trim() && !newBody.trim()) return;
        const note = {
            id: Date.now().toString(),
            title: newTitle.trim() || 'Untitled',
            body: newBody.trim(),
            color: newColor,
            pinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setNotes(prev => [note, ...prev]);
        trackEvent("note_created", { color: newColor });
        setNewTitle('');
        setNewBody('');
        setNewColor('default');
        setShowAdd(false);
    };

    const startEdit = (note) => {
        setEditingId(note.id);
        setEditTitle(note.title);
        setEditBody(note.body);
        setEditColor(note.color || 'default');
    };

    const saveEdit = () => {
        if (!editingId) return;
        setNotes(prev => prev.map(n =>
            n.id === editingId
                ? { ...n, title: editTitle.trim() || 'Untitled', body: editBody.trim(), color: editColor, updatedAt: new Date().toISOString() }
                : n
        ));
        setEditingId(null);
    };

    const togglePin = (id) => {
        setNotes(prev => prev.map(n =>
            n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n
        ));
    };

    const formatDate = (iso) => {
        try {
            return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
        } catch {
            return '';
        }
    };


    return (
        <div className="page-fade space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tighter text-text-primary">Notes</h2>
                    <p className="text-text-secondary text-xs mt-1">
                        Quick notes and ideas — {notes.length} {notes.length === 1 ? 'note' : 'notes'} total.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setFilterPinned(!filterPinned)}
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${filterPinned ? 'bg-amber-400/20 border-amber-400/50 text-amber-500' : 'bg-bg-main border-border-color text-text-secondary hover:text-text-primary'}`}
                        title="Filter Pinned"
                    >
                        <Icon name="pin" size={15} className={filterPinned ? 'fill-amber-500/20' : ''} />
                    </button>
                    <div className="flex-1 sm:flex-initial relative">
                        <input
                            type="text"
                            placeholder="Search notes..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full sm:w-56 h-10 pl-9 pr-3 rounded-xl bg-bg-main border border-border-color text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent transition-colors"
                        />
                        <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                    </div>
                    <Button
                        onClick={() => {
                            if (!user && notes.length >= 2) {
                                setFeatureLockOpen(true);
                            } else {
                                setShowAdd(true);
                            }
                        }}
                        variant="primary"
                        icon="plus"
                    >
                        New Note
                    </Button>
                </div>
            </div>

            {showAdd && (
                <Card className="hover:translate-y-0 hover:shadow-none hover:border-border-color space-y-4" style={{ backgroundColor: NOTE_COLORS.find(c => c.id === newColor)?.colorClass }}>
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">Create Matrix Note</h4>
                        <button onClick={() => { setShowAdd(false); setNewTitle(''); setNewBody(''); setNewColor('default'); }} className="text-text-secondary hover:text-text-primary transition-colors">
                            <Icon name="x" size={16} />
                        </button>
                    </div>
                    <input
                        type="text"
                        placeholder="Node Designation (Title)"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        className="w-full bg-bg-main/50 backdrop-blur-sm border border-border-color p-3.5 rounded-xl text-base font-bold text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent transition-all"
                        autoFocus
                    />
                    <textarea
                        placeholder="Input cognitive data array..."
                        value={newBody}
                        onChange={e => setNewBody(e.target.value)}
                        rows={5}
                        className="w-full bg-bg-main/50 backdrop-blur-sm border border-border-color p-3.5 rounded-xl text-sm leading-relaxed text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent resize-none transition-all"
                    />
                    <div className="flex items-center justify-between border-t border-border-color/50 pt-4">
                        <div className="flex gap-2">
                            {NOTE_COLORS.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setNewColor(c.id)}
                                    className={`w-6 h-6 rounded-full border-2 transition-all ${newColor === c.id ? 'border-accent scale-110' : 'border-border-color hover:scale-105'}`}
                                    style={{ backgroundColor: c.colorClass }}
                                />
                            ))}
                        </div>
                        <Button onClick={addNote} variant="primary" disabled={!newTitle.trim() && !newBody.trim()}>
                            Compile Node
                        </Button>
                    </div>
                </Card>
            )}

            {filtered.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(note => {
                        const noteColorClass = NOTE_COLORS.find(c => c.id === (note.color || 'default'))?.colorClass;
                        return (
                            <Card
                                key={note.id}
                                className={`flex flex-col border border-border-color/60 hover:border-accent/40 hover:-translate-y-1 transition-all group min-h-[160px] ${note.pinned ? 'ring-1 ring-amber-400/30' : ''}`}
                                style={{ backgroundColor: noteColorClass }}
                            >
                                {editingId === note.id ? (
                                    <div className="space-y-3 flex-1 flex flex-col">
                                        <input
                                            type="text"
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            className="w-full bg-bg-main/50 backdrop-blur-sm border border-border-color/80 p-3 rounded-xl text-sm font-bold text-text-primary outline-none focus:border-accent transition-all"
                                            autoFocus
                                        />
                                        <textarea
                                            value={editBody}
                                            onChange={e => setEditBody(e.target.value)}
                                            rows={5}
                                            className="w-full flex-1 bg-bg-main/50 backdrop-blur-sm border border-border-color/80 p-3 rounded-xl text-sm text-text-primary outline-none focus:border-accent resize-none transition-all"
                                        />
                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex gap-1.5">
                                                {NOTE_COLORS.map(c => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => setEditColor(c.id)}
                                                        className={`w-5 h-5 rounded-full border transition-all ${editColor === c.id ? 'border-accent scale-110' : 'border-border-color hover:scale-105'}`}
                                                        style={{ backgroundColor: c.colorClass }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button onClick={() => setEditingId(null)} variant="outline" size="sm">Cancel</Button>
                                                <Button onClick={saveEdit} variant="primary" size="sm">Update</Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <h4 className="text-base font-bold text-text-primary line-clamp-2 leading-tight flex-1">{note.title}</h4>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-bg-main/60 backdrop-blur-md rounded-lg p-0.5 border border-border-color/50 shadow-sm">
                                                <button onClick={() => togglePin(note.id)} className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${note.pinned ? 'text-amber-400 bg-amber-400/10' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}>
                                                    <Icon name="pin" size={14} className={note.pinned ? 'fill-amber-400/30' : ''} />
                                                </button>
                                                <button onClick={() => startEdit(note)} className="w-8 h-8 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors">
                                                    <Icon name="pencil" size={14} />
                                                </button>
                                                <button onClick={() => setDeleteTarget(note.id)} className="w-8 h-8 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors">
                                                    <Icon name="trash" size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        {note.body && (
                                            <div
                                                className="flex-1 mb-4 cursor-pointer group/body"
                                                onClick={() => setExpandedNoteId(note.id)}
                                                title="Click to expand"
                                            >
                                                <p className="text-[13px] text-text-secondary/90 leading-relaxed whitespace-pre-wrap line-clamp-6 group-hover/body:text-text-primary transition-colors">
                                                    {note.body}
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border-color/30">
                                            <p className="text-[10px] font-mono text-text-secondary/60 uppercase tracking-widest">{formatDate(note.updatedAt)}</p>
                                            {note.pinned && <Icon name="pin" size={10} className="text-amber-500/50" />}
                                        </div>
                                    </>
                                )}
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <div className="relative overflow-hidden rounded-2xl border border-border-color bg-card-bg">
                    <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-accent/5 blur-[60px] pointer-events-none" />
                    <div className="flex flex-col items-center justify-center py-20 text-center relative z-10">
                        <div className="w-16 h-16 rounded-2xl bg-accent/8 border border-accent/20 flex items-center justify-center mb-5" style={{ backgroundColor: 'rgba(235,235,235,0.06)' }}>
                            <Icon name={filterPinned ? "pin" : "sticky-note"} size={28} className="text-text-secondary opacity-60" />
                        </div>
                        <p className="text-base font-bold text-text-primary mb-2">
                            {search ? 'No matching notes' : filterPinned ? 'No notes pinned' : 'No notes yet'}
                        </p>
                        <p className="text-xs text-text-secondary max-w-xs mx-auto leading-relaxed">
                            {search ? 'Try a different search term.' : filterPinned ? 'You haven\'t pinned any notes yet.' : 'Capture thoughts, ideas, and reminders. Your first note is just a click away.'}
                        </p>
                        {!search && !filterPinned && (
                            <button
                                onClick={() => {
                                    if (!user && notes.length >= 2) {
                                        setFeatureLockOpen(true);
                                    } else {
                                        setShowAdd(true);
                                    }
                                }}
                                className="mt-6 px-5 py-2.5 bg-accent text-bg-main text-[10px] font-black uppercase tracking-[0.25em] rounded-xl hover:opacity-90 active:scale-95 transition-all"
                            >
                                Write your first note
                            </button>
                        )}
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!deleteTarget}
                title="Delete Note"
                message="Are you sure you want to delete this note?"
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => { if (deleteTarget) { setNotes(prev => prev.filter(n => n.id !== deleteTarget)); setDeleteTarget(null); } }}
                onCancel={() => setDeleteTarget(null)}
            />

            {expandedNoteId && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" onClick={() => setExpandedNoteId(null)}>
                    {notes.filter(n => n.id === expandedNoteId).map(note => (
                        <Card
                            key={note.id}
                            className="w-full max-w-3xl min-h-[50vh] flex flex-col my-auto border-border-color/80 shadow-2xl relative"
                            style={{ backgroundColor: NOTE_COLORS.find(c => c.id === (note.color || 'default'))?.colorClass }}
                            onClick={e => e.stopPropagation()}
                        >
                            <button onClick={() => setExpandedNoteId(null)} className="absolute top-6 right-6 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-black/40 transition-all">
                                <Icon name="x" size={16} />
                            </button>
                            <div className="pr-12">
                                <h2 className="text-3xl font-black tracking-tight text-text-primary mb-6">{note.title}</h2>
                            </div>
                            <div className="flex-1 text-base text-text-secondary/90 leading-relaxed whitespace-pre-wrap font-sans">
                                {note.body}
                            </div>
                            <div className="mt-12 flex items-center justify-between border-t border-border-color/30 pt-6">
                                <p className="text-[11px] font-mono text-text-secondary/50 uppercase tracking-[0.2em]">Compiled on {formatDate(note.createdAt)}</p>
                                <div className="flex items-center gap-2">
                                    <Button onClick={() => { setExpandedNoteId(null); startEdit(note); }} variant="outline" icon="pencil">Edit Configuration</Button>
                                    <Button onClick={() => { setExpandedNoteId(null); setDeleteTarget(note.id); }} variant="outline" className="border-danger/30 text-danger hover:bg-danger/10" icon="trash">Delete</Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <ConfirmModal
                open={featureLockOpen}
                title="Sign in required"
                message="Sign in to create more than 2 notes, unlock secure cloud storage, and sync seamlessly."
                confirmLabel="Sign in"
                variant="primary"
                onConfirm={() => {
                    setFeatureLockOpen(false);
                    window.location.href = '/login';
                }}
                onCancel={() => setFeatureLockOpen(false)}
            />
        </div>
    );
};

export default Notes;
