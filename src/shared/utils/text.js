// Text typed by the user, as it is saved: spaces at both ends removed and cut
// to at most `max` characters (the database allows no more). Empty → ''.
export function cleanText(text, max) {
  return text.trim().slice(0, max)
}
