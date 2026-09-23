import { AUTH_API_BASE_URL } from "./config.js";

export function isAuthConfigured(baseUrl = AUTH_API_BASE_URL) {
  try {
    const url = new URL(baseUrl);
    return url.protocol === "https:" && url.pathname === "/" && !url.search && !url.hash;
  } catch { return false; }
}

export function createProofVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64url(bytes);
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function proofChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function parseAuthCallback(callbackUrl, expectedRedirect) {
  if (!callbackUrl) throw new Error("GitHub sign-in was canceled.");
  const actual = new URL(callbackUrl);
  const expected = new URL(expectedRedirect);
  if (actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.hash) {
    throw new Error("GitHub sign-in returned to an unexpected address.");
  }
  const error = actual.searchParams.get("error");
  if (error) throw new Error(error === "access_denied" ? "GitHub authorization was declined." : "GitHub sign-in could not be completed. Try again.");
  const ticket = actual.searchParams.get("ticket");
  if (!ticket || !/^[A-Za-z0-9_-]{32,}$/.test(ticket)) throw new Error("GitHub sign-in did not return a valid ticket.");
  return ticket;
}

function tokenSession(result) {
  if (!result.access_token || result.token_type?.toLowerCase() !== "bearer") {
    throw new Error("The sign-in service did not return a usable GitHub session.");
  }
  const expiresIn = Number(result.expires_in);
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token || null,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : null,
  };
}

async function post(path, body, baseUrl) {
  if (!isAuthConfigured(baseUrl)) throw new Error("The sign-in service is not configured yet.");
  let response;
  try {
    response = await fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch { throw new Error("Cannot reach the sign-in service. Check your connection and try again."); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.detail || "GitHub sign-in could not be completed. Try again.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function signInWithGithub(identity = chrome.identity, baseUrl = AUTH_API_BASE_URL) {
  const redirectUri = identity.getRedirectURL("github");
  const proofVerifier = createProofVerifier();
  const { authorization_url: authorizationUrl } = await post("auth/github/start", {
    redirect_uri: redirectUri,
    proof_challenge: await proofChallenge(proofVerifier),
  }, baseUrl);
  const authorization = new URL(authorizationUrl);
  if (authorization.origin !== "https://github.com" || authorization.pathname !== "/login/oauth/authorize") {
    throw new Error("The sign-in service returned an unexpected GitHub address.");
  }
  let callbackUrl;
  try { callbackUrl = await identity.launchWebAuthFlow({ url: authorization.href, interactive: true }); }
  catch (error) {
    if (/cancel|closed|denied/i.test(error.message || "")) throw new Error("GitHub sign-in was canceled.");
    throw new Error("GitHub sign-in window could not complete. Try again.");
  }
  const ticket = parseAuthCallback(callbackUrl, redirectUri);
  const result = await post("auth/github/redeem", { ticket, proof_verifier: proofVerifier }, baseUrl);
  return tokenSession(result);
}

export async function refreshGithubToken(refreshToken, baseUrl = AUTH_API_BASE_URL) {
  if (!refreshToken) throw new Error("Sign in to GitHub again.");
  return tokenSession(await post("auth/github/refresh", { refresh_token: refreshToken }, baseUrl));
}
