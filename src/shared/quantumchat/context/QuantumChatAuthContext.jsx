import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import client from "../api/client";
import { derivePublicKey, generateKeySet, KEY_SET_SIZE } from "../crypto/keys";
import {
  addKeySetToRing,
  clearKeyring,
  clearSession,
  getKeyringSyncStatus,
  getStoredUser,
  getToken,
  hasKeyring,
  keyringMatchesPublishedKeys,
  saveSession,
} from "../crypto/keyStorage";

const QuantumChatAuthContext = createContext(null);

function clearOtherAccountKeyring(loggedInUserId) {
  const previous = getStoredUser();
  if (previous?.id && String(previous.id) !== String(loggedInUserId)) {
    clearKeyring(previous.id);
  }
}

export function QuantumChatAuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [keyringSync, setKeyringSync] = useState(null);

  const recomputeKeyringSync = useCallback((nextUser) => {
    if (!nextUser?.id || !nextUser.publicKeys?.length) {
      setKeyringSync(null);
      return null;
    }
    const sync = getKeyringSyncStatus(nextUser.id, nextUser.publicKeys);
    setKeyringSync(sync);
    return sync;
  }, []);

  const refreshUserFromServer = useCallback(async () => {
    if (!getToken()) return null;
    const { data } = await client.get("/auth/me");
    const freshUser = data.data?.user;
    if (!freshUser) return null;
    const nextToken = data.data?.token || getToken();
    saveSession(nextToken, freshUser, data.data?.sessionId);
    setUser(freshUser);
    recomputeKeyringSync(freshUser);
    return freshUser;
  }, [recomputeKeyringSync]);

  useEffect(() => {
    if (!user?.id || !getToken()) {
      setKeyringSync(null);
      return undefined;
    }
    recomputeKeyringSync(user);
    let cancelled = false;
    refreshUserFromServer().catch((err) => {
      if (cancelled) return;
      if (err?.response?.status === 401) {
        clearSession();
        setUser(null);
        setKeyringSync(null);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const register = useCallback(
    async ({ username, email, password }) => {
      const keySet = generateKeySet();
      const publicKeys = keySet.map((k) => k.publicKey);
      try {
        const probeKey = `qc_keyring_probe_${Date.now()}`;
        localStorage.setItem(probeKey, "1");
        localStorage.removeItem(probeKey);
      } catch (err) {
        throw new Error(`Cannot save keys to localStorage: ${err.message}`);
      }

      const { data } = await client.post("/auth/register", {
        username,
        email,
        password,
        publicKeys,
      });
      const { token, user: newUser } = data.data;
      try {
        addKeySetToRing(newUser.id, keySet);
      } catch {
        throw new Error(
          "Account was created but encryption keys could not be saved on this device. Log in and import keys or generate new keys.",
        );
      }
      saveSession(token, newUser);
      setUser(newUser);
      recomputeKeyringSync(newUser);
      return { user: newUser, keySet };
    },
    [recomputeKeyringSync],
  );

  const login = useCallback(async ({ email, password, rememberMe = true }) => {
    const deviceLabel = String(navigator.userAgent || "").slice(0, 120);
    const { data } = await client.post("/auth/login", {
      email,
      password,
      deviceLabel,
      rememberMe,
    });
    if (data.data?.requires2fa) {
      return {
        requires2fa: true,
        tempToken: data.data.tempToken,
        rememberMe: data.data.rememberMe !== false,
      };
    }
    const { token, user: loggedInUser, sessionId } = data.data;
    clearOtherAccountKeyring(loggedInUser.id);
    saveSession(token, loggedInUser, sessionId);
    setUser(loggedInUser);
    recomputeKeyringSync(loggedInUser);
    return loggedInUser;
  }, [recomputeKeyringSync]);

  const verify2fa = useCallback(
    async ({ tempToken, token, rememberMe = true }) => {
      const deviceLabel = String(navigator.userAgent || "").slice(0, 120);
      const { data } = await client.post("/auth/2fa/verify", {
        tempToken,
        token,
        deviceLabel,
        rememberMe,
      });
      const { token: jwt, user: loggedInUser, sessionId } = data.data;
      clearOtherAccountKeyring(loggedInUser.id);
      saveSession(jwt, loggedInUser, sessionId);
      setUser(loggedInUser);
      recomputeKeyringSync(loggedInUser);
      return loggedInUser;
    },
    [recomputeKeyringSync],
  );

  const regenerateKeys = useCallback(async () => {
    if (!user) throw new Error("Not authenticated");
    const keySet = generateKeySet();
    const publicKeys = keySet.map((k) => k.publicKey);
    addKeySetToRing(user.id, keySet);
    const { data } = await client.patch("/users/me/public-keys", { publicKeys });
    saveSession(getToken(), data.data);
    setUser(data.data);
    recomputeKeyringSync(data.data);
    return { user: data.data, keySet };
  }, [user, recomputeKeyringSync]);

  const importKeys = useCallback(
    async (secretKeys) => {
      if (!user) throw new Error("Not authenticated");
      if (secretKeys.length !== KEY_SET_SIZE) {
        throw new Error(
          `Expected ${KEY_SET_SIZE} keys in the file, found ${secretKeys.length}`,
        );
      }
      const freshUser = (await refreshUserFromServer()) || user;
      const accountKeys = new Set(
        (freshUser.publicKeys || []).map((k) => k.toLowerCase()),
      );
      const keySet = secretKeys.map((secretKey) => ({
        secretKey,
        publicKey: derivePublicKey(secretKey),
      }));
      const unmatched = keySet.filter(
        (k) => !accountKeys.has(k.publicKey.toLowerCase()),
      );
      if (unmatched.length > 0) {
        throw new Error(
          "These keys don't match this account — wrong file, or keys were regenerated since it was saved.",
        );
      }
      addKeySetToRing(freshUser.id, keySet);
      recomputeKeyringSync(freshUser);
      setUser({ ...freshUser });
    },
    [user, refreshUserFromServer, recomputeKeyringSync],
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setKeyringSync(null);
  }, []);

  const hasLocalKeyring = user
    ? user.publicKeys?.length
      ? keyringMatchesPublishedKeys(user.id, user.publicKeys)
      : hasKeyring(user.id)
    : false;

  const value = useMemo(
    () => ({
      user,
      register,
      login,
      verify2fa,
      logout,
      regenerateKeys,
      importKeys,
      hasLocalKeyring,
      keyringSync,
      refreshUserFromServer,
    }),
    [
      user,
      register,
      login,
      verify2fa,
      logout,
      regenerateKeys,
      importKeys,
      hasLocalKeyring,
      keyringSync,
      refreshUserFromServer,
    ],
  );

  return (
    <QuantumChatAuthContext.Provider value={value}>
      {children}
    </QuantumChatAuthContext.Provider>
  );
}

export function useQuantumChatAuth() {
  const ctx = useContext(QuantumChatAuthContext);
  if (!ctx) {
    throw new Error("useQuantumChatAuth must be used within QuantumChatAuthProvider");
  }
  return ctx;
}
