// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Home from "./Home";

afterEach(cleanup);

describe("home page", () => {
  it("offers no test account sign in anywhere", () => {
    render(<Home />);
    expect(screen.queryByText(/Test accounts/)).toBeNull();
    expect(screen.queryByRole("button", { name: /test\)/ })).toBeNull();
    expect(screen.queryByText(/Sign in as/)).toBeNull();
  });

  it("still offers the real wallet and the main actions", () => {
    render(<Home />);
    expect(screen.getByText("My wallet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New invoice" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "My pay" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Make proof" })).toBeTruthy();
  });
});
