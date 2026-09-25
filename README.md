# Rising Star School — React + Firebase

Three portals (Admin / Teacher / Student) on your Firebase project
(`one-click-onilne`), with its own clearly-separate collections so it never
touches the unrelated data already in that project (another app there
already uses `students`, `teachers`, and `attendance`).

## Setup
```bash
npm install
npm run dev
```
Open http://localhost:5173

## Collections this app uses (see `src/config/collections.js`)
- `students1` — student records (was `students` — renamed to avoid the
  collision with the other app's existing `students` collection)
- `teacher1` — teacher records (was `teachers` — same reason)
- `rssAttendance` — one doc per student per day: `{studentId}_{date}`
- `rssAttendanceSessions` — one lock doc per teacher per day, so a teacher
  can only submit attendance once per day
- `rssCounters` — the atomic ID counters for `students1`/`teacher1`
- `admin` — untouched, your existing admin login collection

If you ever want different names, change them in one place:
`src/config/collections.js`.

## What's new in this pass

- **UI redesign** — Poppins/Inter Google Fonts, green/gold palette matching
  the logo, rounded cards with soft shadows, pill-style status badges
  (Present/Absent), toggle buttons instead of raw radio inputs, round
  avatar photos in every table, a nicer 2-column registration form.
- **Optional student photo** — the registration form now has a photo picker
  (with live preview). If a photo is chosen it's uploaded to **Firebase
  Storage** under `student-photos/{studentId}` and the download URL is
  saved as `photoUrl` on the student doc. It's optional — leave it blank
  and registration still works.
- **Renamed collections** — see above. Nothing is ever written to the
  original `students`/`teachers` collections anymore.
- **Admin → Attendance tab** — the admin can now see every attendance
  record across all students/teachers/dates, with the student's name
  filled in and a colored Present/Absent pill.
- **Login bug fix (from before)** — admin can sign in with username or
  email; Firestore's own `role` field no longer overwrites the app's role.

## Login reference
- **Admin:** username `admin` (or the email) + the password from Firestore.
- **Teacher:** the `username`/password shown when the admin registers them
  (`teacher1`, `teacher2`, ...) in the Teachers tab.
- **Student:** their Student ID (`000`, `001`, ...) + the password shown
  when the admin registers them in the Students tab.

## ⚠️ Two things to check in the Firebase console
1. **Firestore Rules** — make sure only the right role can read/write each
   collection (`students1`, `teacher1`, `rssAttendance`,
   `rssAttendanceSessions`, `rssCounters`).
2. **Storage Rules** — since student photos now upload to Firebase Storage,
   make sure Storage is enabled for this project and its rules allow writes
   from your app (e.g. authenticated, or open during testing — just not
   left open in production).

## ⚠️ Security — still applies
Passwords (admin, teacher, student) are stored as plain text in Firestore.
I'd still recommend migrating to Firebase Authentication when you're ready
— happy to do that migration whenever you'd like.
