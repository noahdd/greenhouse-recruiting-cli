import { describe, it, expect } from "vitest";

// Re-implement parseArgs here for testing (same as in index.ts)
function parseArgs(args: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value =
        args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      flags[key] = value;
    } else {
      positional.push(args[i]);
    }
  }

  return { positional, flags };
}

function parseGreenhouseUrl(url: string) {
  const match = url.match(
    /guides\/(\d+)\/people\/(\d+)(?:\?.*application_id=(\d+))?/
  );
  if (!match) return null;
  return {
    guideId: match[1],
    personId: match[2],
    applicationId: match[3],
  };
}

describe("CLI argument parsing", () => {
  it("parses bare command", () => {
    const { positional, flags } = parseArgs(["interview-kit"]);
    expect(positional).toEqual(["interview-kit"]);
    expect(flags).toEqual({});
  });

  it("parses command with positional args", () => {
    const { positional, flags } = parseArgs([
      "interview-kit",
      "12345",
      "67890",
    ]);
    expect(positional).toEqual(["interview-kit", "12345", "67890"]);
    expect(flags).toEqual({});
  });

  it("parses --application-id flag", () => {
    const { positional, flags } = parseArgs([
      "interview-kit",
      "12345",
      "67890",
      "--application-id",
      "11111",
    ]);
    expect(positional).toEqual(["interview-kit", "12345", "67890"]);
    expect(flags).toEqual({ "application-id": "11111" });
  });

  it("parses --help as boolean flag", () => {
    const { positional, flags } = parseArgs(["--help"]);
    expect(positional).toEqual([]);
    expect(flags).toEqual({ help: "true" });
  });
});

describe("Greenhouse URL parsing", () => {
  it("parses a full interview kit URL", () => {
    const result = parseGreenhouseUrl(
      "https://example.greenhouse.io/guides/12345/people/67890?application_id=11111"
    );
    expect(result).toEqual({
      guideId: "12345",
      personId: "67890",
      applicationId: "11111",
    });
  });

  it("parses URL without application_id", () => {
    const result = parseGreenhouseUrl(
      "https://example.greenhouse.io/guides/12345/people/67890"
    );
    expect(result).toEqual({
      guideId: "12345",
      personId: "67890",
      applicationId: undefined,
    });
  });

  it("returns null for non-matching URL", () => {
    const result = parseGreenhouseUrl("https://example.greenhouse.io/dashboard");
    expect(result).toBeNull();
  });
});
