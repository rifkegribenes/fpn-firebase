import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { updateAuthUI } from './main.js'; 
import { config } from './config.js';

const app = initializeApp(config.firebase);
const auth = getAuth(app); 
let tokenClient = null;

window.firebaseAuth = getAuth(app);

const provider = new GoogleAuthProvider(); provider.addScope('https://www.googleapis.com/auth/drive');

let currentUser = null;

export function setCurrentUser(user) {
  currentUser = user;
}

export function getCurrentUser() {
  return currentUser;
}

/**
 * Setup login/logout buttons
 */
export function setupAuthUI() {
  const auth = window.firebaseAuth;
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      try {
        const result = await signInWithPopup(auth, provider);

        // The signed-in user info.
        const user = result.user;
        console.log('Logged in as', user.email);

        // Google Access Token with Drive scopes
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential.accessToken;
        console.log('Google Drive access token:', accessToken);

        window.googleDriveAccessToken = accessToken;

        // use this token to call Google Drive APIs directly:
        // fetch('https://www.googleapis.com/drive/v3/files', { headers: { Authorization: `Bearer ${accessToken}` } })

        setCurrentUser(user);
        updateAuthUI(user);

      } catch (error) {
        console.error('Login failed', error);
        alert('Login failed: ' + error.message);
      }
    });
  }
  if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));
}

export function initGoogleDriveAuth() {
  if (tokenClient) return; // already initialized

  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    console.warn('Google Identity Services not loaded yet');
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: config.GOOGLE_OAUTH_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: () => {}
  });

  console.log('Google Drive token client initialized');
}

export function getTokenClient() {
  return tokenClient;
}

export function listenAuthChanges(callback) {
    onAuthStateChanged(auth, async (user) => {
        callback(user);   
        updateAuthUI(user);
    });
}