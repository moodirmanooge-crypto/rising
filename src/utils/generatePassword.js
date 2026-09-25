// Simple readable auto-generated password (6 digits), used for students
// and teachers created by the admin. Shown once on screen after creation
// so the admin can hand it to the person — there is no "forgot password"
// flow yet, so make sure it gets written down / shared before closing the
// confirmation message.
export function generatePassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
