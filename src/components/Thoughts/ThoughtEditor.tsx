import { useEffect, useRef, useState } from 'preact/hooks';
import { currentThought, currentThoughtId, currentView, isPreviewMode, thoughts, saveThoughts } from '@/store/store';

export default function ThoughtEditor() {
  const thought = currentThought.value;
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    if (thought) {
      autoResizeTitle();
      autoResizeContent();
      if (isPreviewMode.value) {
        updatePreview();
      }
    }
  }, [thought?.id]);

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
    if (thought) {
      thought.title = target.value.trim() || 'Untitled';
      thought.updatedAt = Date.now();
      thoughts.value = [...thoughts.value];
      saveThoughts();
    }
  };

  const handleContentInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    autoResizeContent();
    if (thought) {
      thought.content = target.value;
      thought.updatedAt = Date.now();
      thoughts.value = [...thoughts.value];
      saveThoughts();
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
    if (thought && typeof window !== 'undefined' && (window as any).marked) {
      setPreviewHtml((window as any).marked.parse(thought.content));
    } else if (thought) {
      // Fallback: simple line breaks
      setPreviewHtml(thought.content.replace(/\n/g, '<br>'));
    }
  };

  const deleteThought = () => {
    if (!thought) return;
    if (confirm('Are you sure you want to delete this thought?')) {
      thoughts.value = thoughts.value.filter(t => t.id !== thought.id);
      saveThoughts();
      currentThoughtId.value = null;
    }
  };

  const copyMarkdown = async () => {
    if (!thought) return;
    try {
      await navigator.clipboard.writeText(thought.content);
      // TODO: Show toast notification
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleStatus = () => {
    if (thought) {
      thought.status = thought.status === 'draft' ? 'ready' : 'draft';
      thought.updatedAt = Date.now();
      thoughts.value = [...thoughts.value];
      saveThoughts();
    }
  };

  const goBack = () => {
    currentView.value = 'thoughts';
  };

  if (!thought) {
    return (
      <div class="thought-editor-empty">
        <p>Select a thought from the sidebar or create a new one.</p>
      </div>
    );
  }

  return (
    <div class="thought-editor">
      <div class="thought-editor-toolbar">
        <button class="thought-back-btn" onClick={goBack} title="Back to thoughts">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div class="thought-actions-group">
          <div class="thought-status-toggle">
            <span class="status-label">Draft</span>
            <label class="toggle-switch">
              <input
                type="checkbox"
                checked={thought.status === 'ready'}
                onChange={toggleStatus}
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="status-label">Ready</span>
          </div>
          <div class="thought-actions-divider"></div>
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
          <button class="icon-btn-small" onClick={deleteThought} title="Delete Thought">
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
        class="thought-title-input"
        placeholder="Untitled"
        value={thought.title}
        onInput={handleTitleInput}
        rows={1}
      />

      <div class="editor-container">
        <textarea
          ref={contentRef}
          class={`thought-content-input ${isPreviewMode.value ? 'hidden' : ''}`}
          placeholder="Start writing..."
          value={thought.content}
          onInput={handleContentInput}
        />
        {isPreviewMode.value && (
          <div
            class="thought-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </div>
    </div>
  );
}
