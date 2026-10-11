import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const { encodeBase64, decodeBase64 } = naclUtil;

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function generateKeyPair() {
  const { publicKey, secretKey } = nacl.box.keyPair();
  return { publicKey: toHex(publicKey), secretKey: toHex(secretKey) };
}

export const KEY_SET_SIZE = 5;

export function generateKeySet(size = KEY_SET_SIZE) {
  return Array.from({ length: size }, () => generateKeyPair());
}

export function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function derivePublicKey(secretKeyHex) {
  const { publicKey } = nacl.box.keyPair.fromSecretKey(fromHex(secretKeyHex));
  return toHex(publicKey);
}

export function sealMessage(plaintext, targetPublicKeyHex) {
  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = new TextEncoder().encode(plaintext);
  const cipher = nacl.box(
    messageBytes,
    nonce,
    fromHex(targetPublicKeyHex),
    ephemeral.secretKey,
  );
  return {
    ciphertext: encodeBase64(cipher),
    nonce: encodeBase64(nonce),
    ephemeralPublicKey: toHex(ephemeral.publicKey),
    targetPublicKey: targetPublicKeyHex.toLowerCase(),
  };
}

export function unsealMessage(envelope, myPrivateKeyHex) {
  const cipher = decodeBase64(envelope.ciphertext);
  const nonce = decodeBase64(envelope.nonce);
  const plainBytes = nacl.box.open(
    cipher,
    nonce,
    fromHex(envelope.ephemeralPublicKey),
    fromHex(myPrivateKeyHex),
  );
  if (!plainBytes) return null;
  return new TextDecoder().decode(plainBytes);
}
