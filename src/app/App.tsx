import { useState, useRef, useCallback, useEffect } from 'react';
import { Calendar, Activity, Utensils, Dumbbell, DollarSign, Target, Users, Pencil, X, Camera, Smile, Type, ListChecks, LogOut, Loader2, Download, Settings, Sun, Moon, Check, Globe } from 'lucide-react';
import { format } from 'date-fns';
import DailyActivities from './components/DailyActivities';
import MealSchedule from './components/MealSchedule';
import WorkoutSchedule from './components/WorkoutSchedule';
import Expenditure from './components/Expenditure';
import CalendarView from './components/CalendarView';
import Tracking from './components/Tracking';
import AuthPage from './components/AuthPage';
import PWAWrapper from './components/PWAWrapper';
import { useAuth } from './hooks/useAuth';
import { useSupabasePersistedState } from './hooks/useSupabasePersistedState';
import { usePWA } from './hooks/usePWA';
import { Language, t } from './utils/translations';
import { startNotificationScheduler, stopNotificationScheduler } from './utils/notificationScheduler';

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
  activePerson: 'partner1', // Default to partner1 instead of 'both'
  activeTab: 'activities',
};

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

// ── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({
  theme,
  onThemeChange,
  lang,
  onLangChange,
  onClose,
}: {
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  lang: Language;
  onLangChange: (l: Language) => void;
  onClose: () => void;
}) {
  const languages: { id: Language; label: string; flag: string }[] = [
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
    { id: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-bold text-gray-900 dark:text-gray-100">{t('settingsTitle', lang)}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
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
        </div>

        <div className="px-5 pb-5">
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
  const { accessToken, loading: authLoading, error: authError, login, signup, logout, resetPassword, clearError } = useAuth();
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
  const partner2 = { name: '', avatarType: 'letter' as const, letter: 'P', bgColor: '#ec4899' };

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

  const tabs = [
    { id: 'activities' as Tab, label: t('activities', lang), icon: Activity },
    { id: 'tracking' as Tab, label: t('tracking', lang), icon: ListChecks },
    { id: 'meals' as Tab, label: t('meals', lang), icon: Utensils },
    { id: 'workout' as Tab, label: t('workout', lang), icon: Dumbbell },
    { id: 'expenses' as Tab, label: t('expenses', lang), icon: DollarSign },
    { id: 'calendar' as Tab, label: t('calendar', lang), icon: Calendar },
  ];

  const sharedProps = { activePerson, partner1Name: partner1.name, partner2Name: '', accessToken, lang };

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
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{t('appName', lang)}</h1>
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
        {activeTab === 'activities' && <DailyActivities {...sharedProps} trackingReminders={trackingReminders} onUpdateTrackingReminders={updateTrackingReminders} onUnsavedChanges={handleUnsavedChanges} />}
        {activeTab === 'meals'      && <MealSchedule {...sharedProps} onUnsavedChanges={handleUnsavedChanges} />}
        {activeTab === 'workout'    && <WorkoutSchedule {...sharedProps} onUnsavedChanges={handleUnsavedChanges} />}
        {activeTab === 'expenses'   && <Expenditure {...sharedProps} onUnsavedChanges={handleUnsavedChanges} />}
        {activeTab === 'calendar'   && <CalendarView {...sharedProps} onUnsavedChanges={handleUnsavedChanges} />}
        {activeTab === 'tracking'   && <Tracking {...sharedProps} reminders={trackingReminders} onAddReminder={addTrackingReminder} onUpdateReminders={updateTrackingReminders} onUnsavedChanges={handleUnsavedChanges} />}
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
          onClose={() => setShowSettingsModal(false)}
        />
      )}
      </div>
    </PWAWrapper>
  );
}
