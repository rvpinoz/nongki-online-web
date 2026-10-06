const LETTERS = "abcdefghijklmnopqrstuvwxyz";

function randomPart(length: number): string {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => LETTERS[v % LETTERS.length]).join("");
}

/** Membuat kode meeting seperti "abc-defg-hij". */
export function generateRoomId(): string {
  return `${randomPart(3)}-${randomPart(4)}-${randomPart(3)}`;
}

/** Menerima kode atau link lengkap, mengembalikan kode meeting yang valid (atau null). */
export function parseRoomInput(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    value = url.pathname.split("/").filter(Boolean).pop() ?? "";
  } catch {
    // bukan URL, anggap sebagai kode
  }
  value = value.toLowerCase().replace(/\s+/g, "-");
  return /^[a-z0-9-]{3,40}$/.test(value) ? value : null;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}
