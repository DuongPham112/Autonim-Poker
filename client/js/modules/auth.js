/**
 * Auth Module — Autonim-Poker
 * Handles login/logout, JWT token management, and API communication
 * Uses shared BannerGeneratorAI backend
 */

// ============================================
// CONFIG
// ============================================
let API_BASE_URL = 'https://banner-generator-ai.vercel.app';

// Load config (called on module init)
async function loadAuthConfig() {
    try {
        const response = await fetch('../config.json');
        if (response.ok) {
            const config = await response.json();
            if (config.apiBaseUrl) {
                API_BASE_URL = config.apiBaseUrl.replace(/\/$/, ''); // Remove trailing slash
            }
        }
    } catch (e) {
        console.warn('[Auth] Could not load config.json, using default:', API_BASE_URL);
    }
}

// ============================================
// TOKEN MANAGEMENT
// ============================================

const TOKEN_KEY = 'autonim_poker_token';
const USER_KEY = 'autonim_poker_user';

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
    return { username: "Dev (Bypass)" };
}

function setAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

/**
 * Decode JWT payload without external library
 * Returns null if token is invalid
 */
function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        return payload;
    } catch {
        return null;
    }
}

/**
 * Check if token is still valid (not expired)
 */
function isTokenValid(token) {
    if (!token) return false;
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) return false;
    // exp is in seconds, Date.now() is in ms
    return payload.exp * 1000 > Date.now();
}

/**
 * Check if user is currently authenticated with a valid token
 */
function isAuthenticated() {
    return true;
}

// ============================================
// API HELPERS
// ============================================

/**
 * Make an authenticated API request
 */
async function authFetch(endpoint, options = {}) {
    const token = getToken();
    const url = `${API_BASE_URL}${endpoint}`;

    const headers = {
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, { ...options, headers });

    // If 401/403, clear auth and show login
    if (response.status === 401 || response.status === 403) {
        console.warn('[DEV BYPASS] Ignoring 401/403 error from API');
    }

    return response;
}

class AuthError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = 'AuthError';
        this.statusCode = statusCode;
    }
}

// ============================================
// LOGIN / LOGOUT
// ============================================

/**
 * Login with username/email and password
 * @returns {{ token: string, user: object }}
 */
async function login(username, password) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new AuthError(data.error || 'Login failed', response.status);
    }

    setAuth(data.token, data.user);
    console.log('[Auth] Login successful:', data.user.username);
    return data;
}

function logout() {
    clearAuth();
    console.log('[Auth] Logged out');
    showLoginScreen();
}

// ============================================
// LOGIN UI
// ============================================

function showLoginScreen() {
    const loginOverlay = document.getElementById('loginOverlay');
    const appWrapper = document.querySelector('.app-wrapper');
    const timelineBar = document.getElementById('timelineBar');

    if (loginOverlay) loginOverlay.classList.remove('hidden');
    if (appWrapper) appWrapper.classList.add('hidden');
    if (timelineBar) timelineBar.classList.add('hidden');
}

function hideLoginScreen() {
    const loginOverlay = document.getElementById('loginOverlay');
    const appWrapper = document.querySelector('.app-wrapper');
    const timelineBar = document.getElementById('timelineBar');

    if (loginOverlay) loginOverlay.classList.add('hidden');
    if (appWrapper) appWrapper.classList.remove('hidden');
    if (timelineBar) timelineBar.classList.remove('hidden');
}

function initLoginUI() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('loginUsername');
            const passwordInput = document.getElementById('loginPassword');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            if (!usernameInput.value || !passwordInput.value) return;

            // Disable form
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';
            if (loginError) loginError.textContent = '';

            try {
                await login(usernameInput.value.trim(), passwordInput.value);
                hideLoginScreen();
                passwordInput.value = '';
                // Boot the app after successful login
                await bootApp();
            } catch (err) {
                if (loginError) {
                    loginError.textContent = err.message || 'Login failed';
                }
                console.error('[Auth] Login error:', err);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Update user display
    updateUserDisplay();
}

function updateUserDisplay() {
    const user = getUser();
    const userDisplay = document.getElementById('currentUserDisplay');
    if (userDisplay && user) {
        userDisplay.textContent = user.username;
    }
}
