// This Firebase project (one-click-onilne) is shared with other apps that
// already have their own "students", "teachers" and "attendance"
// collections (visible in the Firestore console). To avoid ever touching
// or colliding with that unrelated data, this school system uses its own,
// clearly-separate collection names — change them here in one place if
// you ever need to.
export const STUDENTS_COLLECTION = "students1";
export const TEACHERS_COLLECTION = "teacher1";
export const ATTENDANCE_COLLECTION = "rssAttendance";
export const ATTENDANCE_SESSIONS_COLLECTION = "rssAttendanceSessions";
export const COUNTERS_COLLECTION = "rssCounters";
