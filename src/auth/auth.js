require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ─── Shared constants ────────────────────────────────────────────────────────

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

// ─── Interactive (PKCE) token state ──────────────────────────────────────────

const INTERACTIVE_CLIENT_ID = 'ea0616ba-638b-4df5-95b9-636659ae5121';
const INTERACTIVE_SCOPE = 'https://analysis.windows.net/powerbi/api/.default offline_access';

let interactiveState = null; // { accessToken, refreshToken, expiresAt }

/**
 * Called after a successful PKCE login or when loading a saved interactive workspace.
 */
function setInteractiveTokens(accessToken, refreshToken, expiresIn) {
  const expiresAt = Date.now() + (expiresIn || 3600) * 1000;
  interactiveState = { accessToken, refreshToken, expiresAt };
  tokenCache.accessToken = accessToken;
  tokenCache.expiresAt = expiresAt;
  console.log('[auth] Interactive tokens set, expires at', new Date(expiresAt).toISOString());
}

async function interactiveRefresh() {
  if (!interactiveState?.refreshToken) {
    throw Object.assign(
      new Error('AUTH_FAILED: No refresh token available for interactive mode'),
      { code: 'AUTH_FAILED' }
    );
  }

  const res = await axios.post(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    new URLSearchParams({
      client_id: INTERACTIVE_CLIENT_ID,
      grant_type:    'refresh_token',
      refresh_token: interactiveState.refreshToken,
      scope:         INTERACTIVE_SCOPE,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, refresh_token, expires_in } = res.data;
  const expiresAt = Date.now() + expires_in * 1000;

  interactiveState = {
    accessToken:  access_token,
    refreshToken: refresh_token || interactiveState.refreshToken,
    expiresAt,
  };
  tokenCache.accessToken = access_token;
  tokenCache.expiresAt   = expiresAt;

  console.log('[auth] Interactive token refreshed, expires at', new Date(expiresAt).toISOString());
  return access_token;
}

// ─── Device Code constants ────────────────────────────────────────────────────

const DC_CLIENT_ID    = 'ea0616ba-638b-4df5-95b9-636659ae5121';
const RESOURCE        = 'https://analysis.windows.net/powerbi/api';
const DC_TOKEN_URL    = 'https://login.microsoftonline.com/common/oauth2/token';
const DEVICE_CODE_URL = 'https://login.microsoftonline.com/common/oauth2/devicecode';
const AUTH_DIR        = path.resolve(process.env.SEMANTICA_DATA_DIR || process.cwd(), '.auth');
const TOKEN_FILE      = path.join(AUTH_DIR, 'token.json');
const POLL_INTERVAL_MS = 5000;

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

function loadTokenFile() {
  try {
    if (fs.existsSync(TOKEN_FILE)) return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch { /* ignore */ }
  return null;
}

function saveTokenFile(accessToken, refreshToken, expiresAt) {
  ensureAuthDir();
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({
    refresh_token: refreshToken,
    expires_at:    expiresAt,
  }, null, 2), 'utf8');
}

async function refreshWithToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     DC_CLIENT_ID,
    resource:      RESOURCE,
    refresh_token: refreshToken,
  });

  const res = await axios.post(DC_TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const { access_token, refresh_token, expires_in } = res.data;
  const expiresAt = Date.now() + expires_in * 1000;

  tokenCache.accessToken = access_token;
  tokenCache.expiresAt   = expiresAt;

  saveTokenFile(access_token, refresh_token, new Date(expiresAt).toISOString());
  console.log('[auth] Token refreshed, expires at', new Date(expiresAt).toISOString());
  return access_token;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function deviceCodeFlow() {
  const params = new URLSearchParams({ client_id: DC_CLIENT_ID, resource: RESOURCE });
  const dcRes  = await axios.post(DEVICE_CODE_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const { device_code, user_code, verification_url, expires_in } = dcRes.data;

  console.log('\n─────────────────────────────────────');
  console.log('ACTION REQUIRED — Fabric Authentication');
  console.log(`Open: ${verification_url}`);
  console.log(`Code: ${user_code}`);
  console.log('Complete MFA in browser then return here');
  console.log('Waiting...\n─────────────────────────────────────\n');

  const deadline = Date.now() + expires_in * 1000;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const pollParams = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id:  DC_CLIENT_ID,
        resource:   RESOURCE,
        code:       device_code,
      });
      const pollRes = await axios.post(DC_TOKEN_URL, pollParams.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const { access_token, refresh_token, expires_in: expiresIn } = pollRes.data;
      const expiresAt = Date.now() + expiresIn * 1000;
      tokenCache.accessToken = access_token;
      tokenCache.expiresAt   = expiresAt;
      saveTokenFile(access_token, refresh_token, new Date(expiresAt).toISOString());
      console.log('✓ Authenticated successfully');
      return access_token;
    } catch (err) {
      const code = err.response?.data?.error;
      if (code === 'authorization_pending') continue;
      if (code === 'slow_down') { await sleep(POLL_INTERVAL_MS); continue; }
      throw Object.assign(
        new Error(`AUTH_FAILED: ${err.response?.data?.error_description || err.message}`),
        { code: 'AUTH_FAILED' }
      );
    }
  }
  throw Object.assign(new Error('AUTH_FAILED: Device code flow timed out'), { code: 'AUTH_FAILED' });
}

// ─── Service Principal flow ───────────────────────────────────────────────────

async function servicePrincipalFlow() {
  const tenantId     = process.env.FABRIC_TENANT_ID;
  const clientId     = process.env.FABRIC_CLIENT_ID;
  const clientSecret = process.env.FABRIC_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw Object.assign(
      new Error('AUTH_FAILED: AUTH_MODE=service_principal requires FABRIC_TENANT_ID, FABRIC_CLIENT_ID, FABRIC_CLIENT_SECRET'),
      { code: 'AUTH_FAILED' }
    );
  }

  const res = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSecret,
      scope:         'https://analysis.windows.net/powerbi/api/.default',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, expires_in } = res.data;
  const expiresAt = Date.now() + expires_in * 1000;
  tokenCache.accessToken = access_token;
  tokenCache.expiresAt   = expiresAt;

  console.log('✓ Service Principal authenticated, expires at', new Date(expiresAt).toISOString());
  return access_token;
}

// ─── Public API ───────────────────────────────────────────────────────────────

function currentMode() {
  return (process.env.AUTH_MODE || 'device_code').toLowerCase();
}

/**
 * Initialize auth — call on server start, blocks until authenticated.
 */
async function initAuth() {
  const mode = currentMode();

  if (mode === 'service_principal') {
    return await servicePrincipalFlow();
  }

  if (mode === 'interactive') {
    // Tokens must already be set by setInteractiveTokens() before initAuth is called.
    if (!interactiveState) {
      throw Object.assign(
        new Error('AUTH_FAILED: interactive mode requires tokens to be set first'),
        { code: 'AUTH_FAILED' }
      );
    }
    if (Date.now() < interactiveState.expiresAt - REFRESH_BUFFER_MS) {
      tokenCache.accessToken = interactiveState.accessToken;
      tokenCache.expiresAt   = interactiveState.expiresAt;
      return interactiveState.accessToken;
    }
    return await interactiveRefresh();
  }

  // device_code (default / legacy)
  ensureAuthDir();
  const saved = loadTokenFile();
  if (saved?.refresh_token) {
    try {
      console.log('[auth] Found saved refresh token, attempting silent refresh...');
      return await refreshWithToken(saved.refresh_token);
    } catch {
      console.log('[auth] Refresh failed, starting device code flow...');
    }
  }
  return await deviceCodeFlow();
}

/**
 * Get current access token. Auto-refreshes if near expiry.
 */
async function getToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - REFRESH_BUFFER_MS) {
    return tokenCache.accessToken;
  }

  const mode = currentMode();

  if (mode === 'interactive') return await interactiveRefresh();
  if (mode === 'service_principal') return await servicePrincipalFlow();

  // device_code
  const saved = loadTokenFile();
  if (saved?.refresh_token) {
    try { return await refreshWithToken(saved.refresh_token); }
    catch { return await deviceCodeFlow(); }
  }
  return await deviceCodeFlow();
}

/**
 * Force refresh — called when Fabric returns 401.
 */
async function forceRefresh() {
  tokenCache.accessToken = null;
  tokenCache.expiresAt   = 0;

  const mode = currentMode();

  if (mode === 'interactive') return await interactiveRefresh();
  if (mode === 'service_principal') return await servicePrincipalFlow();

  const saved = loadTokenFile();
  if (saved?.refresh_token) {
    try { return await refreshWithToken(saved.refresh_token); }
    catch { return await deviceCodeFlow(); }
  }
  return await deviceCodeFlow();
}

function getTokenInfo() {
  return {
    status:    tokenCache.accessToken ? 'valid' : 'none',
    expiresAt: tokenCache.expiresAt ? new Date(tokenCache.expiresAt).toISOString() : null,
    mode:      currentMode(),
  };
}

module.exports = { initAuth, getToken, forceRefresh, getTokenInfo, setInteractiveTokens };
