export type Language = 'en' | 'ta' | 'hi';

export interface TranslationDictionary {
  appName: string;
  settings: string;
  settingsTitle: string;
  languageSelection: string;
  appearanceTheme: string;
  lightMode: string;
  darkMode: string;
  active: string;
  done: string;
  install: string;
  logout: string;
  saveProfile: string;
  editProfile: string;

  // Tabs
  activities: string;
  tracking: string;
  meals: string;
  workout: string;
  expenses: string;
  calendar: string;

  // Calendar View
  calendarView: string;
  eventsListView: string;
  importSacredEvents: string;
  importSacredEventsTooltip: string;
  allSaved: string;
  saveCalendar: string;
  saved: string;
  mobileNotifications: string;
  mobileNotificationsDesc: string;
  enabled: string;
  disabled: string;
  enableNotifications: string;
  sendTestNotification: string;
  sacredTithiTitle: string;
  loadTithiEvents: string;
  eventsCount: string;
  eventsOnDate: string;
  today: string;
  addEvent: string;
  addEventForDate: string;
  editEvent: string;
  quickSacredPreset: string;
  quickSacredDesc: string;
  eventTitleIcon: string;
  notificationDates: string;
  addDate: string;
  shortcuts: string;
  eventDateShortcut: string;
  oneDayBeforeShortcut: string;
  twoDaysBeforeShortcut: string;
  oneWeekBeforeShortcut: string;
  notificationTime: string;
  snoozeOption: string;
  todoNotes: string;
  saveEventChanges: string;
  searchEvents: string;
  thisMonth: string;
  thisWeek: string;
  allEvents: string;
  upcomingCurrentEvents: string;
  noMatchingEvents: string;
  deleteEvent: string;
  deleteConfirmMsg: string;
  cancel: string;
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  en: {
    appName: 'Track My Day',
    settings: 'Settings',
    settingsTitle: 'App Settings',
    languageSelection: 'Select Language',
    appearanceTheme: 'App Appearance & Theme',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    active: 'Active',
    done: 'Done',
    install: 'Install',
    logout: 'Logout',
    saveProfile: 'Save Profile',
    editProfile: 'Edit Profile',

    activities: 'Activities',
    tracking: 'Tracking',
    meals: 'Meals',
    workout: 'Workout',
    expenses: 'Expenses',
    calendar: 'Calendar',

    calendarView: 'Calendar View',
    eventsListView: 'Events List View',
    importSacredEvents: 'Import 2026 Sacred Tithi Events',
    importSacredEventsTooltip: 'Import all 2026 Amavasai, Pournami, Pradosham & Sivarathri events with 8 AM notifications',
    allSaved: 'All Saved',
    saveCalendar: 'Save Calendar',
    saved: 'Saved!',
    mobileNotifications: 'Mobile Lock-Screen Notifications',
    mobileNotificationsDesc: 'Receive native lock-screen push notifications & snooze alerts for saved calendar events.',
    enabled: 'Enabled',
    disabled: 'Disabled',
    enableNotifications: 'Enable Notifications',
    sendTestNotification: 'Send Test Notification',
    sacredTithiTitle: '2026 Sacred Tithi Event Icons (Click any card to view dates list)',
    loadTithiEvents: '+ Load 2026 Tithi Events',
    eventsCount: 'events',
    eventsOnDate: 'Events on',
    today: 'Today',
    addEvent: 'Add Event',
    addEventForDate: 'Add Event for',
    editEvent: 'Edit Event',
    quickSacredPreset: 'Quick Sacred Event Preset',
    quickSacredDesc: 'Auto-fills icon & 8 AM reminders',
    eventTitleIcon: 'Event Title & Icon',
    notificationDates: 'Notification Dates (Select Multiple Dates)',
    addDate: '+ Add Date',
    shortcuts: 'Shortcuts:',
    eventDateShortcut: '+ Event Date',
    oneDayBeforeShortcut: '-1 Day Before',
    twoDaysBeforeShortcut: '-2 Days Before',
    oneWeekBeforeShortcut: '-1 Week Before',
    notificationTime: 'Notification Time (Optional)',
    snoozeOption: 'Snooze Option (Optional)',
    todoNotes: 'To-Do / Notes (Optional)',
    saveEventChanges: 'Save Event Changes',
    searchEvents: 'Search events or to-do notes...',
    thisMonth: 'This Month',
    thisWeek: 'This Week',
    allEvents: 'All Events',
    upcomingCurrentEvents: 'Upcoming & Current Events',
    noMatchingEvents: 'No matching events found for this filter period.',
    deleteEvent: 'Delete Event',
    deleteConfirmMsg: 'Are you sure you want to delete this event?',
    cancel: 'Cancel',
  },
  ta: {
    appName: 'என் நாளை தொடர்',
    settings: 'அமைப்புகள்',
    settingsTitle: 'செயலி அமைப்புகள்',
    languageSelection: 'மொழியைத் தேர்ந்தெடுக்கவும்',
    appearanceTheme: 'தோற்றம் மற்றும் கருப்பொருள்',
    lightMode: 'பகல் முறை',
    darkMode: 'இரவு முறை',
    active: 'செயலில்',
    done: 'முடிந்தது',
    install: 'நிறுவு',
    logout: 'வெளியேறு',
    saveProfile: 'சுயவிவரத்தை சேமி',
    editProfile: 'சுயவிவரத்தை திருத்து',

    activities: 'செயல்பாடுகள்',
    tracking: 'கண்காணிப்பு',
    meals: 'உணவு',
    workout: 'உடற்பயிற்சி',
    expenses: 'செலவுகள்',
    calendar: 'நாட்காட்டி',

    calendarView: 'நாட்காட்டி பார்வை',
    eventsListView: 'நிகழ்வுகள் பட்டியல்',
    importSacredEvents: '2026 புனித திதிகளை இறக்குமதி செய்',
    importSacredEventsTooltip: 'அமாவாசை, பௌர்ணமி, பிரதோஷம் மற்றும் சிவராத்திரி நிகழ்வுகளை இறக்குமதி செய்',
    allSaved: 'அனைத்தும் சேமிக்கப்பட்டது',
    saveCalendar: 'நாட்காட்டியை சேமி',
    saved: 'சேமிக்கப்பட்டது!',
    mobileNotifications: 'மொபைல் திரை அறிவிப்புகள்',
    mobileNotificationsDesc: 'சேமிக்கப்பட்ட நிகழ்வுகளுக்கான பூட்டுத் திரை புஷ் அறிவிப்புகளைப் பெறுங்கள்.',
    enabled: 'செயல்படுத்தப்பட்டது',
    disabled: 'செயலிழக்கப்பட்டது',
    enableNotifications: 'அறிவிப்புகளை இயக்கு',
    sendTestNotification: 'சோதனை அறிவிப்பை அனுப்பு',
    sacredTithiTitle: '2026 புனித திதி நிகழ்வுகள் (தேதிகளைப் பார்க்க கார்டை கிளிக் செய்யவும்)',
    loadTithiEvents: '+ திதிகளை ஏற்று',
    eventsCount: 'நிகழ்வுகள்',
    eventsOnDate: 'நிகழ்வுகள் நாள்:',
    today: 'இன்று',
    addEvent: 'நிகழ்வைச் சேர்',
    addEventForDate: 'நாள் நிகழ்வைச் சேர்:',
    editEvent: 'நிகழ்வை திருத்து',
    quickSacredPreset: 'விரைவு புனித திதி அமைப்புகள்',
    quickSacredDesc: 'ஐகான் மற்றும் காலை 8 மணி நினைவூட்டல் தானாக அமைக்கும்',
    eventTitleIcon: 'நிகழ்வின் தலைப்பு & ஐகான்',
    notificationDates: 'நினைவூட்டல் தேதிகள் (பல தேதிகளைத் தேர்ந்தெடுக்கலாம்)',
    addDate: '+ தேதி சேர்',
    shortcuts: 'குறுக்குவழிகள்:',
    eventDateShortcut: '+ நிகழ்வு தேதி',
    oneDayBeforeShortcut: '-1 நாள் முன்',
    twoDaysBeforeShortcut: '-2 நாள் முன்',
    oneWeekBeforeShortcut: '-1 வாரம் முன்',
    notificationTime: 'அறிவிப்பு நேரம் (விருப்பத்தேர்வு)',
    snoozeOption: 'மீண்டும் நினைவூட்டு (விருப்பத்தேர்வு)',
    todoNotes: 'செய்யவேண்டியவை / குறிப்புகள்',
    saveEventChanges: 'மாற்றங்களை சேமி',
    searchEvents: 'நிகழ்வுகள் அல்லது குறிப்புகளைத் தேடு...',
    thisMonth: 'இந்த மாதம்',
    thisWeek: 'இந்த வாரம்',
    allEvents: 'அனைத்து நிகழ்வுகளும்',
    upcomingCurrentEvents: 'வரவிருக்கும் நிகழ்வுகள்',
    noMatchingEvents: 'இந்த காலகட்டத்திற்கு நிகழ்வுகள் எதுவும் இல்லை.',
    deleteEvent: 'நிகழ்வை நீக்கு',
    deleteConfirmMsg: 'இந்த நிகழ்வை நிச்சயமாக நீக்க விரும்புகிறீர்களா?',
    cancel: 'ரத்து செய்',
  },
  hi: {
    appName: 'ट्रैक माय डे',
    settings: 'सेटिंग्स',
    settingsTitle: 'ऐप सेटिंग्स',
    languageSelection: 'भाषा चुनें',
    appearanceTheme: 'रंग रूप और थीम',
    lightMode: 'लाइट मोड',
    darkMode: 'डार्क मोड',
    active: 'सक्रिय',
    done: 'हो गया',
    install: 'इंस्टॉल करें',
    logout: 'लॉग आउट',
    saveProfile: 'प्रोफाइल सहेजें',
    editProfile: 'प्रोफाइल संपादित करें',

    activities: 'गतिविधियां',
    tracking: 'ट्रैकिंग',
    meals: 'भोजन',
    workout: 'व्यायाम',
    expenses: 'खर्च',
    calendar: 'कैलेंडर',

    calendarView: 'कैलेंडर व्यू',
    eventsListView: 'इवेंट्स सूची',
    importSacredEvents: '2026 पवित्र तिथियां आयात करें',
    importSacredEventsTooltip: 'अमावस्या, पूर्णिमा, प्रदोषम और शिवरात्रि के सभी इवेंट्स सुबह 8 बजे रिमाइंडर के साथ आयात करें',
    allSaved: 'सभी सहेजे गए',
    saveCalendar: 'कैलेंडर सहेजें',
    saved: 'सहेजा गया!',
    mobileNotifications: 'मोबाइल लॉक-स्क्रीन नोटिफिकेशन',
    mobileNotificationsDesc: 'सहेजे गए कैलेंडर इवेंट्स के लिए पुश नोटिफिकेशन प्राप्त करें।',
    enabled: 'सक्षम',
    disabled: 'अक्षम',
    enableNotifications: 'नोटिफिकेशन चालू करें',
    sendTestNotification: 'टेस्ट नोटिफिकेशन भेजें',
    sacredTithiTitle: '2026 पवित्र तिथियां (तारीखें देखने के लिए कार्ड पर क्लिक करें)',
    loadTithiEvents: '+ तिथियां लोड करें',
    eventsCount: 'इवेंट्स',
    eventsOnDate: 'इवेंट्स तारीख:',
    today: 'आज',
    addEvent: 'इवेंट जोड़ें',
    addEventForDate: 'इवेंट जोड़ें तारीख:',
    editEvent: 'इवेंट संपादित करें',
    quickSacredPreset: 'त्वरित पवित्र तिथि प्रीसेट',
    quickSacredDesc: 'आइकन और सुबह 8 बजे का रिमाइंडर स्वतः सेट होता है',
    eventTitleIcon: 'इवेंट का शीर्षक और आइकन',
    notificationDates: 'रिमाइंडर की तारीखें (कई तारीखें चुनें)',
    addDate: '+ तारीख जोड़ें',
    shortcuts: 'शॉर्टकट:',
    eventDateShortcut: '+ इवेंट की तारीख',
    oneDayBeforeShortcut: '-1 दिन पहले',
    twoDaysBeforeShortcut: '-2 दिन पहले',
    oneWeekBeforeShortcut: '-1 सप्ताह पहले',
    notificationTime: 'नोटिफिकेशन का समय (वैकल्पिक)',
    snoozeOption: 'स्नूज़ विकल्प (वैकल्पिक)',
    todoNotes: 'टू-डू / नोट्स (वैकल्पिक)',
    saveEventChanges: 'बदलाव सहेजें',
    searchEvents: 'इवेंट्स या नोट्स खोजें...',
    thisMonth: 'इस महीने',
    thisWeek: 'इस सप्ताह',
    allEvents: 'सभी इवेंट्स',
    upcomingCurrentEvents: 'आगामी एवं वर्तमान इवेंट्स',
    noMatchingEvents: 'इस अवधि के लिए कोई इवेंट्स नहीं मिले।',
    deleteEvent: 'इवेंट हटाएं',
    deleteConfirmMsg: 'क्या आप निश्चित रूप से इस इवेंट को हटाना चाहते हैं?',
    cancel: 'रद्द करें',
  },
};

export function t(key: keyof TranslationDictionary, lang: Language): string {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}
