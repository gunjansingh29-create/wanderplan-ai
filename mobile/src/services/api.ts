/**
 * WanderPlan AI – API service layer
 *
 * Thin wrapper around the WanderPlan backend so every screen
 * uses the same base URL and error handling.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE = process.env.REACT_APP_API_BASE ?? 'http://localhost:8000';
const SESSION_KEY = 'wanderplan.auth.session';
const AUTH_USERS_KEY = 'wanderplan.auth.users';
const PROFILE_KEY = 'wanderplan.profile.byEmail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface AuthSession {
  email: string;
  token?: string;
  expiresAt?: number;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  status: 'planning' | 'confirmed' | 'completed';
  coverPhoto?: string;
  budgetTotal?: number;
  groupSize?: number;
}

export interface BucketItem {
  id: string;
  destination: string;
  country?: string;
  photo?: string;
  notes?: string;
  addedAt: string;
  priority: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function getToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    return session.token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? {Authorization: `Bearer ${token}`} : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE}${path}`, {...options, headers});
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const detail =
      typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`${res.status}: ${detail}`);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signIn(
  email: string,
  password: string,
): Promise<AuthSession> {
  // Try local-only auth first (mirrors web app behaviour)
  const usersRaw = await AsyncStorage.getItem(AUTH_USERS_KEY);
  const users: Record<string, {passwordHash: string; name: string}> =
    usersRaw ? JSON.parse(usersRaw) : {};

  const user = users[email.toLowerCase()];
  if (!user) {
    throw new Error('No account found for that email.');
  }
  // NOTE: In production use a real password hash comparison (e.g. bcrypt via a
  // server endpoint). The web app stores a simple hash for local demo purposes.
  if (user.passwordHash !== simpleHash(password)) {
    throw new Error('Incorrect password.');
  }

  const session: AuthSession = {email: email.toLowerCase()};
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function signUp(
  email: string,
  password: string,
  name: string,
): Promise<AuthSession> {
  const usersRaw = await AsyncStorage.getItem(AUTH_USERS_KEY);
  const users: Record<string, {passwordHash: string; name: string}> =
    usersRaw ? JSON.parse(usersRaw) : {};

  const key = email.toLowerCase();
  if (users[key]) {
    throw new Error('An account with that email already exists.');
  }

  users[key] = {passwordHash: simpleHash(password), name};
  await AsyncStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));

  const session: AuthSession = {email: key};
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));

  // Save default profile
  const profilesRaw = await AsyncStorage.getItem(PROFILE_KEY);
  const profiles: Record<string, {name: string}> = profilesRaw
    ? JSON.parse(profilesRaw)
    : {};
  profiles[key] = {name};
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));

  return session;
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getProfile(
  email: string,
): Promise<{name: string} | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    const profiles: Record<string, {name: string}> = raw
      ? JSON.parse(raw)
      : {};
    return profiles[email] ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export async function listTrips(): Promise<Trip[]> {
  try {
    return await request<Trip[]>('/trips');
  } catch {
    // Return empty list when offline / server unavailable
    return [];
  }
}

export async function createTrip(data: Partial<Trip>): Promise<Trip> {
  return request<Trip>('/trips', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Bucket list
// ---------------------------------------------------------------------------

export async function listBucketItems(): Promise<BucketItem[]> {
  try {
    return await request<BucketItem[]>('/bucket-list');
  } catch {
    return [];
  }
}

export async function addBucketItem(
  destination: string,
  notes?: string,
): Promise<BucketItem> {
  return request<BucketItem>('/bucket-list', {
    method: 'POST',
    body: JSON.stringify({destination, notes, priority: 'medium'}),
  });
}

export async function removeBucketItem(id: string): Promise<void> {
  await request<void>(`/bucket-list/${id}`, {method: 'DELETE'});
}

// ---------------------------------------------------------------------------
// AI Trip Planner – streaming chat
// ---------------------------------------------------------------------------

export interface PlannerMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendPlannerMessage(
  messages: PlannerMessage[],
  onChunk: (chunk: string) => void,
): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/ai/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
    },
    body: JSON.stringify({messages}),
  });

  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, {stream: true});
    // SSE: lines prefixed with "data: "
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const payload = line.slice(6).trim();
        if (payload && payload !== '[DONE]') {
          try {
            const json = JSON.parse(payload);
            const text =
              json?.choices?.[0]?.delta?.content ?? json?.text ?? '';
            if (text) onChunk(text);
          } catch {
            onChunk(payload);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Very simple hash – matches the local-storage approach used in the web app. */
function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}
