import { useEffect } from 'preact/hooks';
import { currentView, loadFromStorage, settings } from '@/store/store';
import Sidebar from '@/components/Sidebar/Sidebar';
import GlanceView from '@/components/Glance/GlanceView';
import TodayView from '@/components/Views/TodayView';
import LinearView from '@/components/Linear/LinearView';
import GitHubView from '@/components/GitHub/GitHubView';
import HistoryView from '@/components/History/HistoryView';
import MailView from '@/components/Mail/MailView';
import ThoughtEditor from '@/components/Thoughts/ThoughtEditor';
import ThoughtsView from '@/components/Thoughts/ThoughtsView';
import TasksView from '@/components/Tasks/TasksView';
import ProfileView from '@/components/Profile/ProfileView';
import SettingsView from '@/components/Settings/SettingsView';
import { initAuth } from '@/utils/auth';
import { loadCachedDataDirectly } from '@/utils/dataSync';

export function App() {
  useEffect(() => {
    // Load configuration from localStorage/chrome.storage
    loadFromStorage();

    // Load cached data directly from chrome.storage (fast, no delay)
    // This loads todos, thoughts, calendar, linear, github instantly
    loadCachedDataDirectly();

    // Initialize authentication (handles user session and calendar token)
    // Auth will trigger background refresh of calendar data if needed
    initAuth();

    // Apply theme
    if (settings.value.theme === 'light') {
      document.body.classList.add('light-theme');
    }

    // Apply font style
    if (settings.value.fontStyle === 'handwriting') {
      document.body.classList.add('handwriting-font');
    }

    // Update clock
    const updateClock = () => {
      const now = new Date();
      const timeEl = document.getElementById('timeDisplay');
      const dateEl = document.getElementById('dateDisplay');
      const glanceTimeEl = document.getElementById('glanceTime');
      const glanceDayEl = document.getElementById('glanceDay');

      const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const dateString = now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });

      const dayString = now.toLocaleDateString('en-US', {
        weekday: 'long'
      }).toUpperCase();

      if (timeEl) timeEl.textContent = timeString;
      if (dateEl) dateEl.textContent = dateString;
      if (glanceTimeEl) glanceTimeEl.textContent = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      if (glanceDayEl) glanceDayEl.textContent = dayString;
    };

    updateClock();
    const clockInterval = setInterval(updateClock, 1000);

    return () => {
      clearInterval(clockInterval);
    };
  }, []);

  return (
    <div class="app-container">
      <Sidebar />

      <main class="main-content">
        <div class="main-header">
          <div class="clock-container">
            <div class="time" id="timeDisplay">00:00</div>
            <div class="date" id="dateDisplay">Monday, January 1, 2025</div>
          </div>
          <div class="header-actions">
            {/* Header actions will be added here */}
          </div>
        </div>

        <div class="content-container">
          {currentView.value === 'glance' && <GlanceView />}
          {currentView.value === 'today' && <TodayView />}
          {currentView.value === 'linear' && <LinearView />}
          {currentView.value === 'github' && <GitHubView />}
          {currentView.value === 'history' && <HistoryView />}
          {currentView.value === 'mail' && <MailView />}
          {currentView.value === 'thought' && <ThoughtEditor />}
          {currentView.value === 'thoughts' && <ThoughtsView />}
          {currentView.value === 'tasks' && <TasksView />}
          {currentView.value === 'profile' && <ProfileView />}
          {currentView.value === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  );
}
