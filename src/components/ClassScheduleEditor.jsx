// src/components/ClassScheduleEditor.jsx
//
// Fasallada macallinku xaadirinayo (TeacherForm). Fasallada, maadooyinka,
// maalmaha iyo shift-yada waxaa laga soo gudbiyaa config-ka Rising (props). Block kasta: Fasal (dropdown) + Maado (dropdown) +
// Shift (dropdown) + maalmaha + xiisadaha maalin kasta (TimePicker 12h).
// Hoose waxaa ku jira "Jadwalka toddobaadka" oo tusaya fasalka xiisad kasta,
// si loo arko in waqtiyadu aysan is-dul marin.

import { Plus, X, Clock, School, BookOpen, CopyPlus, CalendarDays, AlertCircle } from "lucide-react";
import {
  CLASS_OPTIONS,
  SUBJECT_LIST,
  SHIFT_OPTIONS,
  WEEK_DAYS,
  allowedDays,
  sortDays,
  classLabel,
  emptyClassBlock,
  emptySession,
  nextSessionLabel,
  formatTime12,
} from "../utils/schoolForms";

const THEMES = {
  dark: {
    text: "#fff",
    muted: "#8b87ad",
    border: "rgba(139,108,245,0.3)",
    card: "rgba(255,255,255,0.02)",
    accent: "#8b6cf5",
    active: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
    activeText: "#fff",
    inputBg: "rgba(255,255,255,0.02)",
    inputText: "#e5e3f7",
    pillText: "#a9a6c4",
    danger: "#f87171",
    dangerBg: "rgba(239,68,68,0.12)",
  },
  light: {
    text: "#0f172a",
    muted: "#64748b",
    border: "#dbe2ea",
    card: "#f8fafc",
    accent: "#16a34a",
    active: "#16a34a",
    activeText: "#fff",
    inputBg: "#fff",
    inputText: "#0f172a",
    pillText: "#334155",
    danger: "#b91c1c",
    dangerBg: "#fef2f2",
  },
};

export default function ClassScheduleEditor({
  blocks,
  onChange,
  employmentTypes,
  days: daysProp,
  shiftOptions = SHIFT_OPTIONS,
  theme = "dark",
  TimePicker,
  classOptions = CLASS_OPTIONS,
  subjectOptions = SUBJECT_LIST,
  subjectsForClass,
}) {
  const t = THEMES[theme] || THEMES.dark;
  const days = daysProp || (employmentTypes ? allowedDays(employmentTypes) : WEEK_DAYS);
  const onlyPartTime =
    !daysProp && !!employmentTypes && employmentTypes.includes("Part Time") && !employmentTypes.includes("Full Time");

  const s = styles(t);
  // Maadooyinka fasalka la doortay oo keliya (haddii la bixiyo subjectsForClass)
  const blockSubjects = (b) => (subjectsForClass && b.className ? subjectsForClass(b.className) : subjectOptions);

  function setBlock(index, fn) {
    onChange(blocks.map((b, i) => (i === index ? fn(b) : b)));
  }

  function setField(index, field, value) {
    setBlock(index, (b) => ({ ...b, [field]: value }));
  }

  function toggleDay(index, day) {
    setBlock(index, (b) => {
      if (b.days.includes(day)) {
        const daySessions = { ...b.daySessions };
        delete daySessions[day];
        return { ...b, days: b.days.filter((d) => d !== day), daySessions };
      }
      return {
        ...b,
        days: sortDays([...b.days, day]),
        daySessions: { ...b.daySessions, [day]: [emptySession(nextSessionLabel([]))] },
      };
    });
  }

  function addSession(index, day) {
    setBlock(index, (b) => {
      const list = b.daySessions[day] || [];
      return { ...b, daySessions: { ...b.daySessions, [day]: [...list, emptySession(nextSessionLabel(list))] } };
    });
  }

  function removeSession(index, day, sIdx) {
    setBlock(index, (b) => ({
      ...b,
      daySessions: { ...b.daySessions, [day]: (b.daySessions[day] || []).filter((_, i) => i !== sIdx) },
    }));
  }

  function setSession(index, day, sIdx, field, value) {
    setBlock(index, (b) => ({
      ...b,
      daySessions: {
        ...b.daySessions,
        [day]: (b.daySessions[day] || []).map((x, i) => (i === sIdx ? { ...x, [field]: value } : x)),
      },
    }));
  }

  function addBlock() {
    onChange([...blocks, emptyClassBlock()]);
  }

  // Fasal kale isla maadadan/shift-kan/maalmahan — waqtiyada cusub ayaa la gelinayaa.
  function duplicateBlock(index) {
    const b = blocks[index];
    const copy = {
      ...emptyClassBlock(),
      subject: b.subject,
      shift: b.shift,
      days: [...b.days],
      daySessions: Object.fromEntries(b.days.map((d) => [d, [emptySession(nextSessionLabel([]))]])),
    };
    onChange([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]);
  }

  function removeBlock(index) {
    if (blocks.length === 1) return;
    onChange(blocks.filter((_, i) => i !== index));
  }

  // Jadwalka toddobaadka (dhammaan fasallada) + isku dhaca waqtiyada
  const weekly = WEEK_DAYS.map((day) => {
    const items = blocks
      .flatMap((b, bi) =>
        (b.daySessions[day] || [])
          .filter((x) => x.startTime && x.endTime)
          .map((x) => ({ ...x, bi, className: b.className, subject: b.subject }))
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    items.forEach((it, i) => {
      it.clash = items.some(
        (o, j) => j !== i && it.startTime < o.endTime && o.startTime < it.endTime
      );
    });
    return { day, items };
  }).filter((d) => d.items.length);

  // Fasallada horey loogu doortay block kale (si loo muujiyo, lama xannibo —
  // fasal isku mid ah maado kale wuu yeelan karaa).
  const usedClasses = (index) => blocks.filter((_, i) => i !== index).map((b) => b.className).filter(Boolean);

  return (
    <div>
      {blocks.map((block, index) => {
        const others = usedClasses(index);
        return (
          <div key={index} style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardTitle}>
                Fasalka #{index + 1}
                {block.className && (
                  <span style={s.cardSub}>
                    {" "}— {classLabel(block.className)}
                    {block.subject ? ` · ${block.subject}` : ""}
                  </span>
                )}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => duplicateBlock(index)} style={s.ghostBtn} title="Fasal kale isla maadadan iyo maalmahan">
                  <CopyPlus size={13} /> Nuqul fasal kale
                </button>
                {blocks.length > 1 && (
                  <button type="button" onClick={() => removeBlock(index)} style={s.removeBtn}>
                    <X size={13} /> Ka saar
                  </button>
                )}
              </div>
            </div>

            <div style={s.grid3}>
              <FieldLabel t={t} icon={School} label="Class">
                <select
                  style={s.input}
                  value={block.className}
                  onChange={(e) => {
                    const className = e.target.value;
                    setBlock(index, (b) => ({
                      ...b,
                      className,
                      subject:
                        subjectsForClass && className && !subjectsForClass(className).includes(b.subject)
                          ? ""
                          : b.subject,
                    }));
                  }}
                >
                  <option value="">-- Dooro Fasal --</option>
                  {classOptions.map((c) => (
                    <option key={c} value={c}>
                      {classLabel(c)}
                      {others.includes(c) ? " ✓" : ""}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel t={t} icon={BookOpen} label="Maadada">
                <select
                  style={s.input}
                  value={block.subject}
                  disabled={!!subjectsForClass && !block.className}
                  onChange={(e) => setField(index, "subject", e.target.value)}
                >
                  <option value="">{subjectsForClass && !block.className ? "-- Marka hore dooro fasal --" : "-- Dooro Maado --"}</option>
                  {block.subject && !blockSubjects(block).includes(block.subject) && (
                    <option value={block.subject}>{block.subject} (fasalkan kuma jirto)</option>
                  )}
                  {blockSubjects(block).map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel t={t} icon={Clock} label="Shift">
                <select style={s.input} value={block.shift} onChange={(e) => setField(index, "shift", e.target.value)}>
                  <option value="">-- Dooro Shift --</option>
                  {shiftOptions.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={s.label}>
                <CalendarDays size={15} color={t.accent} />
                Maalmaha Toddobaadka
                {onlyPartTime && <span style={s.note}> (Part Time — Thursday &amp; Friday oo keliya)</span>}
              </div>
              <div style={s.dayRow}>
                {days.map((day) => {
                  const on = block.days.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleDay(index, day)}
                      style={{
                        ...s.dayPill,
                        background: on ? t.active : t.inputBg,
                        color: on ? t.activeText : t.pillText,
                        borderColor: on ? "transparent" : t.border,
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {block.days.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={s.label}>Saacadaha Xiisadaha</div>
                {block.days.map((day) => {
                  const sessions = block.daySessions[day] || [];
                  const rank = {};
                  sessions
                    .map((_, i) => i)
                    .sort((a, b) => (sessions[a].startTime || "").localeCompare(sessions[b].startTime || ""))
                    .forEach((orig, r) => (rank[orig] = r + 1));
                  return (
                    <div key={day} style={s.dayCard}>
                      <div style={s.dayHead}>
                        <span style={s.dayTitle}>
                          <Clock size={14} color={t.accent} /> {day}
                        </span>
                        <button type="button" onClick={() => addSession(index, day)} style={s.ghostBtn}>
                          <Plus size={12} /> Xiisad kale
                        </button>
                      </div>

                      {sessions.map((session, sIdx) => {
                        const bad =
                          session.startTime && session.endTime && session.startTime >= session.endTime;
                        return (
                          <div key={sIdx} style={s.sessionRow}>
                            <div>
                              <span style={s.mini}>Magaca Xiisadda</span>
                              <input
                                type="text"
                                style={{ ...s.input, padding: "8px 10px", minWidth: 120 }}
                                placeholder={`Xiisadda #${rank[sIdx]}`}
                                value={session.label || ""}
                                onChange={(e) => setSession(index, day, sIdx, "label", e.target.value)}
                              />
                            </div>
                            <div>
                              <span style={s.mini}>Waqtiga Bilowga</span>
                              <TimePicker
                                value={session.startTime}
                                onChange={(v) => setSession(index, day, sIdx, "startTime", v)}
                              />
                            </div>
                            <div>
                              <span style={s.mini}>Waqtiga Dhammaadka</span>
                              <TimePicker
                                value={session.endTime}
                                onChange={(v) => setSession(index, day, sIdx, "endTime", v)}
                              />
                            </div>
                            {sessions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSession(index, day, sIdx)}
                                style={s.iconRemove}
                                title="Ka saar xiisaddan"
                              >
                                <X size={14} />
                              </button>
                            )}
                            {bad && (
                              <span style={{ ...s.note, color: t.danger, width: "100%" }}>
                                Waqtiga dhammaadku waa inuu ka dambeeyaa bilowga.
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <button type="button" onClick={addBlock} style={s.addBlockBtn}>
        <Plus size={16} /> Ku dar Fasal/Maado Kale
      </button>

      {weekly.length > 0 && (
        <div style={s.weekCard}>
          <div style={{ ...s.label, marginBottom: 12 }}>
            <CalendarDays size={15} color={t.accent} /> Jadwalka toddobaadka (xaadirinta)
          </div>
          {weekly.map(({ day, items }) => (
            <div key={day} style={s.weekRow}>
              <strong style={{ color: t.text, minWidth: 96 }}>{day}</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {items.map((it, i) => (
                  <span
                    key={i}
                    style={{
                      ...s.chip,
                      borderColor: it.clash ? t.danger : t.border,
                      color: it.clash ? t.danger : t.text,
                      background: it.clash ? t.dangerBg : t.inputBg,
                    }}
                  >
                    {it.clash && <AlertCircle size={12} />} {formatTime12(it.startTime)}–{formatTime12(it.endTime)} ·{" "}
                    {it.className ? classLabel(it.className) : `Fasalka #${it.bi + 1}`}
                    {it.subject ? ` · ${it.subject}` : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {weekly.some((d) => d.items.some((x) => x.clash)) && (
            <p style={{ ...s.note, color: t.danger, margin: "8px 0 0" }}>
              Xiisadaha cas waa isku dhacayaan — macallinku hal waqti laba fasal ma xaadirin karo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FieldLabel({ t, icon: Icon, label, children }) {
  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>
        <Icon size={15} color={t.accent} />
        {label}
      </label>
      {children}
    </div>
  );
}

function styles(t) {
  return {
    card: { background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, marginBottom: 16 },
    cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" },
    cardTitle: { color: t.accent, fontWeight: 700, fontSize: 15 },
    cardSub: { color: t.muted, fontWeight: 600, fontSize: 13 },
    grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 },
    input: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 10,
      border: `1.5px solid ${t.border}`,
      boxSizing: "border-box",
      fontSize: 14,
      color: t.inputText,
      background: t.inputBg,
      outline: "none",
    },
    label: { display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 },
    note: { color: t.muted, fontWeight: 400, fontSize: 12 },
    mini: { display: "block", fontSize: 11.5, color: t.muted, marginBottom: 6 },
    dayRow: { display: "flex", gap: 8, flexWrap: "wrap" },
    dayPill: { padding: "8px 16px", borderRadius: 20, border: "1.5px solid", cursor: "pointer", fontSize: 13, fontWeight: 600 },
    dayCard: { background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, marginTop: 10 },
    dayHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    dayTitle: { display: "flex", alignItems: "center", gap: 7, fontWeight: 700, color: t.text, fontSize: 14 },
    sessionRow: { display: "flex", gap: 14, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" },
    ghostBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: "transparent",
      border: `1.5px solid ${t.border}`,
      color: t.accent,
      borderRadius: 8,
      padding: "6px 11px",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 600,
    },
    removeBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: t.dangerBg,
      border: `1px solid ${t.danger}`,
      color: t.danger,
      borderRadius: 8,
      padding: "6px 10px",
      fontSize: 12,
      cursor: "pointer",
    },
    iconRemove: {
      background: t.dangerBg,
      border: `1px solid ${t.danger}`,
      color: t.danger,
      cursor: "pointer",
      borderRadius: 7,
      width: 30,
      height: 30,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    addBlockBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      background: "transparent",
      border: `1.5px solid ${t.border}`,
      color: t.accent,
      padding: "12px 20px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 14,
      marginBottom: 18,
    },
    weekCard: { background: t.card, border: `1px dashed ${t.border}`, borderRadius: 14, padding: 16, marginBottom: 20 },
    weekRow: { display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", flexWrap: "wrap" },
    chip: { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, border: "1px solid", fontSize: 12, fontWeight: 600 },
  };
}