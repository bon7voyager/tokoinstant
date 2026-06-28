import "server-only";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function baseUrl() {
  return (
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function googleRedirectUri() {
  return `${baseUrl()}/api/auth/google/callback`;
}

export function getGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleProfile = { email: string; name: string; emailVerified: boolean };

/** Exchange the auth code for the user's verified profile. Returns null on any failure. */
export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
      signal: controller.signal,
    });
    if (!tokenRes.ok) return null;
    const tokens = await tokenRes.json();
    const accessToken = tokens?.access_token;
    if (!accessToken) return null;

    const infoRes = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!infoRes.ok) return null;
    const info = await infoRes.json();
    if (!info?.email) return null;

    return {
      email: String(info.email).toLowerCase().trim(),
      name: (info.name && String(info.name).trim()) || String(info.email).split("@")[0],
      emailVerified: info.verified_email === true || info.email_verified === true,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
