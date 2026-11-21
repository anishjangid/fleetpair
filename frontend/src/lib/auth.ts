export type HubUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  hub: string;
  avatarInitials: string;
};

const DEMO_USERS: Array<HubUser & { password: string }> = [
  {
    id: "u1",
    name: "Ananya Rao",
    email: "ananya@indiranagar.hub",
    password: "fleetpair",
    role: "Hub manager",
    hub: "Indiranagar Hub",
    avatarInitials: "AR",
  },
  {
    id: "u2",
    name: "Ops Desk",
    email: "ops@fleetpair.app",
    password: "fleetpair",
    role: "Fleet ops",
    hub: "City control",
    avatarInitials: "OD",
  },
];

const STORAGE_KEY = "fleetpair.session";

export function authenticate(email: string, password: string): HubUser | null {
  const found = DEMO_USERS.find(
    (u) =>
      u.email.toLowerCase() === email.trim().toLowerCase() &&
      u.password === password,
  );
  if (!found) return null;
  const { password: _, ...user } = found;
  return user;
}

export function saveSession(user: HubUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function readSession(): HubUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HubUser;
  } catch {
    return null;
  }
}

export const DEMO_CREDENTIALS = {
  email: "ananya@indiranagar.hub",
  password: "fleetpair",
};
