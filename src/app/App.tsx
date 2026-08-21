import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Calendar,
  Activity,
  Utensils,
  Dumbbell,
  DollarSign,
  Users,
  Pencil,
  X,
  Camera,
  Smile,
  Type,
  ListChecks,
  LogOut,
  Loader2,
  Download,
  Settings,
  Sun,
  Moon,
  Globe,
  UserPlus,
  Trash2,
  Edit2,
  CheckSquare,
  Square,
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import DailyActivities from './components/DailyActivities';
import MealSchedule from './components/MealSchedule';
import WorkoutSchedule from './components/WorkoutSchedule';
import Expenditure from './components/Expenditure';
import CalendarView from './components/CalendarView';
import Tracking from './components/Tracking';
import AuthPage from './components/AuthPage';
import PWAWrapper from './components/PWAWrapper';
import { useAuth, AppUserRecord, AppUserProfile } from './hooks/useAuth';
import { useSupabasePersistedState } from './hooks/useSupabasePersistedState';
import { usePWA } from './hooks/usePWA';
import { Language, t } from './utils/translations';
import { startNotificationScheduler, stopNotificationScheduler } from './utils/notificationScheduler';
import { supabase } from '../lib/supabaseClient';

type Tab = 'activities' | 'meals' | 'workout' | 'expenses' | 'calendar' | 'tracking';
type Person = 'partner1' | 'partner2' | 'both';
type AvatarType = 'letter' | 'emoji' | 'photo';
type ThemeMode = 'light' | 'dark';

export interface TrackingReminder {
  id: string;
  categoryName: string;
  title: string;
  date: string;
  time: string;
  person: Person;
  completed: boolean;
}

interface PartnerProfile {
  name: string;
  avatarType: AvatarType;
  photo?: string;
  emoji?: string;
  letter: string;
  bgColor: string;
}

const BG_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f43f5e',
  '#f97316','#eab308','#22c55e','#14b8a6',
  '#3b82f6','#06b6d4','#64748b','#78716c',
];

const EMOJI_CATEGORIES = {
  'Reactions': ['😀','😊','🥰','😍','🤩','😎','🥳','😇','🤗','😄','😁','🤣','😂','🙂','🤭','😘','😗','😙','😚','💪','👍','🙌','👏','🫶','❤️','🧡','💛','💚','💙','💜'],
  'Flowers': ['🌸','🌺','🌻','🌹','🌷','💐','🌼','🌿','🍀','🌱','🪷','🌾','🍁','🍂','🍃','🌴','🌵','🎋','🌲','🌳','🎍','🪻','🪸','🫧','✨','🌟','⭐','🌙','☀️','🌈'],
  'Animals': ['🐱','🐶','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🦄','🐸','🐵','🦋','🦜','🐙','🦒','ZE','🦧','🐘','🦛','🦏','🐬','🐳','🦭','🦅','🦆','🦉'],
};

const DEFAULT_PARTNER1: PartnerProfile = { name: 'Partner 1', avatarType: 'letter', letter: 'P', bgColor: '#6366f1' };
const DEFAULT_PARTNER2: PartnerProfile = { name: 'Partner 2', avatarType: 'letter', letter: 'P', bgColor: '#ec4899' };

interface AppConfig {
  partner1: PartnerProfile;
  partner2: PartnerProfile;
  activePerson: Person;
  activeTab: Tab;
}

const DEFAULT_CONFIG: AppConfig = {
  partner1: DEFAULT_PARTNER1,
  partner2: DEFAULT_PARTNER2,
  activePerson: 'partner1',
  activeTab: 'activities',
};

const COMPONENT_OPTIONS: { id: Tab; label: string }[] = [
  { id: 'expenses', label: 'Trip Expense' },
  { id: 'activities', label: 'Daily Activities' },
  { id: 'tracking', label: 'Tracking Reminders' },
  { id: 'meals', label: 'Meal Schedule' },
  { id: 'workout', label: 'Workout Schedule' },
  { id: 'calendar', label: 'Calendar View' },
];

// ── Avatar display ────────────────────────────────────────────────────────────
function Avatar({ profile, size = 'md' }: { profile: PartnerProfile; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'lg' ? 'w-14 h-14 text-2xl' : 'w-11 h-11 text-lg';
  if (profile.avatarType === 'photo' && profile.photo) {
    return <img src={profile.photo} alt={profile.name} className={`${dim} rounded-full object-cover ring-2 ring-white`} />;
  }
  return (
    <div className={`${dim} rounded-full flex items-center justify-center ring-2 ring-white font-bold select-none`} style={{ backgroundColor: profile.bgColor }}>
      <span className="text-white leading-none">
        {profile.avatarType === 'emoji' ? profile.emoji : profile.letter.toUpperCase().charAt(0) || '?'}
      </span>
    </div>
  );
}

// ── Settings Modal with User Management & Trip Control for Main Admin ──────────
function SettingsModal({
  theme,
  onThemeChange,
  lang,
  onLangChange,
  userProfile,
  fetchAppUsers,
  createAppUser,
  updateAppUser,
  deleteAppUser,
  onClose,
}: {
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  lang: Language;
  onLangChange: (l: Language) => void;
  userProfile: AppUserProfile | null;
  fetchAppUsers: () => Promise<AppUserRecord[]>;
  createAppUser: (newUser: Omit<AppUserRecord, 'id'>) => Promise<{ success: boolean; error?: string }>;
  updateAppUser: (id: string, updates: Partial<AppUserRecord>) => Promise<{ success: boolean; error?: string }>;
  deleteAppUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}) {
  const isMainAdmin = userProfile?.isMainAdmin || false;
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'users'>('general');

  // User Management State
  const [usersList, setUsersList] = useState<AppUserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Available Trips fetched from database
  const [availableTrips, setAvailableTrips] = useState<{ id: string; title: string }[]>([]);

  // New User Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accessLevel, setAccessLevel] = useState<'edit' | 'view_only'>('edit');
  const [allowedComponents, setAllowedComponents] = useState<string[]>(['expenses']);
  const [allowedTripIds, setAllowedTripIds] = useState<string[]>(['*']);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const languages: { id: Language; label: string; flag: string }[] = [
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
    { id: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  ];

  const loadUsers = useCallback(async () => {
    if (!isMainAdmin) return;
    setLoadingUsers(true);
    const data = await fetchAppUsers();
    setUsersList(data);
    setLoadingUsers(false);
  }, [isMainAdmin, fetchAppUsers]);

  const loadTrips = useCallback(async () => {
    if (!isMainAdmin) return;
    try {
      const { data } = await supabase
        .from('user_data')
        .select('data_value')
        .eq('data_key', 'trip_expenses');

      if (data && data.length > 0) {
        const allTrips: { id: string; title: string }[] = [];
        data.forEach((row: any) => {
          if (row.data_value && Array.isArray(row.data_value.trips)) {
            row.data_value.trips.forEach((t: any) => {
              if (t && (t.id || t.title)) {
                const tripId = t.id || t.title;
                const tripTitle = t.title || 'Untitled Trip';
                if (!allTrips.some((existing) => existing.id === tripId || existing.title === tripTitle)) {
                  allTrips.push({ id: tripId, title: tripTitle });
                }
              }
            });
          }
        });
        setAvailableTrips(allTrips);
      }
    } catch (err) {
      console.error('Failed to load trips for user management:', err);
    }
  }, [isMainAdmin]);

  useEffect(() => {
    if (activeSettingsTab === 'users') {
      loadUsers();
      loadTrips();
    }
  }, [activeSettingsTab, loadUsers, loadTrips]);

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setName('');
    setPassword('');
    setShowPassword(false);
    setAccessLevel('edit');
    setAllowedComponents(['expenses']);
    setAllowedTripIds(['*']);
    setFormError(null);
    setFormSuccess(null);
    setShowAddForm(false);
    setEditingUserId(null);
  };

  const handleToggleComponent = (compId: string) => {
    setAllowedComponents((prev) =>
      prev.includes(compId) ? prev.filter((c) => c !== compId) : [...prev, compId]
    );
  };

  const handleToggleTrip = (tripId: string) => {
    if (tripId === '*') {
      setAllowedTripIds(['*']);
      return;
    }
    setAllowedTripIds((prev) => {
      const filtered = prev.filter((id) => id !== '*');
      if (filtered.includes(tripId)) {
        const next = filtered.filter((id) => id !== tripId);
        return next.length === 0 ? ['*'] : next;
      } else {
        return [...filtered, tripId];
      }
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!username.trim()) { setFormError('Please enter a username.'); return; }
    if (!email.trim()) { setFormError('Please enter an email.'); return; }
    if (!name.trim()) { setFormError('Please enter a name.'); return; }
    if (!password || password.length < 4) { setFormError('Password must be at least 4 characters.'); return; }
    if (allowedComponents.length === 0) { setFormError('Select at least one allowed component.'); return; }

    setSubmitting(true);
    try {
      if (editingUserId) {
        // Update existing user
        const res = await updateAppUser(editingUserId, {
          username: username.trim(),
          email: email.trim(),
          name: name.trim(),
          password,
          access_level: accessLevel,
          allowed_components: allowedComponents,
          allowed_trip_ids: allowedTripIds,
        });
        if (!res.success) {
          setFormError(res.error || 'Failed to update user.');
        } else {
          setFormSuccess('User updated successfully!');
          resetForm();
          loadUsers();
        }
      } else {
        // Create new user
        const res = await createAppUser({
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          name: name.trim(),
          password,
          role: 'subadmin',
          access_level: accessLevel,
          allowed_components: allowedComponents,
          allowed_trip_ids: allowedTripIds,
        });
        if (!res.success) {
          setFormError(res.error || 'Failed to create user. Username/email might already exist.');
        } else {
          setFormSuccess('Sub-Admin / Trip User created successfully!');
          resetForm();
          loadUsers();
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startEditUser = (user: AppUserRecord) => {
    setEditingUserId(user.id);
    setUsername(user.username);
    setEmail(user.email);
    setName(user.name);
    setPassword(user.password || '');
    setAccessLevel((user.access_level as 'edit' | 'view_only') || 'edit');
    setAllowedComponents(Array.isArray(user.allowed_components) ? user.allowed_components : ['expenses']);
    setAllowedTripIds(Array.isArray(user.allowed_trip_ids) && user.allowed_trip_ids.length > 0 ? user.allowed_trip_ids : ['*']);
    setShowAddForm(true);
    setFormError(null);
    setFormSuccess(null);
  };

  const handleDeleteUser = async (user: AppUserRecord) => {
    if (!window.confirm(`Are you sure you want to remove user "${user.name}" (${user.username})? They will no longer be allowed to log in.`)) {
      return;
    }
    const res = await deleteAppUser(user.id);
    if (res.success) {
      loadUsers();
    } else {
      alert(`Error deleting user: ${res.error}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-bold text-gray-900 dark:text-gray-100">{t('settingsTitle', lang)}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Tab switch for Main Admin */}
        {isMainAdmin && (
          <div className="flex border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 px-5 pt-2 flex-shrink-0">
            <button
              onClick={() => setActiveSettingsTab('general')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 ${
                activeSettingsTab === 'general'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              General Settings
            </button>
            <button
              onClick={() => setActiveSettingsTab('users')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeSettingsTab === 'users'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Management</span>
              <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                Admin
              </span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {activeSettingsTab === 'general' ? (
            <>
              {/* Language Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{t('languageSelection', lang)}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {languages.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => onLangChange(l.id)}
                      className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border-2 transition-all ${
                        lang === l.id
                          ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold shadow-2xs'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <span className="text-xl">{l.flag}</span>
                      <span className="text-xs font-semibold">{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Switcher */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5">
                  {t('appearanceTheme', lang)}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onThemeChange('light')}
                    className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border-2 transition-all ${
                      theme === 'light'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 font-bold shadow-xs'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <Sun className="w-5 h-5 text-amber-500" />
                    <span className="text-xs">{t('lightMode', lang)}</span>
                    {theme === 'light' && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full">{t('active', lang)}</span>}
                  </button>

                  <button
                    onClick={() => onThemeChange('dark')}
                    className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border-2 transition-all ${
                      theme === 'dark'
                        ? 'border-indigo-500 bg-gray-900 text-indigo-400 font-bold shadow-xs'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <Moon className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs">{t('darkMode', lang)}</span>
                    {theme === 'dark' && <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full">{t('active', lang)}</span>}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* User Management Tab for Main Admin */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Sub-Admins & Trip Users</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Manage user credentials, component access, trip access & permissions</p>
                </div>
                {!showAddForm && (
                  <button
                    onClick={() => { resetForm(); setShowAddForm(true); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create User</span>
                  </button>
                )}
              </div>

              {/* Form Alert Messages */}
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-3 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Add / Edit Form */}
              {showAddForm && (
                <form onSubmit={handleCreateUser} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                    <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {editingUserId ? 'Edit Sub-Admin / Trip User' : 'Create New Sub-Admin / Trip User'}
                    </h4>
                    <button type="button" onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">Username</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. tripuser1"
                        required
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                        required
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alex Smith"
                        required
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={4}
                          className="w-full pl-2.5 pr-8 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Access Level Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1.5">
                      Access Permission Level:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAccessLevel('edit')}
                        className={`p-2 rounded-lg border text-left text-xs transition-colors flex items-center gap-2 ${
                          accessLevel === 'edit'
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <Pencil className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-xs">Edit Access</div>
                          <div className="text-[9px] text-gray-400">Can view, add, edit & delete</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAccessLevel('view_only')}
                        className={`p-2 rounded-lg border text-left text-xs transition-colors flex items-center gap-2 ${
                          accessLevel === 'view_only'
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-xs">View Only</div>
                          <div className="text-[9px] text-gray-400">Read-only, editing disabled</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Component Access Checkboxes */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1.5">
                      Allowed Component Access:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {COMPONENT_OPTIONS.map((comp) => {
                        const isSelected = allowedComponents.includes(comp.id);
                        return (
                          <button
                            key={comp.id}
                            type="button"
                            onClick={() => handleToggleComponent(comp.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            )}
                            <span className="truncate">{comp.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Specific Trip Expenses Selection */}
                  {allowedComponents.includes('expenses') && (
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                        <span>Assigned Trip Expenses:</span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">Control which trips user can see</span>
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleTrip('*')}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                            allowedTripIds.includes('*')
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {allowedTripIds.includes('*') ? (
                            <CheckSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="truncate font-semibold">All Trips (*)</span>
                        </button>

                        {availableTrips.map((t) => {
                          const isSelected = !allowedTripIds.includes('*') && allowedTripIds.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleToggleTrip(t.id)}
                              className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                              }`}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              )}
                              <span className="truncate">{t.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-60"
                    >
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{editingUserId ? 'Save Changes' : 'Create User'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Users List */}
              {loadingUsers ? (
                <div className="flex justify-center py-6 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
              ) : usersList.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  <Users className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">No sub-admin or trip users created yet.</p>
                  <button
                    onClick={() => { resetForm(); setShowAddForm(true); }}
                    className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                  >
                    + Add your first user
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {usersList.map((u) => {
                    const isViewOnly = u.access_level === 'view_only';
                    return (
                      <div
                        key={u.id}
                        className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-xs">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{u.name}</span>
                                <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.2 rounded-full font-mono">
                                  @{u.username}
                                </span>
                                {isViewOnly ? (
                                  <span className="text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5">
                                    <Eye className="w-2.5 h-2.5" /> View Only
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5">
                                    <Pencil className="w-2.5 h-2.5" /> Edit Access
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400 dark:text-gray-400">{u.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditUser(u)}
                              title="Edit User & Permissions"
                              className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              title="Delete User"
                              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Allowed Components & Trips Badges */}
                        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-gray-50 dark:border-gray-700/60">
                          <span className="text-[10px] text-gray-400 font-medium">Access:</span>
                          {Array.isArray(u.allowed_components) && u.allowed_components.length > 0 ? (
                            u.allowed_components.map((c) => {
                              const compLabel = COMPONENT_OPTIONS.find((opt) => opt.id === c)?.label || c;
                              return (
                                <span
                                  key={c}
                                  className="text-[9px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.2 rounded-md font-medium"
                                >
                                  {compLabel}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[9px] text-red-500 italic">No components assigned</span>
                          )}

                          {/* Assigned Trips Badge */}
                          <span className="text-[10px] text-gray-400 font-medium ml-1">Trips:</span>
                          {!u.allowed_trip_ids || u.allowed_trip_ids.includes('*') ? (
                            <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded-md font-medium">
                              All Trips (*)
                            </span>
                          ) : (
                            u.allowed_trip_ids.map((tid) => {
                              const tripObj = availableTrips.find((at) => at.id === tid);
                              return (
                                <span
                                  key={tid}
                                  className="text-[9px] bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-1.5 py-0.2 rounded-md font-medium"
                                >
                                  {tripObj?.title || tid}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-2 flex-shrink-0 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-xs transition-colors"
          >
            {t('done', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Avatar picker modal ───────────────────────────────────────────────────────
function AvatarPickerModal({ profile, onSave, onClose }: { profile: PartnerProfile; onSave: (p: PartnerProfile) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<PartnerProfile>({ ...profile });
  const [tab, setTab] = useState<AvatarType>(profile.avatarType);
  const [emojiCat, setEmojiCat] = useState<keyof typeof EMOJI_CATEGORIES>('Reactions');
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<PartnerProfile>) => setDraft((d) => ({ ...d, ...patch }));

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { set({ photo: ev.target?.result as string, avatarType: 'photo' }); setTab('photo'); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Edit Profile</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="flex items-center gap-4">
            <Avatar profile={{ ...draft, avatarType: tab }} size="lg" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
              <input type="text" value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={20}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-900 dark:text-white" />
            </div>
          </div>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {([['photo', Camera, 'Photo'], ['emoji', Smile, 'Emoji'], ['letter', Type, 'Letter']] as const).map(([t, Icon, label]) => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
          {tab === 'photo' && (
            <div className="space-y-3">
              <button onClick={() => fileRef.current?.click()} className="w-full py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                <Camera className="w-8 h-8" /><span className="text-sm font-medium">Upload photo</span><span className="text-xs text-gray-400">JPG or PNG</span>
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhoto} />
              {draft.photo && <div className="flex items-center gap-3"><img src={draft.photo} alt="preview" className="w-12 h-12 rounded-full object-cover" /><button onClick={() => set({ photo: undefined })} className="text-xs text-red-500 hover:text-red-700">Remove photo</button></div>}
            </div>
          )}
          {tab === 'emoji' && (
            <div className="space-y-3">
              <div className="flex gap-1">
                {(Object.keys(EMOJI_CATEGORIES) as Array<keyof typeof EMOJI_CATEGORIES>).map((cat) => (
                  <button key={cat} onClick={() => setEmojiCat(cat)} className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${emojiCat === cat ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 font-medium' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{cat}</button>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
                {EMOJI_CATEGORIES[emojiCat].map((em) => (
                  <button key={em} onClick={() => set({ emoji: em })} className={`text-xl py-1.5 rounded-lg transition-colors ${draft.emoji === em ? 'bg-indigo-100 dark:bg-indigo-900 ring-2 ring-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>{em}</button>
                ))}
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Background color</p>
                <div className="flex flex-wrap gap-2">
                  {BG_COLORS.map((c) => <button key={c} onClick={() => set({ bgColor: c })} style={{ backgroundColor: c }} className={`w-6 h-6 rounded-full transition-transform ${draft.bgColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`} />)}
                </div>
              </div>
            </div>
          )}
          {tab === 'letter' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Single letter</label>
                <input type="text" value={draft.letter} maxLength={1} onChange={(e) => set({ letter: e.target.value })} placeholder="A"
                  className="w-20 text-center text-3xl font-bold px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-900 dark:text-white" style={{ color: draft.bgColor }} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Background color</p>
                <div className="flex flex-wrap gap-2">
                  {BG_COLORS.map((c) => <button key={c} onClick={() => set({ bgColor: c })} style={{ backgroundColor: c }} className={`w-6 h-6 rounded-full transition-transform ${draft.bgColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`} />)}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 pb-5">
          <button onClick={() => { onSave({ ...draft, avatarType: tab }); onClose(); }} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors">
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Partner selector button ───────────────────────────────────────────────────
function PartnerButton({ profile, active, onSelect, onEdit }: { profile: PartnerProfile; active: boolean; onSelect: () => void; onEdit: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative group">
        <button onClick={onSelect} className={`rounded-full transition-all ${active ? 'ring-[3px] ring-indigo-500 ring-offset-2' : 'ring-2 ring-transparent hover:ring-gray-300 ring-offset-1'}`}>
          <Avatar profile={profile} size="md" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-50 dark:hover:bg-gray-700">
          <Pencil className="w-2.5 h-2.5 text-gray-600 dark:text-gray-300" />
        </button>
      </div>
      <span className={`text-[10px] font-medium truncate max-w-[52px] text-center ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>{profile.name}</span>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const {
    userProfile,
    accessToken,
    loading: authLoading,
    error: authError,
    login,
    signup,
    logout,
    resetPassword,
    clearError,
    fetchAppUsers,
    createAppUser,
    updateAppUser,
    deleteAppUser,
  } = useAuth();

  const { isInstallable, promptInstall } = usePWA();

  const [config, setConfig, saveConfig] = useSupabasePersistedState<AppConfig>('app_config', DEFAULT_CONFIG, DEFAULT_CONFIG, accessToken);
  const [trackingReminders, setTrackingReminders, saveTracking] = useSupabasePersistedState<TrackingReminder[]>('tracking_reminders', [], [], accessToken);
  const [editingPartner, setEditingPartner] = useState<'partner1' | 'partner2' | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Theme State ('light' | 'dark')
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('tmd_theme') as ThemeMode) || 'light';
  });

  // Language State ('en' | 'ta' | 'hi')
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('tmd_language') as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('tmd_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('tmd_language', lang);
  }, [lang]);

  // Start background notification scheduler engine
  useEffect(() => {
    startNotificationScheduler();
    return () => {
      stopNotificationScheduler();
    };
  }, []);

  // Unsaved-changes guard
  const [pendingTab, setPendingTab] = useState<Tab | null>(null);
  const currentSaveFnRef = useRef<(() => void) | null>(null);
  const [currentTabHasUnsaved, setCurrentTabHasUnsaved] = useState(false);

  const handleUnsavedChanges = useCallback((hasChanges: boolean, saveFn: () => void) => {
    setCurrentTabHasUnsaved(hasChanges);
    if (hasChanges) currentSaveFnRef.current = saveFn;
    else currentSaveFnRef.current = null;
  }, []);

  const { partner1, activeTab } = config;
  const activePerson = 'partner1' as Person;

  const setPartner1 = (p: PartnerProfile) => {
    setConfig((s) => ({ ...s, partner1: p }));
    setTimeout(saveConfig, 0);
  };
  const commitTabChange = (t: Tab) => {
    setCurrentTabHasUnsaved(false);
    currentSaveFnRef.current = null;
    setConfig((s) => ({ ...s, activeTab: t }));
    setTimeout(saveConfig, 0);
  };

  const setActiveTab = (t: Tab) => {
    if (currentTabHasUnsaved && t !== config.activeTab) {
      setPendingTab(t);
    } else {
      commitTabChange(t);
    }
  };

  const addTrackingReminder = (reminder: Omit<TrackingReminder, 'id' | 'completed'>) => {
    setTrackingReminders((prev) => [...prev, { ...reminder, id: Date.now().toString(), completed: false }]);
    setTimeout(saveTracking, 0);
  };

  const updateTrackingReminders = (reminders: TrackingReminder[] | ((prev: TrackingReminder[]) => TrackingReminder[])) => {
    setTrackingReminders(reminders);
    setTimeout(saveTracking, 0);
  };

  const allTabs = [
    { id: 'activities' as Tab, label: t('activities', lang), icon: Activity },
    { id: 'tracking' as Tab, label: t('tracking', lang), icon: ListChecks },
    { id: 'meals' as Tab, label: t('meals', lang), icon: Utensils },
    { id: 'workout' as Tab, label: t('workout', lang), icon: Dumbbell },
    { id: 'expenses' as Tab, label: t('expenses', lang), icon: DollarSign },
    { id: 'calendar' as Tab, label: t('calendar', lang), icon: Calendar },
  ];

  // Component access control filtering for sub-users
  const allowedComponents = userProfile?.allowedComponents || ['expenses'];
  const allowedTripIds = userProfile?.allowedTripIds || ['*'];
  const tabs = allTabs.filter((tab) => allowedComponents.includes(tab.id));
  const isReadOnly = userProfile?.accessLevel === 'view_only';

  // Ensure current active tab is permitted for user, otherwise switch to first allowed tab
  useEffect(() => {
    if (tabs.length > 0 && !allowedComponents.includes(config.activeTab)) {
      const fallbackTab = (tabs[0]?.id || 'expenses') as Tab;
      setConfig((s) => ({ ...s, activeTab: fallbackTab }));
    }
  }, [allowedComponents, config.activeTab, setConfig, tabs]);

  const sharedProps = {
    activePerson,
    partner1Name: partner1.name,
    partner2Name: '',
    accessToken,
    lang,
    isReadOnly,
    allowedTripIds,
    isMainAdmin: userProfile?.isMainAdmin ?? true,
  };

  if (authLoading) {
    return (
      <PWAWrapper>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </PWAWrapper>
    );
  }

  if (!accessToken) {
    return (
      <PWAWrapper>
        <AuthPage onLogin={login} onSignup={signup} onResetPassword={resetPassword} error={authError} clearError={clearError} />
      </PWAWrapper>
    );
  }

  return (
    <PWAWrapper>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{t('appName', lang)}</h1>
                  {userProfile?.isMainAdmin ? (
                    <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      Main Admin
                    </span>
                  ) : (
                    <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      {isReadOnly ? <Eye className="w-3 h-3 text-amber-600" /> : <Pencil className="w-3 h-3" />}
                      {userProfile?.name} ({isReadOnly ? 'View Only' : 'Edit Access'})
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
              </div>
            </div>

            <div className="flex items-end gap-3 flex-shrink-0">
              <PartnerButton profile={partner1} active={true} onSelect={() => {}} onEdit={() => setEditingPartner('partner1')} />

              {/* Settings Button Next to User Profile */}
              <button
                onClick={() => setShowSettingsModal(true)}
                title={t('settings', lang)}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-11 h-11 rounded-full flex items-center justify-center ring-2 ring-gray-200 dark:ring-gray-700 hover:ring-indigo-400 bg-gray-50 dark:bg-gray-700/60 hover:bg-indigo-50 dark:hover:bg-gray-700 transition-all">
                  <Settings className="w-4 h-4 text-gray-600 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{t('settings', lang)}</span>
              </button>

              {isInstallable && (
                <button onClick={promptInstall} title={t('install', lang)} className="flex flex-col items-center gap-1 group">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center ring-2 ring-indigo-200 hover:ring-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 transition-all">
                    <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 transition-colors" />
                  </div>
                  <span className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600">{t('install', lang)}</span>
                </button>
              )}

              <button onClick={logout} title={t('logout', lang)} className="flex flex-col items-center gap-1 group">
                <div className="w-11 h-11 rounded-full flex items-center justify-center ring-2 ring-gray-200 dark:ring-gray-700 hover:ring-red-300 bg-gray-50 dark:bg-gray-700/60 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all">
                  <LogOut className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-red-500 transition-colors" />
                </div>
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-400 group-hover:text-red-400">{t('logout', lang)}</span>
              </button>
            </div>
          </div>
        </div>

        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap text-sm ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300'}`}>
                  <Icon className="w-4 h-4" />{tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Read Only Banner */}
        {isReadOnly && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-amber-700 dark:text-amber-300 flex-shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm block">View Only Access Mode</span>
                <span className="text-amber-700 dark:text-amber-400">You have read-only permissions for this component assigned by admin. Data modifications are restricted.</span>
              </div>
            </div>
            <span className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wider">
              Read Only
            </span>
          </div>
        )}

        {activeTab === 'activities' && allowedComponents.includes('activities') && <DailyActivities {...sharedProps} trackingReminders={trackingReminders} onUpdateTrackingReminders={updateTrackingReminders} onUnsavedChanges={handleUnsavedChanges} />}
        {activeTab === 'meals'      && allowedComponents.includes('meals')      && <MealSchedule {...sharedProps} onUnsavedChanges={handleUnsavedChanges} />}
        {activeTab === 'workout'    && allowedComponents.includes('workout')    && <WorkoutSchedule {...sharedProps} onUnsavedChanges={handleUnsavedChanges} />}
        {activeTab === 'expenses'   && allowedComponents.includes('expenses')   && <Expenditure {...sharedProps} onUnsavedChanges={handleUnsavedChanges} />}
        {activeTab === 'calendar'   && allowedComponents.includes('calendar')   && <CalendarView {...sharedProps} onUnsavedChanges={handleUnsavedChanges} />}
        {activeTab === 'tracking'   && allowedComponents.includes('tracking')   && <Tracking {...sharedProps} reminders={trackingReminders} onAddReminder={addTrackingReminder} onUpdateReminders={updateTrackingReminders} onUnsavedChanges={handleUnsavedChanges} />}
      </main>

      {/* Unsaved changes navigation guard */}
      {pendingTab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Unsaved Changes</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">You have unsaved changes on this page.</p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex flex-col gap-2 mt-2">
              <button
                onClick={() => {
                  currentSaveFnRef.current?.();
                  commitTabChange(pendingTab);
                  setPendingTab(null);
                }}
                className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Save & Continue
              </button>
              <button
                onClick={() => {
                  commitTabChange(pendingTab);
                  setPendingTab(null);
                }}
                className="w-full py-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-sm font-medium rounded-xl hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors border border-red-200 dark:border-red-800"
              >
                Discard & Continue
              </button>
              <button
                onClick={() => setPendingTab(null)}
                className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Stay on this page
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPartner && (
        <AvatarPickerModal
          profile={partner1}
          onSave={setPartner1}
          onClose={() => setEditingPartner(null)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          theme={theme}
          onThemeChange={setTheme}
          lang={lang}
          onLangChange={setLang}
          userProfile={userProfile}
          fetchAppUsers={fetchAppUsers}
          createAppUser={createAppUser}
          updateAppUser={updateAppUser}
          deleteAppUser={deleteAppUser}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
      </div>
    </PWAWrapper>
  );
}
