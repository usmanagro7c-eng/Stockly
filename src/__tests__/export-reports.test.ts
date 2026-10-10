import { describe, expect, it } from "vitest";
import type { InventoryItem, Sale, Expense } from "@/types";
import { applyThemeToDom, type ThemeMode } from "@/hooks/use-theme";

describe("Theme Switcher & Export Reports", () => {
  it("should apply theme classes to documentElement", () => {
    const classList = new Set<string>();
    const mockElement = {
      classList: {
        add: (...names: string[]) => names.forEach((n) => classList.add(n)),
        remove: (...names: string[]) => names.forEach((n) => classList.delete(n)),
        contains: (n: string) => classList.has(n),
      },
    };

    (globalThis as any).document = {
      documentElement: mockElement,
      querySelector: () => null,
      createElement: () => ({ name: "", content: "" }),
      head: { appendChild: () => {} },
    };

    applyThemeToDom("light");
    expect(classList.has("light")).toBe(true);
    expect(classList.has("dark")).toBe(false);

    applyThemeToDom("oled");
    expect(classList.has("oled")).toBe(true);
    expect(classList.has("dark")).toBe(true);
    expect(classList.has("light")).toBe(false);

    applyThemeToDom("dark");
    expect(classList.has("dark")).toBe(true);
    expect(classList.has("oled")).toBe(false);
    expect(classList.has("light")).toBe(false);
  });
});
