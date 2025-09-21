import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

function Hello() {
  return <h1 data-testid="hello">Hello, DueD8</h1>;
}

describe("testing setup", () => {
  it("renders a basic component", () => {
    render(<Hello />);
    expect(screen.getByTestId("hello")).toHaveTextContent("Hello, DueD8");
  });
});