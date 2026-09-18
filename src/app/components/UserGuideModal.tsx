import { useState, useMemo } from 'react';
import {
  BookOpen,
  X,
  Search,
  CheckCircle2,
  Users,
  IndianRupee,
  Activity,
  ListChecks,
  Utensils,
  Dumbbell,
  Target,
  Calendar,
  Settings,
  Download,
  Shield,
  Smartphone,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Layers,
  Clock,
  KeyRound,
  FileText,
  AlertCircle,
  HelpCircle,
  Eye,
  Check,
  Maximize2,
} from 'lucide-react';
import { APP_VERSION } from '../version';

export type GuideSectionId =
  | 'overview'
  | 'expenses'
  | 'activities'
  | 'tracking'
  | 'meals'
  | 'workout'
  | 'plans'
  | 'calendar'
  | 'settings'
  | 'pwa';

interface GuideSection {
  id: GuideSectionId;
  title: string;
  shortDesc: string;
  badge: string;
  icon: any;
  color: string;
  screenshot?: string;
  tabTarget?: string;
  highlights: string[];
  steps: { title: string; desc: string }[];
  proTips: string[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'overview',
    title: 'App Overview & Multi-Tenant Architecture',
    shortDesc: 'Learn the core layout, multi-tenant role system, and cloud synchronization.',
    badge: 'Core Foundation',
    icon: Shield,
    color: 'from-blue-600 to-indigo-600',
    highlights: [
      'Multi-Tenant Data Isolation: Each account has private tenant-isolated data.',
      'Role-Based Permissions: Main Admin full control, Sub-Admin edit access, and View-Only read permissions.',
      'Supabase PostgreSQL Cloud Backend: Real-time data persistence across all devices.',
      'Offline PWA Engine: Works smoothly even with intermittent internet connectivity.',
    ],
    steps: [
      {
        title: '1. Role System (Main Admin vs Sub-Users)',
        desc: 'Main Admin has complete authority to manage app settings and create sub-tenant accounts with fine-grained access control.',
      },
      {
        title: '2. Component Permissions Matrix',
        desc: 'Main Admin can assign or restrict specific tabs (Trip Expense, Meals, Habits, etc.) for each sub-user.',
      },
      {
        title: '3. Data Persistence & Real-time Auto-Save',
        desc: 'All changes are automatically debounced and saved to the cloud database with visual status indicators.',
      },
      {
        title: '4. Quick Navigation Bar',
        desc: 'Switch effortlessly between daily activities, meal planning, trip expense tracking, and goal planning.',
      },
    ],
    proTips: [
      'Look for the "Main Admin" or "Sub-Admin" badge next to the app logo to verify your active role.',
      'If you see a yellow "View Only Access Mode" banner, you have read-only permissions for that component.',
    ],
  },
  {
    id: 'expenses',
    title: 'Trip Expense Management',
    shortDesc: 'Track group trip expenditures, custom column splits, and settlement calculations.',
    badge: 'Expense Tracker',
    icon: IndianRupee,
    color: 'from-emerald-600 to-teal-600',
    screenshot: '/guide-assets/trip_expense.png',
    tabTarget: 'expenses',
    highlights: [
      'Multi-Trip Management: Create separate spreadsheets for vacations, road trips, or group events.',
      'Custom Dynamic Columns: Add amount, timing ranges, custom categories, and spender names.',
      'Auto-Split Engine: Calculates equal shares or custom person-by-person payments.',
      'Settlement Summary: Instant "Who owes Whom" automated calculations with zero manual math.',
      'Trip-Level Access Control: Restrict sub-users to only specific allowed trips.',
    ],
    steps: [
      {
        title: '1. Create a New Trip',
        desc: 'Click "+ Add Trip", enter the trip title (e.g., "Goa Vacation 2026"), and select the participating members.',
      },
      {
        title: '2. Customize Table Columns',
        desc: 'Click "+ Column" to add Date, Time Range, Category, Amount, or Spender fields as needed.',
      },
      {
        title: '3. Record Expense Rows',
        desc: 'Type entries into the table row. Pick the spender, total amount, and let TMD compute splits.',
      },
      {
        title: '4. View Settlement Breakdown',
        desc: 'Check the "Show Settlement Breakdown" box to view net balances and payments between members.',
      },
      {
        title: '5. Filter & Manage Spenders',
        desc: 'Use the Spender filter dropdown to inspect individual balances or hide deleted spenders.',
      },
    ],
    proTips: [
      'Click on any Time cell to open the visual range popover (e.g. 10:00 AM - 01:30 PM).',
      'Use the split calculation icon on any amount cell to customize weighted participant distributions.',
    ],
  },
  {
    id: 'activities',
    title: 'Daily Activities & Habit Tracker',
    shortDesc: 'Build consistency with day-by-day habit checkmarks, streaks, and progress tracking.',
    badge: 'Habit Tracker',
    icon: Activity,
    color: 'from-indigo-600 to-violet-600',
    screenshot: '/guide-assets/daily_activities.png',
    tabTarget: 'activities',
    highlights: [
      'Day-by-Day Grid: Visual Mon-Sun weekly grid for tracking custom habits.',
      'Today Progress Ring: Real-time circular percentage ring showing completed daily habits.',
      'Weekly Navigation: Browse past consistency and schedule future habits.',
      'Habit Management: Create, edit titles, and organize your daily routines with ease.',
    ],
    steps: [
      {
        title: '1. Add Daily Habits',
        desc: 'Type a habit name (e.g., "30 Min Exercise", "Drink 3L Water", "Read 10 Pages") into the input box and click Add.',
      },
      {
        title: '2. Check Off Daily Logs',
        desc: 'Click the checkbox corresponding to each day of the week as you complete tasks. TMD saves instantly.',
      },
      {
        title: '3. Navigate Weeks',
        desc: 'Use the left/right week selector arrows to review past performance and keep streaks alive.',
      },
      {
        title: '4. Edit or Delete Habits',
        desc: 'Hover over any habit item to edit the title or remove it when no longer needed.',
      },
    ],
    proTips: [
      'Aim for 100% daily score to keep your consistency wheel green.',
      'All daily checkmarks are instantly synchronized across your phone, tablet, and PC.',
    ],
  },
  {
    id: 'tracking',
    title: 'Tracking Reminders & Schedule Alarms',
    shortDesc: 'Organize periodic reminders, bills, maintenance schedules, and time-based alerts.',
    badge: 'Reminders & Alerts',
    icon: ListChecks,
    color: 'from-rose-600 to-pink-600',
    screenshot: '/guide-assets/tracking_reminders.png',
    tabTarget: 'tracking',
    highlights: [
      'Category Grouping: Categorize reminders into Bills, Health, Car Maintenance, Home, Subscriptions, etc.',
      'Date & Time Alarms: Set precise alert dates and timing triggers.',
      'Active vs Completed Tabs: Easily archive finished reminders while keeping future ones active.',
      'Desktop & Mobile Notifications: Native notification system triggers alerts when due.',
    ],
    steps: [
      {
        title: '1. Create a Category',
        desc: 'Create structured categories (e.g., "Electricity Bill", "Gym Subscription", "Car Service").',
      },
      {
        title: '2. Add Reminder Items',
        desc: 'Add specific reminder items with target date and optional reminder time.',
      },
      {
        title: '3. Mark Completed',
        desc: 'Click the checkmark to mark reminders as done. Completed items move to the history view.',
      },
      {
        title: '4. Receive Notifications',
        desc: 'Ensure notification permissions are enabled in Calendar/Settings to receive device lock-screen alerts.',
      },
    ],
    proTips: [
      'Use categorized tracking for recurring monthly commitments so you never miss a deadline.',
    ],
  },
  {
    id: 'meals',
    title: 'Meal Schedule & Recipe Planner',
    shortDesc: 'Plan weekly nutrition across Breakfast, Lunch, Snacks & Dinner, plus export PDF reports.',
    badge: 'Nutrition & Meals',
    icon: Utensils,
    color: 'from-amber-600 to-orange-600',
    screenshot: '/guide-assets/meal_schedule.png',
    tabTarget: 'meals',
    highlights: [
      'Weekly Meal Matrix: Plan all 7 days for Breakfast, Lunch, Evening Snack, and Dinner.',
      'Cooking Status Tracking: Mark meals as Planned, Cooked, Changed, or Ate Out.',
      'Recipe & Options Bank: Store frequently made meals for instant 1-click selection.',
      'Export PDF Weekly Report: Generate formatted PDF meal schedules with nutrition analytics.',
    ],
    steps: [
      {
        title: '1. Plan Meals for the Week',
        desc: 'Select dishes for each meal slot or pick from your saved custom options library.',
      },
      {
        title: '2. Track Daily Execution',
        desc: 'Update the status tag when you cook the meal, substitute an ingredient, or dine out.',
      },
      {
        title: '3. Manage Options Library',
        desc: 'Add your favourite homemade recipes into the Meal Options bank for quick reuse.',
      },
      {
        title: '4. Export PDF Summary',
        desc: 'Click "Export PDF Report" in the header to download a printable weekly menu card.',
      },
    ],
    proTips: [
      'The PDF export contains a complete weekly summary table perfect for sticking on your kitchen fridge!',
    ],
  },
  {
    id: 'workout',
    title: 'Workout Schedule & Weight Log',
    shortDesc: 'Design workout routines, log sets/reps, and monitor body weight progress over time.',
    badge: 'Fitness & Health',
    icon: Dumbbell,
    color: 'from-cyan-600 to-blue-600',
    screenshot: '/guide-assets/workout_schedule.png',
    tabTarget: 'workout',
    highlights: [
      'Custom Muscle Group Categories: Organize routines for Chest, Back, Legs, Cardio, Yoga, etc.',
      'Exercise Routines: Add exercises with target reps, sets, and rest intervals.',
      'Body Weight Log: Record weight progress with dates to monitor fitness trends.',
      'Routine Checklists: Check off exercises as you complete your workout session.',
    ],
    steps: [
      {
        title: '1. Set Up Workout Days',
        desc: 'Create category cards for Push Day, Pull Day, Leg Day, Cardio, or Rest Days.',
      },
      {
        title: '2. Add Exercise List',
        desc: 'Add specific workouts (e.g. "Bench Press - 4 sets x 10 reps", "Squats - 5 sets x 8 reps").',
      },
      {
        title: '3. Log Body Weight',
        desc: 'Enter your morning body weight in the Weight Tracker module to chart your fitness journey.',
      },
      {
        title: '4. Check Off Sets',
        desc: 'Mark completed exercises during your session for a sense of accomplishment.',
      },
    ],
    proTips: [
      'Keep your workout logs updated so you can track progressive overload week over week.',
    ],
  },
  {
    id: 'plans',
    title: 'Plans & Goals Roadmap',
    shortDesc: 'Structure short-term actionable milestones and long-term life vision boards with checklists.',
    badge: 'Goals & Vision',
    icon: Target,
    color: 'from-purple-600 to-indigo-600',
    screenshot: '/guide-assets/plans_goals.png',
    tabTarget: 'plans',
    highlights: [
      'Short-Term vs Long-Term Categorization: Separate week/month milestones from multi-year visions.',
      '6 Emoji Theme Categories: Goals, Life, Career, Family, Travel, and Finance icons.',
      'Checklist Entries: Add granular tasks with optional deep-dive descriptions.',
      'Progress Bar & Percentages: Real-time completion calculation for each plan card.',
      'Search & Filter: Instantly locate any goal or sub-task across your entire roadmap.',
    ],
    steps: [
      {
        title: '1. Choose Short-Term or Long-Term',
        desc: 'Click "+ Add Short Term Plan" for near-term tasks, or "+ Add Long Term Plan" for career/life visions.',
      },
      {
        title: '2. Choose Title & Icon',
        desc: 'Pick an inspiring emoji from the 6 categorized libraries (Goals, Career, Finance, Travel, etc.).',
      },
      {
        title: '3. Add Step-by-Step Subtasks',
        desc: 'Open the plan card and add subtasks with optional markdown/notes for clear action steps.',
      },
      {
        title: '4. Check Off Progress',
        desc: 'As tasks are completed, the progress ring advances toward 100% completion.',
      },
    ],
    proTips: [
      'Use the filter pills (All, Short Term, Long Term) and Search bar to quickly zero in on active goals.',
      'All plan items automatically synchronize with Supabase cloud database with instant auto-save.',
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar View & Event Notifications',
    shortDesc: 'Visual event scheduler with lock-screen alerts and 2026 Sacred Tithi one-click import.',
    badge: 'Calendar & Scheduler',
    icon: Calendar,
    color: 'from-pink-600 to-rose-600',
    screenshot: '/guide-assets/calendar_view.png',
    tabTarget: 'calendar',
    highlights: [
      'Interactive Month Grid: Full visual calendar with highlighted event days and active date details.',
      'Sacred Tithi One-Click Importer: Automatically load all 2026 Amavasai, Pournami, Pradosham & Sivarathri dates.',
      'Multi-Day Advance Alerts: Preset 1-day before, 2-days before, or 1-week before notification triggers.',
      'Lock-Screen Push Notifications: Native background scheduler delivers alerts at your specified hour.',
    ],
    steps: [
      {
        title: '1. Select a Date',
        desc: 'Click on any date in the monthly calendar to view scheduled events or add a new one.',
      },
      {
        title: '2. Add Custom Event',
        desc: 'Enter event title, icon, category, timing, and alert preferences.',
      },
      {
        title: '3. Import Sacred Tithi Dates',
        desc: 'Click "+ Load 2026 Tithi Events" to automatically populate major auspicious dates for the entire year.',
      },
      {
        title: '4. Enable Native Notifications',
        desc: 'Click "Enable Notifications" to allow browser/device lock-screen reminders.',
      },
    ],
    proTips: [
      'Use the "Send Test Notification" button in Calendar settings to verify that your device sounds/banners work properly.',
    ],
  },
  {
    id: 'settings',
    title: 'Settings, Avatar Personalization & Admin Controls',
    shortDesc: 'Customize tenant avatar, dark/light theme, languages, and manage sub-tenant user accounts.',
    badge: 'System Settings',
    icon: Settings,
    color: 'from-slate-700 to-gray-900',
    screenshot: '/guide-assets/settings_modal.png',
    highlights: [
      'Tenant Avatar Customizer: Choose between initials, custom photo upload, or 80+ curated emojis with background colors.',
      'Theme Selection: Seamless switching between Dark Mode and Light Mode.',
      'Multi-Language Engine: Full interface localization in English, தமிழ் (Tamil), and हिन्दी (Hindi).',
      'Sub-Tenant Creation (Main Admin): Create team/family user accounts with custom credentials.',
      'Granular Permission Matrix: Set Edit vs View-Only access and restrict accessible components and trips.',
      'Security: Change account password with automatic session validation.',
    ],
    steps: [
      {
        title: '1. Account & Avatar Profile',
        desc: 'Go to Settings > Account Info to update your display name and click "Change Avatar" to personalize your avatar.',
      },
      {
        title: '2. Appearance & Language',
        desc: 'Choose your preferred theme (Light/Dark) and switch app language instantly without page reloads.',
      },
      {
        title: '3. Sub-Tenant User Management (Admins)',
        desc: 'In Settings > Sub-Tenant Creation, click "+ Add New User", set username, email, password, and permissions.',
      },
      {
        title: '4. Password Security',
        desc: 'Navigate to Change Password, enter your new password, and confirm.',
      },
    ],
    proTips: [
      'Each sub-tenant user has their own private tenant avatar profile and restricted component permissions.',
    ],
  },
  {
    id: 'pwa',
    title: 'PWA Mobile App Installation & Offline Access',
    shortDesc: 'Install TMD as a native app on iOS, Android, Windows, and Mac with offline support.',
    badge: 'Mobile & Offline',
    icon: Smartphone,
    color: 'from-emerald-700 to-indigo-700',
    highlights: [
      'Installable PWA: Launch Track My Day directly from your phone home screen or desktop taskbar.',
      'Zero App Store Hassle: Install instantly directly from your browser without downloading heavy APKs.',
      'Offline Caching: Access your habits, meal plans, and trips even without an active internet connection.',
      'Fullscreen App Experience: Clean standalone window without browser address bars.',
    ],
    steps: [
      {
        title: '1. Android Installation (Chrome / Edge)',
        desc: 'Click the "Install" button in the header, or tap browser menu (⋮) > "Install app" / "Add to Home screen".',
      },
      {
        title: '2. iOS / iPhone Installation (Safari)',
        desc: 'Tap the Share icon (square with arrow pointing up) > scroll down and tap "Add to Home Screen".',
      },
      {
        title: '3. Desktop Installation (Chrome / Edge / Mac)',
        desc: 'Click the Install icon in the browser address bar or use the TMD header "Install" button.',
      },
      {
        title: '4. Offline Capability',
        desc: 'The app automatically caches UI assets and data for offline access.',
      },
    ],
    proTips: [
      'Installing TMD as a PWA enables lock-screen notifications and provides a fluid, app-like experience!',
    ],
  },
];

interface UserGuideModalProps {
  onClose: () => void;
  onNavigateTab?: (tabId: string) => void;
  initialSection?: GuideSectionId;
}

export default function UserGuideModal({
  onClose,
  onNavigateTab,
  initialSection = 'overview',
}: UserGuideModalProps) {
  const [activeSectionId, setActiveSectionId] = useState<GuideSectionId>(initialSection);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return GUIDE_SECTIONS;
    const q = searchQuery.toLowerCase();
    return GUIDE_SECTIONS.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.shortDesc.toLowerCase().includes(q) ||
        sec.highlights.some((h) => h.toLowerCase().includes(q)) ||
        sec.steps.some((s) => s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)) ||
        sec.proTips.some((p) => p.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const activeSection = useMemo(() => {
    return (
      GUIDE_SECTIONS.find((sec) => sec.id === activeSectionId) ||
      filteredSections[0] ||
      GUIDE_SECTIONS[0]
    );
  }, [activeSectionId, filteredSections]);

  const currentIndex = GUIDE_SECTIONS.findIndex((s) => s.id === activeSection.id);
  const prevSection = currentIndex > 0 ? GUIDE_SECTIONS[currentIndex - 1] : null;
  const nextSection = currentIndex < GUIDE_SECTIONS.length - 1 ? GUIDE_SECTIONS[currentIndex + 1] : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-200 dark:border-gray-700 w-full max-w-5xl h-screen sm:h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-gray-900 dark:text-gray-100 text-base sm:text-lg tracking-tight">
                  Track My Day — User Guide &amp; Assist
                </h2>
                <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Complete walkthrough, features documentation, and screenshots for every component
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white cursor-pointer"
              title="Close Guide"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main 2-Column Layout */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Left Sidebar Navigation */}
          <div className="w-full md:w-72 border-r border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 flex flex-col flex-shrink-0">
            {/* Search Box */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search features, guides..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Section List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 py-1">
                Components &amp; Topics ({filteredSections.length})
              </p>
              {filteredSections.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection.id === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-200 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold truncate leading-tight">{sec.title}</span>
                      </div>
                      <p
                        className={`text-[10px] truncate mt-0.5 ${
                          isActive ? 'text-indigo-100' : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {sec.badge}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Sidebar Footer Version Info */}
            <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 flex items-center justify-between text-[11px] text-gray-400">
              <span className="font-semibold">Track My Day</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">v{APP_VERSION}</span>
            </div>
          </div>

          {/* Right Main Content Details */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-7 bg-white dark:bg-gray-900 space-y-6">
            {/* Topic Header Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-pink-50/50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-800 border border-indigo-100/80 dark:border-gray-700 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 flex-shrink-0">
                    <activeSection.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        {activeSection.badge}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight mt-0.5">
                      {activeSection.title}
                    </h3>
                  </div>
                </div>

                {activeSection.tabTarget && onNavigateTab && (
                  <button
                    onClick={() => {
                      onNavigateTab(activeSection.tabTarget!);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs self-start sm:self-auto cursor-pointer"
                  >
                    <span>Open This Feature</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-2.5 leading-relaxed">
                {activeSection.shortDesc}
              </p>
            </div>

            {/* Respective Component Screenshot Card */}
            {activeSection.screenshot && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Component Visual Interface</span>
                  </h4>
                  <span className="text-[10px] text-gray-400">Click image to enlarge</span>
                </div>
                <div
                  onClick={() => setPreviewImage(activeSection.screenshot!)}
                  className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-md bg-gray-950/5 dark:bg-gray-950/40 group relative cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-all"
                >
                  <img
                    src={activeSection.screenshot}
                    alt={activeSection.title}
                    className="w-full h-auto max-h-72 object-cover object-top group-hover:scale-[1.01] transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-2">
                    <Maximize2 className="w-4 h-4" />
                    <span>View Full Size</span>
                  </div>
                </div>
              </div>
            )}

            {/* Key Capabilities / Highlights */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Key Features &amp; Capabilities</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeSection.highlights.map((highlight, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200/70 dark:border-gray-700/80 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-700 dark:text-gray-200 leading-normal">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* How to Use Step-by-Step Guide */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Step-by-Step Usage Guide</span>
              </h4>
              <div className="space-y-2.5">
                {activeSection.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-2xs flex items-start gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-bold text-gray-900 dark:text-gray-100">{step.title}</h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro Tips Section */}
            {activeSection.proTips && activeSection.proTips.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Pro Tips &amp; Best Practices</span>
                </div>
                <ul className="space-y-1.5 pl-6 list-disc text-xs text-amber-800 dark:text-amber-300/90">
                  {activeSection.proTips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Navigation Footer (Prev / Next Section) */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
              {prevSection ? (
                <button
                  onClick={() => setActiveSectionId(prevSection.id)}
                  className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>← {prevSection.title}</span>
                </button>
              ) : (
                <div />
              )}

              {nextSection && (
                <button
                  onClick={() => setActiveSectionId(nextSection.id)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Next: {nextSection.title} →</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Screenshot Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[10000] bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/20 shadow-2xl">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewImage} alt="Enlarged visual" className="max-w-full max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
