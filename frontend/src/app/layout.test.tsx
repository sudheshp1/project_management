import { vi } from "vitest";

vi.mock("next/font/google", () => ({
  Manrope: () => ({ variable: "font-body" }),
  Space_Grotesk: () => ({ variable: "font-display" }),
}));

import RootLayout, { metadata } from "@/app/layout";

describe("RootLayout", () => {
  it("sets metadata and wraps children", () => {
    const child = <p>Board content</p>;
    const layout = RootLayout({ children: child });

    expect(metadata.title).toBe("Kanban Studio");
    expect(layout.props.children.props.children).toBe(child);
  });
});
