import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  BookOpen,
  CheckCircle2,
  Edit3,
  Layers3,
  Plus,
  Save,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";

import { db } from "../../firebase";
import {
  DEFAULT_SECTIONS,
  ENGLISH_LEVELS,
  makeEnglishClass,
  subscribeSchoolClasses,
} from "../../config/schoolOptions";
import { SCHOOL_CLASSES_COLLECTION } from "../../config/collections";

const emptyForm = {
  level: "Elementary",
  section: "A",
  customName: "",
  customDescription: "",
};

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const unsub = subscribeSchoolClasses(
      setClasses,
      (err) => {
        console.error(err);
        setError("Unable to load classes.");
      }
    );

    return unsub;
  }, []);

  const englishClasses = useMemo(
    () => classes.filter((c) => c.type === "english" || c.level),
    [classes]
  );

  const otherClasses = useMemo(
    () => classes.filter((c) => c.type !== "english" && !c.level),
    [classes]
  );

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function reset() {
    setForm(emptyForm);
    setEditing(null);
  }

  async function saveClass(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    let name = "";

    if (form.level === "Other") {
      name = form.customName.trim();
      if (!name) {
        setError("Geli magaca class-ka.");
        return;
      }
    } else {
      name = makeEnglishClass(form.level, form.section).name;
    }

    setSaving(true);

    try {
      const payload =
        form.level === "Other"
          ? {
              name,
              so:
                form.customDescription.trim() ||
                "School class",
              type: "custom",
              active: true,
            }
          : {
              ...makeEnglishClass(
                form.level,
                form.section,
                editing?.id
              ),
              active: true,
            };

      if (editing?.id) {
        await updateDoc(
          doc(db, SCHOOL_CLASSES_COLLECTION, editing.id),
          {
            ...payload,
            updatedAt: serverTimestamp(),
          }
        );
        setSuccess("Class-ka waa la cusboonaysiiyay.");
      } else {
        // Prevent duplicate class names.
        const exists = classes.some(
          (c) =>
            String(c.name || "").toLowerCase() ===
            name.toLowerCase()
        );

        if (exists) {
          setError(`Class-ka "${name}" hore ayuu u jiraa.`);
          setSaving(false);
          return;
        }

        await addDoc(
          collection(db, SCHOOL_CLASSES_COLLECTION),
          {
            ...payload,
            createdAt: serverTimestamp(),
          }
        );

        setSuccess("Class cusub waa la sameeyay.");
      }

      reset();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save class.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(cls) {
    setError("");
    setSuccess("");
    setEditing(cls);

    if (cls.level) {
      setForm({
        level: cls.level,
        section: cls.section || "A",
        customName: "",
        customDescription: "",
      });
    } else {
      setForm({
        level: "Other",
        section: "A",
        customName: cls.name || "",
        customDescription: cls.so || "",
      });
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeClass(cls) {
    if (!cls?.id || cls.source !== "custom") {
      setError(
        "Default class lama tirtiri karo. Waxaad tirtiri kartaa classes-ka maamulka sameeyay."
      );
      return;
    }

    const ok = window.confirm(
      `Ma hubtaa inaad tirtirayso "${cls.name}"?`
    );

    if (!ok) return;

    try {
      await deleteDoc(
        doc(db, SCHOOL_CLASSES_COLLECTION, cls.id)
      );
      setSuccess("Class-ka waa la tirtiray.");
      if (editing?.id === cls.id) reset();
    } catch (err) {
      setError(err.message || "Failed to delete class.");
    }
  }

  const card = (cls) => {
    const custom = cls.source === "custom";

    return (
      <div
        key={`${cls.source || "default"}-${cls.id}`}
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 18,
          boxShadow: "0 8px 24px rgba(15,23,42,.06)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "0 auto 0 0",
            width: 4,
            background:
              cls.level === "Elementary"
                ? "#16a34a"
                : cls.level === "Intermediate"
                ? "#2563eb"
                : "#64748b",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 11 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                display: "grid",
                placeItems: "center",
                background: "#ecfdf5",
                color: "#047857",
                flex: "0 0 auto",
              }}
            >
              <BookOpen size={19} />
            </div>

            <div>
              <strong
                style={{
                  display: "block",
                  fontSize: 15,
                  color: "#0f172a",
                }}
              >
                {cls.name}
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                {cls.level
                  ? `${cls.level} • Section ${cls.section}`
                  : cls.so || "School class"}
              </span>
            </div>
          </div>

          {custom ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: "5px 8px",
                borderRadius: 999,
                background: "#eff6ff",
                color: "#1d4ed8",
              }}
            >
              CUSTOM
            </span>
          ) : (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: "5px 8px",
                borderRadius: 999,
                background: "#f1f5f9",
                color: "#475569",
              }}
            >
              DEFAULT
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
          }}
        >
          {custom && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => startEdit(cls)}
            >
              <Edit3 size={14} /> Edit
            </button>
          )}

          {custom && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => removeClass(cls)}
              style={{ color: "#dc2626" }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1250,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 18,
            marginBottom: 22,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 999,
                background: "#ecfdf5",
                color: "#047857",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <Layers3 size={15} />
              CLASS MANAGEMENT
            </div>

            <h1
              style={{
                margin: "10px 0 5px",
                fontSize: 30,
                color: "#0f172a",
              }}
            >
              School Classes
            </h1>

            <p
              style={{
                margin: 0,
                color: "#64748b",
              }}
            >
              Samee oo maamul Class A/B/C/D ee Elementary iyo
              Intermediate.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "12px 15px",
              borderRadius: 15,
              background: "#fff",
              border: "1px solid #e2e8f0",
            }}
          >
            <UsersRound size={18} />
            <div>
              <strong style={{ display: "block" }}>
                {classes.length}
              </strong>
              <span
                style={{
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                Available classes
              </span>
            </div>
          </div>
        </div>

        {(error || success) && (
          <div
            style={{
              marginBottom: 18,
              padding: "12px 14px",
              borderRadius: 13,
              background: error ? "#fef2f2" : "#ecfdf5",
              color: error ? "#b91c1c" : "#047857",
              border: `1px solid ${
                error ? "#fecaca" : "#bbf7d0"
              }`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle2 size={17} />
            {error || success}
          </div>
        )}

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 22,
            padding: 22,
            marginBottom: 28,
            boxShadow: "0 10px 30px rgba(15,23,42,.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 19,
                  color: "#0f172a",
                }}
              >
                {editing ? "Edit Class" : "Create New Class"}
              </h2>
              <p
                style={{
                  margin: "5px 0 0",
                  fontSize: 13,
                  color: "#64748b",
                }}
              >
                Example: Class A English Elementary
              </p>
            </div>

            {editing && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={reset}
              >
                <X size={15} /> Cancel
              </button>
            )}
          </div>

          <form onSubmit={saveClass}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              <label>
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  Class Type
                </span>
                <select
                  value={form.level}
                  onChange={(e) =>
                    update("level", e.target.value)
                  }
                  style={{
                    width: "100%",
                    marginTop: 7,
                  }}
                >
                  {ENGLISH_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      English {level}
                    </option>
                  ))}
                  <option value="Other">
                    Other School Class
                  </option>
                </select>
              </label>

              {form.level !== "Other" ? (
                <label>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>
                    Section
                  </span>

                  <select
                    value={form.section}
                    onChange={(e) =>
                      update("section", e.target.value)
                    }
                    style={{
                      width: "100%",
                      marginTop: 7,
                    }}
                  >
                    {DEFAULT_SECTIONS.map((section) => (
                      <option key={section} value={section}>
                        Class {section}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      Class Name
                    </span>

                    <input
                      value={form.customName}
                      onChange={(e) =>
                        update(
                          "customName",
                          e.target.value
                        )
                      }
                      placeholder="e.g. Form 4 Science"
                      style={{
                        width: "100%",
                        marginTop: 7,
                      }}
                    />
                  </label>

                  <label>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      Description
                    </span>

                    <input
                      value={form.customDescription}
                      onChange={(e) =>
                        update(
                          "customDescription",
                          e.target.value
                        )
                      }
                      placeholder="Optional description"
                      style={{
                        width: "100%",
                        marginTop: 7,
                      }}
                    />
                  </label>
                </>
              )}
            </div>

            <div
              style={{
                marginTop: 15,
                padding: "12px 14px",
                borderRadius: 13,
                background: "#f8fafc",
                color: "#475569",
                fontSize: 13,
              }}
            >
              {form.level === "Other"
                ? `New class: ${form.customName || "—"}`
                : `New class: ${makeEnglishClass(
                    form.level,
                    form.section
                  ).name}`}
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={saving}
              >
                {editing ? (
                  <Save size={16} />
                ) : (
                  <Plus size={16} />
                )}
                {saving
                  ? "Saving..."
                  : editing
                  ? "Save Class"
                  : "Create Class"}
              </button>
            </div>
          </form>
        </div>

        <section style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 13,
            }}
          >
            <BookOpen size={18} />
            <h2
              style={{
                margin: 0,
                fontSize: 19,
              }}
            >
              English Classes
            </h2>
            <span
              style={{
                fontSize: 11,
                color: "#64748b",
              }}
            >
              A → D
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(270px, 1fr))",
              gap: 14,
            }}
          >
            {englishClasses.map(card)}
          </div>
        </section>

        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 13,
            }}
          >
            <Layers3 size={18} />
            <h2
              style={{
                margin: 0,
                fontSize: 19,
              }}
            >
              Other Classes
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(270px, 1fr))",
              gap: 14,
            }}
          >
            {otherClasses.map(card)}
          </div>
        </section>
      </div>
    </div>
  );
}
