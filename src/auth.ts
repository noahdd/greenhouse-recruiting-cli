/**
 * Auth module for Greenhouse Recruiting CLI.
 *
 * Greenhouse is a server-rendered Rails app that uses session cookies for auth.
 * This module extracts session cookies from Chrome's cookie database on macOS,
 * decrypting them using the Chrome Safe Storage key from the macOS Keychain.
 */

import { execSync } from "child_process";
import { createDecipheriv, pbkdf2Sync } from "crypto";
import { existsSync, copyFileSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CHROME_PROFILES = ["Default", "Profile 1", "Profile 2", "Profile 3"];
const CHROME_BASE = join(
  homedir(),
  "Library",
  "Application Support",
  "Google",
  "Chrome"
);

interface CookieRow {
  name: string;
  encrypted_value: Buffer;
  host_key: string;
  path: string;
}

/**
 * Get Chrome's encryption key from the macOS Keychain.
 * This may prompt the user for their macOS password on first access.
 */
function getChromeEncryptionKey(): Buffer {
  try {
    const password = execSync(
      'security find-generic-password -s "Chrome Safe Storage" -w',
      { encoding: "utf-8" }
    ).trim();
    // Chrome derives the actual key using PBKDF2
    return pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1");
  } catch {
    throw new Error(
      "Could not get Chrome Safe Storage key from macOS Keychain.\n" +
        "Make sure Chrome is installed and you've used it at least once."
    );
  }
}

/**
 * Decrypt a Chrome v10 encrypted cookie value.
 * Format: "v10" (3 bytes) + AES-128-CBC encrypted data.
 */
function decryptCookie(encrypted: Buffer, key: Buffer): string {
  // Check for v10 prefix
  const prefix = encrypted.subarray(0, 3).toString("utf-8");
  if (prefix !== "v10") {
    // Unencrypted or unknown format
    return encrypted.toString("utf-8");
  }

  const iv = Buffer.alloc(16, " "); // Chrome uses 16 spaces as IV
  const data = encrypted.subarray(3);

  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(true);
  let decrypted = decipher.update(data);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  // Chrome prepends a 32-byte fixed prefix to the plaintext before encrypting.
  // Skip it to get the actual cookie value.
  const CHROME_PREFIX_LEN = 32;
  if (decrypted.length <= CHROME_PREFIX_LEN) {
    return "";
  }
  return decrypted.subarray(CHROME_PREFIX_LEN).toString("utf-8");
}

/**
 * Find the Chrome profile that contains cookies for the given domain.
 */
function findCookieDb(domain: string): string | null {
  for (const profile of CHROME_PROFILES) {
    const dbPath = join(CHROME_BASE, profile, "Cookies");
    if (!existsSync(dbPath)) continue;

    // Copy the DB since Chrome locks it
    const tmpPath = `/tmp/greenhouse_cli_cookies_${profile.replace(/ /g, "_")}.db`;
    try {
      copyFileSync(dbPath, tmpPath);
      const result = execSync(
        `sqlite3 "${tmpPath}" "SELECT COUNT(*) FROM cookies WHERE host_key LIKE '%${domain}%'"`,
        { encoding: "utf-8" }
      ).trim();
      if (parseInt(result) > 0) {
        return tmpPath;
      }
      unlinkSync(tmpPath);
    } catch {
      // Can't read this profile, try next
      try {
        unlinkSync(tmpPath);
      } catch { /* ignore */ }
    }
  }
  return null;
}

/**
 * Extract and decrypt cookies for a domain from Chrome's cookie database.
 */
export function getCookiesFromChromeDb(
  domain: string
): Array<{ name: string; value: string }> {
  const dbPath = findCookieDb(domain);
  if (!dbPath) {
    throw new Error(
      `No Chrome profile found with cookies for ${domain}.\n` +
        "Make sure you're logged into Greenhouse in Chrome."
    );
  }

  const key = getChromeEncryptionKey();

  // Query cookies — sqlite3 outputs hex-encoded encrypted_value
  const rows = execSync(
    `sqlite3 "${dbPath}" "SELECT name, hex(encrypted_value) FROM cookies WHERE host_key LIKE '%${domain}%'"`,
    { encoding: "utf-8" }
  )
    .trim()
    .split("\n")
    .filter(Boolean);

  const cookies: Array<{ name: string; value: string }> = [];

  for (const row of rows) {
    const [name, hexValue] = row.split("|");
    if (!name || !hexValue) continue;

    const encrypted = Buffer.from(hexValue, "hex");
    try {
      const value = decryptCookie(encrypted, key);
      // Skip cookies with non-ASCII values (decryption artifacts)
      if (value && !/[^\x20-\x7E]/.test(value)) {
        cookies.push({ name, value });
      }
    } catch {
      // Skip cookies that fail to decrypt
    }
  }

  // Clean up temp DB
  try {
    unlinkSync(dbPath);
  } catch { /* ignore */ }

  return cookies;
}

/**
 * Build a cookie header string from Chrome cookies for a given domain.
 */
export function getSessionCookieHeader(baseUrl: string): string {
  const domain = new URL(baseUrl).hostname;
  // Use just the base domain for matching (e.g. "greenhouse.io")
  const domainParts = domain.split(".");
  const baseDomain = domainParts.slice(-2).join(".");

  const cookies = getCookiesFromChromeDb(baseDomain);
  if (cookies.length === 0) {
    throw new Error(
      `No cookies found for ${domain}. Make sure you're logged into Greenhouse in Chrome.`
    );
  }
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * Get the session cookie from env var or Chrome cookie database.
 * Priority: GREENHOUSE_SESSION_COOKIE env var > Chrome cookie DB.
 */
export function resolveAuth(baseUrl: string): string {
  const envCookie = process.env.GREENHOUSE_SESSION_COOKIE;
  if (envCookie) {
    return envCookie;
  }

  try {
    return getSessionCookieHeader(baseUrl);
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : String(err)}\n` +
        "Either set GREENHOUSE_SESSION_COOKIE env var, or ensure you're logged into Greenhouse in Chrome."
    );
    process.exit(1);
  }
}
