import client from "../api/client";
import {
  findSecretKeyForPublicKey,
  getCurrentKeySet,
} from "../crypto/keyStorage";
import { pickRandom, sealMessage, unsealMessage } from "../crypto/keys";

function asUserArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.friends)) return payload.friends;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function asMessageArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.messages)) return payload.messages;
  return [];
}

export async function fetchFriends() {
  const { data } = await client.get("/users/friends");
  return asUserArray(data?.data);
}

export async function fetchDiscoverUsers(query = "") {
  const { data } = await client.get("/users/discover", {
    params: query ? { q: query } : undefined,
  });
  return asUserArray(data?.data);
}

export async function fetchUser(userId) {
  const { data } = await client.get(`/users/${userId}`);
  return data?.data || null;
}

export async function fetchConversation(peerId, { limit = 80 } = {}) {
  const { data } = await client.get(`/messages/${peerId}`, {
    params: { limit, markRead: "1" },
  });
  return asMessageArray(data?.data);
}

export function decryptMessage(raw, myUserId) {
  const isMine = String(raw.from) === String(myUserId);
  const envelope = isMine ? raw.forSender : raw.forRecipient;
  if (!envelope?.targetPublicKey) {
    return { ...raw, id: raw.id || raw._id, text: null };
  }
  const mySecretKey = findSecretKeyForPublicKey(myUserId, envelope.targetPublicKey);
  const text = mySecretKey ? unsealMessage(envelope, mySecretKey) : null;
  return {
    ...raw,
    id: raw.id || raw._id,
    text,
  };
}

export async function sendDirectMessage({ myUserId, peer, text }) {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("Message cannot be empty");
  if (!peer?.id && !peer?._id) throw new Error("No recipient selected");

  const peerId = peer.id || peer._id;
  let recipient = peer;
  if (!recipient.publicKeys?.length) {
    recipient = (await fetchUser(peerId)) || recipient;
  }

  const myKey = pickRandom(getCurrentKeySet(myUserId));
  const recipientKeys = (recipient.publicKeys || []).filter(Boolean);
  if (!myKey?.publicKey || recipientKeys.length === 0) {
    throw new Error("Missing encryption keys for this conversation");
  }

  const forRecipient = sealMessage(trimmed, pickRandom(recipientKeys));
  const forSender = sealMessage(trimmed, myKey.publicKey);
  const { data } = await client.post("/messages", {
    to: peerId,
    forRecipient,
    forSender,
  });
  return data?.data;
}
