#!/usr/bin/env node

/**
 * greenhouse-recruiting-cli
 *
 * CLI to interact with Greenhouse Recruiting via its JSON API.
 * Authenticates using session cookies extracted from Chrome's cookie database.
 *
 * Usage:
 *   greenhouse interview-kit <guide_id> <person_id> [--application-id <id>]
 *   greenhouse scorecard <guide_id> <person_id> [--application-id <id>]
 *   greenhouse my-interviews
 *   greenhouse page <path>
 *   greenhouse --help
 */

import {
  getInterviewKit,
  getScorecard,
  getMyInterviews,
  getHtml,
} from "./client.js";

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

// Exported for testing
export { parseArgs };

function printUsage() {
  console.log(`greenhouse-recruiting-cli v0.1.0

Usage:
  greenhouse interview-kit <guide_id> <person_id> [--application-id <id>]
  greenhouse interview-kit <greenhouse_url>
      Fetch interview kit data (candidate, rubric, scorecard) as JSON

  greenhouse scorecard <guide_id> <person_id> [--application-id <id>]
  greenhouse scorecard <greenhouse_url>
      Fetch scorecard form structure (questions, options, answer types)

  greenhouse my-interviews
      List your upcoming interviews from the dashboard

  greenhouse page <path>
      Fetch a raw Greenhouse page as HTML

  greenhouse --help
      Show this help

Auth:
  Reads session cookies from Chrome's cookie database on macOS.
  You must be logged into Greenhouse in Chrome.

  Alternatively: GREENHOUSE_SESSION_COOKIE env var (full cookie header).

Environment:
  GREENHOUSE_SESSION_COOKIE   Cookie header string (optional)
  GREENHOUSE_BASE_URL         Base URL (e.g. https://your-company.greenhouse.io) — REQUIRED

Examples:
  greenhouse interview-kit 12345 67890 --application-id 11111
  greenhouse interview-kit "https://your-company.greenhouse.io/guides/12345/people/67890?application_id=11111"
  greenhouse scorecard 12345 67890 --application-id 11111
  greenhouse my-interviews`);
}

/**
 * Parse a Greenhouse URL into its components.
 */
function parseGreenhouseUrl(url: string): {
  guideId: string;
  personId: string;
  applicationId?: string;
} | null {
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

// Exported for testing
export { parseGreenhouseUrl };

function resolveKitArgs(positional: string[], flags: Record<string, string>) {
  let guideId = positional[1];
  let personId = positional[2];
  let applicationId = flags["application-id"];

  if (guideId && guideId.includes("greenhouse.io")) {
    const parsed = parseGreenhouseUrl(guideId);
    if (!parsed) {
      console.error("Error: Could not parse Greenhouse URL");
      process.exit(1);
    }
    guideId = parsed.guideId;
    personId = parsed.personId;
    applicationId = applicationId || parsed.applicationId || "";
  }

  if (!guideId || !personId) {
    return null;
  }

  return { guideId, personId, applicationId };
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0];

  if (flags.help || !command) {
    printUsage();
    process.exit(0);
  }

  let result: unknown;

  try {
    switch (command) {
      case "interview-kit": {
        const args = resolveKitArgs(positional, flags);
        if (!args) {
          console.error(
            "Usage: greenhouse interview-kit <guide_id> <person_id> [--application-id <id>]"
          );
          process.exit(1);
        }
        result = await getInterviewKit(
          args.guideId,
          args.personId,
          args.applicationId
        );
        break;
      }

      case "scorecard": {
        const args = resolveKitArgs(positional, flags);
        if (!args) {
          console.error(
            "Usage: greenhouse scorecard <guide_id> <person_id> [--application-id <id>]"
          );
          process.exit(1);
        }
        result = await getScorecard(
          args.guideId,
          args.personId,
          args.applicationId
        );
        break;
      }

      case "my-interviews": {
        result = await getMyInterviews();
        break;
      }

      case "page": {
        const path = positional[1];
        if (!path) {
          console.error("Usage: greenhouse page <path>");
          process.exit(1);
        }
        const html = await getHtml(path.startsWith("/") ? path : `/${path}`);
        console.log(html);
        process.exit(0);
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (err) {
    console.error(
      `\nError: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
