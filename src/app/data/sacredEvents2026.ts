import { subDays, parseISO, format } from 'date-fns';
import { CalendarEvent } from '../components/CalendarView';

export interface SacredTithiMeta {
  key: string;
  name: string;
  icon: string;
  description: string;
  dates: string[];
}

export const SACRED_TITHI_TYPES: SacredTithiMeta[] = [
  {
    key: 'amavasai',
    name: 'Amavasai',
    icon: '🌑', // Black moon
    description: 'Amavasai (New Moon Day) - Sacred Ancestral & Meditation Day',
    dates: [
      '2026-01-18',
      '2026-02-17',
      '2026-03-18',
      '2026-04-17',
      '2026-05-16',
      '2026-06-14',
      '2026-07-14',
      '2026-08-12',
      '2026-09-10',
      '2026-10-10',
      '2026-11-08',
      '2026-12-08',
    ],
  },
  {
    key: 'pournami',
    name: 'Pournami',
    icon: '🌕', // White moon
    description: 'Pournami (Full Moon Day) - Auspicious Worship & Reflection',
    dates: [
      '2026-01-03',
      '2026-02-01',
      '2026-03-03',
      '2026-04-01',
      '2026-05-01',
      '2026-05-31',
      '2026-06-29',
      '2026-07-29',
      '2026-08-27',
      '2026-09-26',
      '2026-10-25',
      '2026-11-24',
      '2026-12-23',
    ],
  },
  {
    key: 'pradosham',
    name: 'Pradosham',
    icon: '🐄', // Cow
    description: 'Pradosham - Auspicious Lord Shiva Worship (Evening Pradosha Kaalam)',
    dates: [
      '2026-01-01',
      '2026-01-16',
      '2026-01-30',
      '2026-02-14',
      '2026-03-01',
      '2026-03-16',
      '2026-03-30',
      '2026-04-15',
      '2026-04-29',
      '2026-05-14',
      '2026-05-28',
      '2026-06-12',
      '2026-06-27',
      '2026-07-12',
      '2026-07-26',
      '2026-08-10',
      '2026-08-25',
      '2026-09-08',
      '2026-09-24',
      '2026-10-08',
      '2026-10-23',
      '2026-11-06',
      '2026-11-22',
      '2026-12-06',
      '2026-12-21',
    ],
  },
  {
    key: 'karthigai',
    name: 'Karthigai',
    icon: '⭐', // Golden star
    description: 'Karthigai Star Nakshatram - Sacred Lord Murugan Worship',
    dates: [
      '2026-01-27',
      '2026-02-23',
      '2026-03-23',
      '2026-04-19',
      '2026-05-16',
      '2026-06-13',
      '2026-07-10',
      '2026-08-06',
      '2026-09-03',
      '2026-09-30',
      '2026-10-27',
      '2026-11-24',
      '2026-12-21',
    ],
  },
  {
    key: 'ashtami',
    name: 'Ashtami',
    icon: '🟦', // Blue square box
    description: 'Ashtami Tithi - Sacred 8th Lunar Day Observance',
    dates: [
      '2026-01-11',
      '2026-01-26',
      '2026-02-09',
      '2026-02-24',
      '2026-03-11',
      '2026-03-26',
      '2026-04-10',
      '2026-04-24',
      '2026-05-09',
      '2026-05-23',
      '2026-06-08',
      '2026-06-22',
      '2026-07-07',
      '2026-07-21',
      '2026-08-06',
      '2026-08-20',
      '2026-09-04',
      '2026-09-19',
      '2026-10-03',
      '2026-10-18',
      '2026-11-02',
      '2026-11-17',
      '2026-12-01',
      '2026-12-17',
      '2026-12-31',
    ],
  },
  {
    key: 'navami',
    name: 'Navami',
    icon: '🔺', // Red triangle box
    description: 'Navami Tithi - Sacred 9th Lunar Day Observance',
    dates: [
      '2026-01-12',
      '2026-01-27',
      '2026-02-10',
      '2026-02-25',
      '2026-03-12',
      '2026-03-27',
      '2026-04-11',
      '2026-04-25',
      '2026-05-10',
      '2026-05-24',
      '2026-06-09',
      '2026-06-23',
      '2026-07-08',
      '2026-07-22',
      '2026-08-07',
      '2026-08-21',
      '2026-09-05',
      '2026-09-20',
      '2026-10-04',
      '2026-10-19',
      '2026-11-03',
      '2026-11-18',
      '2026-12-02',
      '2026-12-18',
    ],
  },
  {
    key: 'sashti',
    name: 'Sashti',
    icon: '🦚', // Peacock icon for Sashti
    description: 'Sashti Tithi - Sacred Lord Murugan Vratam & Prayer',
    dates: [
      '2026-01-24',
      '2026-02-22',
      '2026-03-24',
      '2026-04-22',
      '2026-05-22',
      '2026-06-20',
      '2026-07-19',
      '2026-08-18',
      '2026-09-17',
      '2026-10-16',
      '2026-11-15',
      '2026-12-15',
    ],
  },
  {
    key: 'sivarathri',
    name: 'Maadha Sivarathiri',
    icon: '🔱', // Lord Shiva symbol (Trishul / Shiva Symbol)
    description: 'Maadha Sivarathiri - Holy Monthly Night of Lord Shiva Worship',
    dates: [
      '2026-01-17',
      '2026-02-15',
      '2026-03-17',
      '2026-04-15',
      '2026-05-15',
      '2026-06-13',
      '2026-07-12',
      '2026-08-11',
      '2026-09-09',
      '2026-10-09',
      '2026-11-07',
      '2026-12-07',
    ],
  },
];

export function generate2026SacredCalendarEvents(): CalendarEvent[] {
  const generatedEvents: CalendarEvent[] = [];

  SACRED_TITHI_TYPES.forEach((tithi) => {
    tithi.dates.forEach((dateStr, idx) => {
      const eventDate = parseISO(dateStr);
      const dayMinusOneStr = format(subDays(eventDate, 1), 'yyyy-MM-dd');

      generatedEvents.push({
        id: `sacred-2026-${tithi.key}-${idx}-${dateStr}`,
        title: `${tithi.name}`,
        date: dateStr,
        notificationDates: [dayMinusOneStr, dateStr],
        icon: tithi.icon,
        notificationTime: '08:00',
        snoozeOption: 'none',
        todoText: `${tithi.description}. Reminder scheduled for Day -1 (${dayMinusOneStr}) and Event Day (${dateStr}) at 8:00 AM.`,
        completed: false,
      });
    });
  });

  return generatedEvents;
}
