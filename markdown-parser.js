// Enhanced markdown parser with GitHub-flavored markdown (GFM) support
import { marked } from 'marked';
import hljs from 'highlight.js';

// Configure marked with GFM support
marked.setOptions({
  gfm: true, // Enable GitHub Flavored Markdown
  breaks: true, // Convert \n to <br> (GitHub style)
  headerIds: true, // Add IDs to headers
  mangle: false, // Don't escape email addresses
  sanitize: false, // We'll handle sanitization separately if needed
  smartLists: true, // Use smarter list behavior
  smartypants: false, // Don't use smart typography
  xhtml: false, // Don't use XHTML-style tags
  highlight: function(code, lang) {
    // Syntax highlighting for code blocks
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch (err) {
        console.error('Highlight.js error:', err);
      }
    }
    // Auto-detect language if not specified
    try {
      return hljs.highlightAuto(code).value;
    } catch (err) {
      console.error('Highlight.js auto-detect error:', err);
    }
    return code; // Return plain code if highlighting fails
  },
  langPrefix: 'hljs language-' // CSS class prefix for code blocks
});

// Custom renderer for links to open in new tab
const renderer = new marked.Renderer();
const originalLinkRenderer = renderer.link.bind(renderer);
renderer.link = function(href, title, text) {
  const html = originalLinkRenderer(href, title, text);
  return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
};

// Custom renderer for checkboxes (GitHub-style task lists)
const originalListItemRenderer = renderer.listitem.bind(renderer);
renderer.listitem = function(text, task, checked) {
  if (task) {
    const checkbox = checked ?
      '<input type="checkbox" checked disabled class="task-list-item-checkbox">' :
      '<input type="checkbox" disabled class="task-list-item-checkbox">';
    return `<li class="task-list-item">${checkbox} ${text}</li>`;
  }
  return originalListItemRenderer(text, task, checked);
};

marked.use({ renderer });

// Export the configured marked instance
window.marked = marked;
