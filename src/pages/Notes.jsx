import { useState, useMemo } from 'react';
import Icon from '../components/Icon';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/Modals';

const Notes = ({ notes, setNotes }) => {
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

    return (
        <div className="page-fade space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tighter text-text-primary">Notes</h2>
                    <p className="text-text-secondary text-xs mt-1">Quick notes and reminders to keep in mind.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-initial relative">
                        <input
                            type="text"
                            placeholder="Search notes..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full sm:w-56 h-10 pl-9 pr-3 rounded-xl bg-bg-main border border-border-color text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent transition-colors"
                        />
                        <Icon name="filter" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                    </div>
                    <Button
                        onClick={() => setShowAdd(true)}
                        variant="primary"
                        icon="plus"
                    >
                        New Note
                    </Button>
                </div>
            </div>

            {showAdd && (
                <Card className="hover:translate-y-0 hover:shadow-none hover:border-border-color space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">New Note</h4>
                        <button onClick={() => { setShowAdd(false); setNewTitle(''); setNewBody(''); }} className="text-text-secondary hover:text-text-primary">
                            <Icon name="x" size={16} />
                        </button>
                    </div>
                    <input
                        type="text"
                        placeholder="Title"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent"
                        autoFocus
                    />
                    <textarea
                        placeholder="Write your note..."
                        value={newBody}
                        onChange={e => setNewBody(e.target.value)}
                        rows={4}
                        className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent resize-none"
                    />
                    <div className="flex justify-end">
                        <Button onClick={addNote} variant="primary" disabled={!newTitle.trim() && !newBody.trim()}>
                            Save Note
                        </Button>
                    </div>
                </Card>
            )}

            {filtered.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(note => (
                        <Card key={note.id} className="flex flex-col hover:translate-y-0 hover:shadow-none hover:border-border-color group">
                            {editingId === note.id ? (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        className="w-full bg-bg-main border border-border-color p-2.5 rounded-xl text-sm text-text-primary outline-none focus:border-accent"
                                        autoFocus
                                    />
                                    <textarea
                                        value={editBody}
                                        onChange={e => setEditBody(e.target.value)}
                                        rows={4}
                                        className="w-full bg-bg-main border border-border-color p-2.5 rounded-xl text-sm text-text-primary outline-none focus:border-accent resize-none"
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <Button onClick={() => setEditingId(null)} variant="outline" size="sm">Cancel</Button>
                                        <Button onClick={saveEdit} variant="primary" size="sm">Save</Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h4 className="text-sm font-bold text-text-primary truncate flex-1">{note.title}</h4>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <button onClick={() => startEdit(note)} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-accent-dim">
                                                <Icon name="pencil" size={13} />
                                            </button>
                                            <button onClick={() => setDeleteTarget(note.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/10">
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    {note.body && (
                                        <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap flex-1 mb-3">{note.body}</p>
                                    )}
                                    <p className="text-[9px] font-mono text-text-secondary/60 uppercase tracking-wider mt-auto">{formatDate(note.updatedAt)}</p>
                                </>
                            )}
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="hover:translate-y-0 hover:shadow-none hover:border-border-color">
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Icon name="file-text" size={40} className="text-text-secondary opacity-50 mb-4" />
                        <p className="text-sm text-text-secondary uppercase tracking-widest">
                            {search ? 'No matching notes' : 'No notes yet'}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                            {search ? 'Try a different search term.' : 'Create a note to remember something for later.'}
                        </p>
                    </div>
                </Card>
            )}

            <ConfirmModal
                open={!!deleteTarget}
                title="Delete note"
                message="Are you sure you want to delete this note? This cannot be undone."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => { if (deleteTarget) { setNotes(prev => prev.filter(n => n.id !== deleteTarget)); setDeleteTarget(null); } }}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
};

export default Notes;
