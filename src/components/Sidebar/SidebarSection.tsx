import { ComponentChildren } from 'preact';

interface SidebarSectionProps {
  title: string;
  icon?: string;
  collapsed: boolean;
  onToggle: () => void;
  itemCount?: number;
  showDot?: boolean;
  children: ComponentChildren;
}

export default function SidebarSection({
  title,
  collapsed,
  onToggle,
  itemCount,
  showDot,
  children,
}: SidebarSectionProps) {
  return (
    <div class="sidebar-section">
      <div class="sidebar-section-header" onClick={onToggle}>
        <svg
          class={`sidebar-section-chevron ${collapsed ? 'collapsed' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        <span class="sidebar-section-title">{title}</span>
        {showDot ? (
          <span class="sidebar-section-dot"></span>
        ) : (
          itemCount !== undefined && itemCount > 0 && (
            <span class="sidebar-section-count">{itemCount}</span>
          )
        )}
      </div>
      {!collapsed && (
        <div class="sidebar-section-content">
          {children}
        </div>
      )}
    </div>
  );
}
