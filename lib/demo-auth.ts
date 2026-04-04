// Demo auth – used when Supabase is not configured (placeholder URL).
// Stores users in localStorage and sets a cookie for middleware.

const USERS_KEY = "demo_users";
const SESSION_KEY = "demo_session";
export const DEMO_COOKIE = "demo_session";

export function isDemoMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url === "" || url.includes("your-project.supabase.co");
}

interface DemoUser {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

interface DemoSession {
  user: DemoUser;
  token: string;
}

function getUsers(): Record<string, DemoUser & { password: string }> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, DemoUser & { password: string }>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function demoRegister(
  email: string,
  password: string,
  fullName: string
): { error?: string } {
  const users = getUsers();
  if (users[email]) return { error: "An account with this email already exists." };
  const user: DemoUser & { password: string } = {
    id: crypto.randomUUID(),
    email,
    full_name: fullName,
    created_at: new Date().toISOString(),
    password,
  };
  users[email] = user;
  saveUsers(users);
  return {};
}

export function demoLogin(
  email: string,
  password: string
): { session?: DemoSession; error?: string } {
  const users = getUsers();
  const user = users[email];
  if (!user) return { error: "No account found with this email." };
  if (user.password !== password) return { error: "Incorrect password." };
  const session: DemoSession = {
    user: { id: user.id, email: user.email, full_name: user.full_name, created_at: user.created_at },
    token: btoa(`${email}:${Date.now()}`),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Set cookie so middleware can detect the session
  document.cookie = `${DEMO_COOKIE}=${session.token}; path=/; max-age=86400`;
  return { session };
}

export function demoLogout() {
  localStorage.removeItem(SESSION_KEY);
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0`;
}

export function getDemoSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
