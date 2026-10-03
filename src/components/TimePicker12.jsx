// src/components/TimePicker12.jsx
//
// Doorashada waqtiga: Saacad (1–12) + Daqiiqad + AM/PM.
// Waxaa lagu kaydiyaa qaabka 24-saac ("HH:mm") sidii hore, sidaas darteed
// getWindowState() (utils/attendance.js) si sax ah ayuu u shaqeeyaa:
//   1:00 AM -> 01:00   ·   12:00 PM -> 12:00   ·   1:00 PM -> 13:00
// Marka saacad la doorto oo AM/PM aan la dooran: 6–11 => AM, 12 iyo 1–5 => PM.

import { useEffect, useState } from "react";

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const pad2 = (n) => String(n).padStart(2, "0");

export function parse24(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
  if (!m) return { hour: "", minute: "00", period: "" };
  const h24 = Math.min(Math.max(Number(m[1]), 0), 23);
  return {
    hour: String(h24 % 12 === 0 ? 12 : h24 % 12),
    minute: m[2],
    period: h24 >= 12 ? "PM" : "AM",
  };
}

export function to24(hour, minute, period) {
  const h = Number(hour);
  if (!h) return "";
  const h24 = period === "AM" ? (h === 12 ? 0 : h) : h === 12 ? 12 : h + 12;
  return `${pad2(h24)}:${pad2(Number(minute) || 0)}`;
}

const guessPeriod = (hour) => {
  const h = Number(hour);
  return h >= 6 && h <= 11 ? "AM" : "PM";
};

export default function TimePicker12({ value, onChange }) {
  const [draft, setDraft] = useState(() => parse24(value));

  useEffect(() => {
    const parsed = parse24(value);
    if (parsed.hour) setDraft(parsed);
  }, [value]);

  const emit = (next) => {
    setDraft(next);
    if (next.hour && next.period) onChange(to24(next.hour, next.minute, next.period));
    else if (!next.hour) onChange("");
  };

  const minuteOptions = MINUTES.includes(draft.minute)
    ? MINUTES
    : [...MINUTES, draft.minute].sort();

  const current = draft.hour && draft.period ? to24(draft.hour, draft.minute, draft.period) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 1.1fr", gap: 6, alignItems: "center" }}>
        <select
          value={draft.hour}
          aria-label="Saacadda"
          onChange={(e) => {
            const hour = e.target.value;
            emit(
              hour
                ? { hour, minute: draft.minute || "00", period: draft.period || guessPeriod(hour) }
                : { ...draft, hour: "" }
            );
          }}
        >
          <option value="">--</option>
          {HOURS.map((h) => (
            <option key={h} value={String(h)}>{h}</option>
          ))}
        </select>
        <strong style={{ color: "#98a2b3" }}>:</strong>
        <select
          value={draft.minute}
          aria-label="Daqiiqadda"
          onChange={(e) => emit({ ...draft, minute: e.target.value })}
        >
          {minuteOptions.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={draft.period}
          aria-label="AM ama PM"
          onChange={(e) => emit({ ...draft, period: e.target.value })}
          style={{ fontWeight: 700 }}
        >
          <option value="">AM/PM</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {current && (
        <span style={{ fontSize: "0.75rem", color: "#667085" }}>
          {draft.period === "PM" ? "Galab" : "Subax"} · {current}
        </span>
      )}
    </div>
  );
}