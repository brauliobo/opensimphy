export function isPrimeInteger(value: number): boolean {
  if (!Number.isSafeInteger(value) || value < 2) return false
  if (value === 2) return true
  if (value % 2 === 0) return false
  for (let divisor = 3; divisor * divisor <= value; divisor += 2) {
    if (value % divisor === 0) return false
  }
  return true
}
