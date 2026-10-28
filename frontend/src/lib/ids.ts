/**
 * Generates an alphanumeric pseudo-unique identifier combining prefix, timestamp, and random entropy.
 *
 * @param prefix - Category or entity prefix for readable identification (e.g. 'sess', 'msg').
 * @returns Formatted identifier string in the form `<prefix>_<base36_time>_<random>`.
 */
export function generateId(prefix: string = 'id'): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${time}_${rand}`;
}
