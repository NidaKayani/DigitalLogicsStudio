export function formatKeyFile({ username, email, secretKeys }) {
  return [
    "QuantumChat Private Keys",
    `Account: ${email} (${username})`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "KEEP THIS FILE SECRET. Anyone who has it can read your messages.",
    "To use QuantumChat on another device or browser, log in there and",
    "upload this file when asked for your private keys.",
    "",
    ...secretKeys,
    "",
  ].join("\n");
}

export function parseKeyFile(text) {
  const matches = text.match(/\b[0-9a-f]{64}\b/gi) || [];
  return matches.map((k) => k.toLowerCase());
}

export function downloadKeyFile(content, filename = "keys.txt") {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
