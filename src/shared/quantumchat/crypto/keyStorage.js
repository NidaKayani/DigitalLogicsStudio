const KEYRING_PREFIX = "qc_keyring_";
const TOKEN_KEY = "qc_token";
const USER_KEY = "qc_user";
const SESSION_ID_KEY = "qc_session_id";

function keyringKey(userId) {
  return KEYRING_PREFIX + userId;
}

export function getKeyring(userId) {
  const raw = localStorage.getItem(keyringKey(userId));
  return raw ? JSON.parse(raw) : [];
}

export function addKeySetToRing(userId, keyPairs) {
  const ring = getKeyring(userId);
  const createdAt = Date.now();
  keyPairs.forEach(({ publicKey, secretKey }) => {
    ring.push({ publicKey: publicKey.toLowerCase(), secretKey, createdAt });
  });
  localStorage.setItem(keyringKey(userId), JSON.stringify(ring));
}

export function getCurrentKeySet(userId, size = 5) {
  const ring = getKeyring(userId);
  return ring.slice(-size);
}

export function findSecretKeyForPublicKey(userId, publicKeyHex) {
  if (!publicKeyHex) return null;
  const target = publicKeyHex.toLowerCase();
  const match = getKeyring(userId).find((k) => k.publicKey === target);
  return match ? match.secretKey : null;
}

export function hasKeyring(userId) {
  return getKeyring(userId).length > 0;
}

export function keyringMatchesPublishedKeys(userId, serverPublicKeys) {
  const serverKeys = (serverPublicKeys || [])
    .map((k) => String(k).toLowerCase())
    .filter(Boolean);
  if (!serverKeys.length) return false;
  return serverKeys.every((pub) => Boolean(findSecretKeyForPublicKey(userId, pub)));
}

export function getKeyringSyncStatus(userId, serverPublicKeys) {
  const serverKeys = (serverPublicKeys || [])
    .map((k) => String(k).toLowerCase())
    .filter(Boolean);
  if (!serverKeys.length) {
    return { status: "unknown", missingOnLocal: [], serverKeys: [], localMatchCount: 0 };
  }
  const missingOnLocal = serverKeys.filter(
    (pub) => !findSecretKeyForPublicKey(userId, pub),
  );
  const localMatchCount = serverKeys.length - missingOnLocal.length;
  if (localMatchCount === 0) {
    return { status: "mismatch", missingOnLocal, serverKeys, localMatchCount };
  }
  if (missingOnLocal.length > 0) {
    return { status: "partial", missingOnLocal, serverKeys, localMatchCount };
  }
  return { status: "synced", missingOnLocal: [], serverKeys, localMatchCount };
}

export function clearKeyring(userId) {
  localStorage.removeItem(keyringKey(userId));
}

export function saveSession(token, user, sessionId) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (sessionId) {
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    if (!user || typeof user !== "object" || !user.id) {
      clearSession();
      return null;
    }
    return user;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
}
