export function splitDuration(totalSeconds: number): Array<5 | 10> {
  if (totalSeconds <= 5) return [5];
  const clips: Array<5 | 10> = [];
  let remaining = totalSeconds;
  while (remaining > 0) {
    if (remaining >= 10) {
      clips.push(10);
      remaining -= 10;
    } else if (remaining >= 5) {
      clips.push(5);
      remaining -= 5;
    } else {
      clips.push(5);
      remaining = 0;
    }
  }
  return clips;
}
