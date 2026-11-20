// @vitest-environment jsdom
// The seconds counter for long network steps. Fake timers
// drive the clock so the test does not wait real seconds.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useElapsedSeconds } from "./useElapsedSeconds";

function Probe({ running }: { running: boolean }) {
  const seconds = useElapsedSeconds(running);
  return <p>Seconds: {seconds}</p>;
}

afterEach(cleanup);

describe("useElapsedSeconds", () => {
  it("counts while running and clears when stopped", async () => {
    vi.useFakeTimers();
    const view = render(<Probe running />);
    expect(screen.getByText("Seconds: 0")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("Seconds: 3")).toBeTruthy();
    view.rerender(<Probe running={false} />);
    expect(screen.getByText("Seconds: 0")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("Seconds: 0")).toBeTruthy();
    vi.useRealTimers();
  });
});
