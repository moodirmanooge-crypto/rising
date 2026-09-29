import { useMemo, useState } from "react";
import { Users, BookOpen, Search, Layers } from "lucide-react";
import { CLASSES, groupLabel, studentGroups } from "../config/schoolOptions";
import { initials } from "./PortalLayout";

function inClass(student, cls) {
  if (student.classId === cls.id) return true;
  const groups = studentGroups(student);
  return groups.some((g) => g === cls.name || g.startsWith(`${cls.name} – `));
}

function inSub(student, cls, sub) {
  return studentGroups(student).includes(groupLabel(cls, sub));
}

// Admin "Classes" page: the 6 school classes and the students in each.
export default function ClassesView({ students, teachers }) {
  const [activeId, setActiveId] = useState(CLASSES[0].id);
  const [subId, setSubId] = useState("");
  const [search, setSearch] = useState("");

  const byClass = useMemo(() => {
    const map = {};
    CLASSES.forEach((c) => (map[c.id] = students.filter((s) => inClass(s, c))));
    map.unassigned = students.filter((s) => !CLASSES.some((c) => inClass(s, c)));
    return map;
  }, [students]);

  const active = CLASSES.find((c) => c.id === activeId);
  const isUnassigned = activeId === "unassigned";

  let list = byClass[activeId] || [];
  if (active?.subs && subId) {
    const sub = active.subs.find((s) => s.id === subId);
    list = list.filter((s) => inSub(s, active, sub));
  }
  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (s) => String(s.fullName || "").toLowerCase().includes(q) || String(s.studentId).includes(q)
    );
  }

  const classTeachers = active
    ? teachers.filter((t) => t.className === active.name || String(t.className || "").startsWith(`${active.name} – `))
    : [];

  function choose(id) {
    setActiveId(id);
    setSubId("");
    setSearch("");
  }

  return (
    <div className="stack">
      <div className="class-grid">
        {CLASSES.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={`class-card tone-${c.color} ${activeId === c.id ? "active" : ""}`}
            onClick={() => choose(c.id)}
          >
            <span className="class-num">{i + 1}</span>
            <div className="class-card-body">
              <strong>{c.name}</strong>
              <span>{c.so}</span>
              {c.subs && (
                <div className="class-subs">
                  {c.subs.map((s) => (
                    <em key={s.id}>
                      {s.name} · {byClass[c.id].filter((st) => inSub(st, c, s)).length}
                    </em>
                  ))}
                </div>
              )}
            </div>
            <div className="class-count">
              <strong>{byClass[c.id].length}</strong>
              <span>students</span>
            </div>
          </button>
        ))}
        {byClass.unassigned.length > 0 && (
          <button
            type="button"
            className={`class-card tone-slate ${isUnassigned ? "active" : ""}`}
            onClick={() => choose("unassigned")}
          >
            <span className="class-num">?</span>
            <div className="class-card-body">
              <strong>No class yet</strong>
              <span>Older students without one of the 6 classes</span>
            </div>
            <div className="class-count">
              <strong>{byClass.unassigned.length}</strong>
              <span>students</span>
            </div>
          </button>
        )}
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <h2>
              {isUnassigned ? "Students without a class" : active?.name}{" "}
              <span className="muted-sm">({list.length})</span>
            </h2>
            {!isUnassigned && <p>{active?.so}</p>}
          </div>
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search student" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {active?.subs && (
          <div className="chip-filter" style={{ marginBottom: 14 }}>
            <button type="button" className={`chip ${!subId ? "active" : ""}`} onClick={() => setSubId("")}>
              <Layers size={13} /> All
            </button>
            {active.subs.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip ${subId === s.id ? "active" : ""}`}
                onClick={() => setSubId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {classTeachers.length > 0 && (
          <div className="class-teachers">
            <BookOpen size={15} />
            {classTeachers.map((t) => (
              <span key={t.teacherId} className="tag tag-soft">
                {t.fullName} — {t.subject}
                {t.className !== active.name ? ` (${t.className.split(" – ")[1]})` : ""}
              </span>
            ))}
          </div>
        )}

        {list.length === 0 ? (
          <div className="empty">
            <Users size={34} />
            <strong>No students here yet</strong>
          </div>
        ) : (
          <div className="student-cards">
            {list.map((s) => {
              const groups = studentGroups(s);
              const subs = active?.subs ? groups.filter((g) => g.startsWith(`${active.name} – `)).map((g) => g.split(" – ")[1]) : [];
              return (
                <div key={s.studentId} className="student-card">
                  {s.photoUrl ? (
                    <img src={s.photoUrl} alt={s.fullName} className="avatar avatar-lg" />
                  ) : (
                    <span className="avatar avatar-lg avatar-placeholder">{initials(s.fullName)}</span>
                  )}
                  <div className="student-card-body">
                    <strong>{s.fullName}</strong>
                    <span>ID {s.studentId} • {s.shift || "—"}</span>
                    <div className="tag-list">
                      {(isUnassigned ? groups : subs).map((g) => (
                        <span key={g} className="tag">{g}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}