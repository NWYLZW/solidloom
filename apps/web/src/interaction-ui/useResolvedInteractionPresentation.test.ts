import { describe, expect, it } from "vitest";
import { resolveInteractionPresentation } from "./useResolvedInteractionPresentation";

describe("interaction presentation resolver", () => {
  it("uses a side panel on desktop and a sheet on compact screens for auto mode", () => {
    expect(resolveInteractionPresentation("auto", false)).toBe("panel");
    expect(resolveInteractionPresentation("auto", true)).toBe("sheet");
  });

  it("keeps explicit modes and maps the legacy anchored mode to panel", () => {
    expect(resolveInteractionPresentation("quick", false)).toBe("quick");
    expect(resolveInteractionPresentation("modal", true)).toBe("modal");
    expect(resolveInteractionPresentation("anchored", false)).toBe("panel");
  });
});
