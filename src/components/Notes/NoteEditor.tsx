import { useEffect, useRef, useState } from 'preact/hooks';
import { currentNote, currentNoteId, isPreviewMode, notes, saveNotes } from '@/store/store';

export default function NoteEditor() {
  const note = currentNote.value;
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    if (note) {
      autoResizeTitle();
      autoResizeContent();
      if (isPreviewMode.value) {
        updatePreview();
      }
    }
  }, [note?.id]);

  const autoResizeTitle = () => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
  };

  const autoResizeContent = () => {
    if (contentRef.current) {
      contentRef.current.style.height = 'auto';
      contentRef.current.style.height = contentRef.current.scrollHeight + 'px';
    }
  };

  const handleTitleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    autoResizeTitle();
    if (note) {
      note.title = target.value.trim() || 'Untitled';
      note.updatedAt = Date.now();
      notes.value = [...notes.value];
      saveNotes();
    }
  };

  const handleContentInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    autoResizeContent();
    if (note) {
      note.content = target.value;
      note.updatedAt = Date.now();
      notes.value = [...notes.value];
      saveNotes();
      if (isPreviewMode.value) {
        updatePreview();
      }
    }
  };

  const togglePreview = () => {
    isPreviewMode.value = !isPreviewMode.value;
    if (isPreviewMode.value) {
      updatePreview();
    }
  };

  const updatePreview = () => {
    if (note && typeof window !== 'undefined' && (window as any).marked) {
      setPreviewHtml((window as any).marked.parse(note.content));
    } else if (note) {
      // Fallback: simple line breaks
      setPreviewHtml(note.content.replace(/\n/g, '<br>'));
    }
  };

  const deleteNote = () => {
    if (!note) return;
    if (confirm('Are you sure you want to delete this note?')) {
      notes.value = notes.value.filter(n => n.id !== note.id);
      saveNotes();
      currentNoteId.value = null;
    }
  };

  const copyMarkdown = async () => {
    if (!note) return;
    try {
      await navigator.clipboard.writeText(note.content);
      // TODO: Show toast notification
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleStatus = () => {
    if (note) {
      note.status = note.status === 'draft' ? 'ready' : 'draft';
      note.updatedAt = Date.now();
      notes.value = [...notes.value];
      saveNotes();
    }
  };

  if (!note) {
    return (
      <div class="note-editor-empty">
        <p>Select a note from the sidebar or create a new one.</p>
      </div>
    );
  }

  return (
    <div class="note-editor">
      <div class="note-editor-toolbar">
        <div class="note-actions-group">
          <div class="note-status-toggle">
            <span class="status-label">Draft</span>
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={note.status === 'ready'}
                onChange={toggleStatus}
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="status-label">Ready</span>
          </div>
          <div class="note-actions-divider"></div>
          <button
            class={`icon-btn-small ${isPreviewMode.value ? 'active' : ''}`}
            onClick={togglePreview}
            title="Toggle Preview"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <button class="icon-btn-small" onClick={copyMarkdown} title="Copy Markdown">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="icon-btn-small" onClick={deleteNote} title="Delete Note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </div>
      </div>

      <textarea
        ref={titleRef}
        class="note-title-input"
        placeholder="Untitled"
        value={note.title}
        onInput={handleTitleInput}
        rows={1}
      />

      <div class="editor-container">
        <textarea
          ref={contentRef}
          class={`note-content-input ${isPreviewMode.value ? 'hidden' : ''}`}
          placeholder="Start writing..."
          value={note.content}
          onInput={handleContentInput}
        />
        {isPreviewMode.value && (
          <div
            class="note-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>
    </div>
  );
}
