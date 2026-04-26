// Generates a Meet-style room code: abc-defg-hij
const LETTERS = "abcdefghijkmnopqrstuvwxyz";

function segment(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return out;
}

export function generateRoomCode(): string {
  return `${segment(3)}-${segment(4)}-${segment(3)}`;
}

export function isValidRoomCode(code: string): boolean {
  return /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(code.trim().toLowerCase());
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toLowerCase();
}
