export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(minutes));
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  return `${sign}${hours}:${String(rest).padStart(2, "0")} h`;
}

export function formatSignedMinutes(minutes: number): string {
  if (minutes === 0) return "0:00 h";
  return `${minutes > 0 ? "+" : "-"}${formatMinutes(Math.abs(minutes))}`;
}

export function formatDecimalHours(minutes: number): string {
  return `${(minutes / 60).toLocaleString("de-AT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })} h`;
}

export function formatDays(minutes: number, minutesPerDay = 480): string {
  return `${(minutes / minutesPerDay).toLocaleString("de-AT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })} Tage`;
}

export function formatWholeDays(minutes: number, minutesPerDay = 480): string {
  return `${Math.round(minutes / minutesPerDay).toLocaleString("de-AT", {
    maximumFractionDigits: 0
  })} Tage`;
}

export function formatClockFromMinutes(minutes: number): string {
  const dayMinutes = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(dayMinutes / 60);
  const rest = dayMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
