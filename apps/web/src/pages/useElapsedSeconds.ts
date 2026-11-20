import { useEffect, useState } from "react";

// Counts whole seconds from when `running` turns true, so
// a long network step can say how long it has been going
// instead of asking the person to wait through silence.
// Returns to zero when the step stops.
export function useElapsedSeconds(running: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) {
      setSeconds(0);
      return undefined;
    }
    setSeconds(0);
    const started = Date.now();
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  return seconds;
}
