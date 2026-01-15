'use client';

import { useState } from 'react';
import { useStaffNotes, useCreateStaffNote, useUpdateStaffNote, useDeleteStaffNote } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import { toast } from 'sonner';
import {
  Send,
  Trash2,
  Info,
  Clock,
  User,
  Loader2,
  StickyNote,
  Edit2,
  X,
  Save,
} from 'lucide-react';

export default function StaffNotesPage() {
  const { staff: currentStaff } = useAuth();
  const { data: notes, isLoading, refetch } = useStaffNotes();
  const createNote = useCreateStaffNote();
  const updateNote = useUpdateStaffNote();
  const deleteNote = useDeleteStaffNote();

  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newNote.trim()) {
      return;
    }

    if (!currentStaff?.id) {
      toast.error('You must be logged in to create notes');
      return;
    }

    setSubmitting(true);
    try {
      await createNote.mutateAsync({
        created_by: currentStaff.id,
        title: 'Note',
        content: newNote.trim(),
        priority: 'normal',
        expires_at: null,
      });
      toast.success('Note added');
      setNewNote('');
      refetch();
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (note: any) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) {
      toast.error('Note content is required');
      return;
    }

    setSaving(true);
    try {
      await updateNote.mutateAsync({
        id,
        updates: {
          content: editContent.trim(),
        },
      });
      toast.success('Note updated');
      setEditingId(null);
      setEditContent('');
      refetch();
    } catch (error) {
      console.error('Failed to update note:', error);
      toast.error('Failed to update note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note?')) return;

    try {
      await deleteNote.mutateAsync(id);
      toast.success('Note deleted');
      refetch();
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <StickyNote className="h-6 w-6 text-amber-600" />
        <h1 className="text-2xl font-bold">Staff Notes</h1>
      </div>

      {/* New Note Input */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a note for your team... (Press Enter to send)"
            className="flex-1 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none bg-white text-sm"
            rows={2}
            disabled={submitting}
          />
          <Button
            onClick={handleCreate}
            disabled={submitting || !newNote.trim()}
            className="self-end"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        {notes?.map((note: any) => {
          const isEditing = editingId === note.id;

          return (
            <div
              key={note.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              {/* Note Content */}
              {isEditing ? (
                <div className="mb-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                    rows={3}
                    autoFocus
                  />
                </div>
              ) : (
                <p className="text-gray-800 whitespace-pre-wrap mb-3">{note.content}</p>
              )}

              {/* Note Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {note.created_by_staff?.full_name || 'Unknown'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(note.created_at)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                        title="Cancel"
                        disabled={saving}
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSaveEdit(note.id)}
                        className="p-1.5 hover:bg-green-50 rounded text-green-500 hover:text-green-600 transition-colors"
                        title="Save"
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(note)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {(!notes || notes.length === 0) && (
        <div className="text-center py-12">
          <Info className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">No notes yet. Write one above to share with your team.</p>
        </div>
      )}
    </div>
  );
}
