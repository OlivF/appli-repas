import { DAYS } from "@/lib/meal-slots";

// Dates sans heure, au format AAAA-MM-JJ, calculées en UTC pour ignorer les changements
// d'heure. Une semaine est désignée par son lundi.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function toDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

// La date du jour à Paris (le serveur, lui, peut tourner en UTC).
export function todayInParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date: string, days: number): string {
  const result = toDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return toIso(result);
}

// Lundi = 0 … dimanche = 6, comme en base.
function dayIndex(date: string) {
  return (toDate(date).getUTCDay() + 6) % 7;
}

export function mondayOf(date: string): string {
  return addDays(date, -dayIndex(date));
}

// Le menu se prépare pour la semaine suivante : le lundi qui vient (le suivant, un lundi).
export function nextWeekStart(today: string): string {
  return addDays(mondayOf(today), 7);
}

function isValidDate(text: string) {
  const match = ISO_DATE.exec(text);
  if (!match) return false;
  const date = toDate(text);
  return !Number.isNaN(date.getTime()) && toIso(date) === text;
}

// `?semaine=` de l'adresse : le lundi de cette date, ou la semaine prochaine.
export function parseWeekParam(param: string | undefined, today: string): string {
  return param && isValidDate(param) ? mondayOf(param) : nextWeekStart(today);
}

function dayOfMonth(date: Date) {
  const day = date.getUTCDate();
  return day === 1 ? "1er" : String(day);
}

// « Semaine du 23 au 29 novembre », « … du 30 novembre au 6 décembre »,
// « … du 28 décembre 2026 au 3 janvier 2027 ».
export function weekLabel(start: string): string {
  const first = toDate(start);
  const last = toDate(addDays(start, 6));
  const month = (date: Date) => MONTHS[date.getUTCMonth()];
  const lastPart = `${dayOfMonth(last)} ${month(last)}`;

  if (first.getUTCFullYear() !== last.getUTCFullYear()) {
    return `Semaine du ${dayOfMonth(first)} ${month(first)} ${first.getUTCFullYear()} au ${lastPart} ${last.getUTCFullYear()}`;
  }
  if (first.getUTCMonth() !== last.getUTCMonth()) {
    return `Semaine du ${dayOfMonth(first)} ${month(first)} au ${lastPart}`;
  }
  return `Semaine du ${dayOfMonth(first)} au ${lastPart}`;
}

// En-tête d'une colonne : « Lun » et « 23 ».
export function dayLabel(start: string, day: number) {
  return {
    short: DAYS[day].short,
    long: DAYS[day].long,
    date: String(toDate(addDays(start, day)).getUTCDate()),
  };
}

export function weekRelation(start: string, today: string): "current" | "next" | null {
  const current = mondayOf(today);
  if (start === current) return "current";
  if (start === addDays(current, 7)) return "next";
  return null;
}
