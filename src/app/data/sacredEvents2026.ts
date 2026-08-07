import { subDays, parseISO, format } from 'date-fns';
import { CalendarEvent } from '../components/CalendarView';
import { Language } from '../utils/translations';

export interface SacredTithiMeta {
  key: string;
  name: string;
  nameTa: string;
  nameHi: string;
  icon: string;
  description: string;
  descriptionTa: string;
  descriptionHi: string;
  dates: string[];
}

export const SACRED_TITHI_TYPES: SacredTithiMeta[] = [
  {
    key: 'amavasai',
    name: 'Amavasai',
    nameTa: 'அமாவாசை',
    nameHi: 'अमावस्या',
    icon: '🌑', // Black moon
    description: 'Amavasai (New Moon Day) - Sacred Ancestral & Meditation Day',
    descriptionTa: 'அமாவாசை - முன்னோர்கள் வழிபாடு மற்றும் தியான நாள்',
    descriptionHi: 'अमावस्या - पितृ पूजा एवं ध्यान दिवस',
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
    nameTa: 'பௌர்ணமி',
    nameHi: 'पूर्णिमा',
    icon: '🌕', // White moon
    description: 'Pournami (Full Moon Day) - Auspicious Worship & Reflection',
    descriptionTa: 'பௌர்ணமி - மங்களகரமான வழிபாடு மற்றும் தியான நாள்',
    descriptionHi: 'पूर्णिमा - मंगल पूजा एवं आत्मचिंतन दिवस',
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
    nameTa: 'பிரதோஷம்',
    nameHi: 'प्रदोषम',
    icon: '🐄', // Cow
    description: 'Pradosham - Auspicious Lord Shiva Worship (Evening Pradosha Kaalam)',
    descriptionTa: 'பிரதோஷம் - சிவபெருமான் வழிபாடு (மாலை பிரதோஷ காலம்)',
    descriptionHi: 'प्रदोषम - भगवान शिव की शुभ संध्या पूजा',
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
    key: 'sivarathri',
    name: 'Maadha Sivarathiri',
    nameTa: 'மாத சிவராத்திரி',
    nameHi: 'माघ शिवरात्रि',
    icon: '🔱', // Lord Shiva symbol (Trishul / Shiva Symbol)
    description: 'Maadha Sivarathiri - Holy Monthly Night of Lord Shiva Worship',
    descriptionTa: 'மாத சிவராத்திரி - மாதாந்திர புனித சிவபெருமான் இரவு வழிபாடு',
    descriptionHi: 'माघ शिवरात्रि - भगवान शिव की पवित्र मासिक रात्रि पूजा',
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
      '2026-11-08',
      '2026-12-07',
    ],
  },
];

export function getSacredTithiName(tithi: SacredTithiMeta, lang: Language): string {
  if (lang === 'ta') return tithi.nameTa;
  if (lang === 'hi') return tithi.nameHi;
  return tithi.name;
}

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
