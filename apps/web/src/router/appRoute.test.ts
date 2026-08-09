import { describe, expect, it } from "vitest";
import { matchAppRoute } from "./appRoute";

describe("matchAppRoute", () => {
  it("matches the run id on the play root and supported subpages", () => {
    expect(matchAppRoute("/play/run-1")).toEqual({ kind: "play", runId: "run-1" });
    expect(matchAppRoute("/play/run%20one/settings/audio")).toEqual({
      kind: "play",
      runId: "run one",
    });
    expect(matchAppRoute("/play/run-1/character/")).toEqual({ kind: "play", runId: "run-1" });
  });

  it("keeps unsupported and malformed paths in the editor", () => {
    expect(matchAppRoute("/")).toEqual({ kind: "editor" });
    expect(matchAppRoute("/play/run-1/unknown")).toEqual({ kind: "editor" });
    expect(matchAppRoute("/play/%E0%A4%A")).toEqual({ kind: "editor" });
  });
});
