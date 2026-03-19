/**
 * Greenhouse Recruiting API client.
 *
 * Greenhouse exposes a JSON API by appending .json to page URLs.
 * Auth is via session cookies extracted from Chrome.
 */

import { resolveAuth } from "./auth.js";

export class GreenhouseClient {
  private baseUrl: string;
  private cookieHeader: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      process.env.GREENHOUSE_BASE_URL ||
      "";

    if (!this.baseUrl) {
      console.error(
        "Error: GREENHOUSE_BASE_URL is required.\n" +
          "Set it to your Greenhouse instance URL (e.g. https://your-company.greenhouse.io)"
      );
      process.exit(1);
    }
  }

  private getCookies(): string {
    if (!this.cookieHeader) {
      this.cookieHeader = resolveAuth(this.baseUrl);
    }
    return this.cookieHeader;
  }

  /**
   * Make an authenticated GET request and return JSON.
   */
  async getJson<T = unknown>(path: string): Promise<T> {
    const cookies = this.getCookies();
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      headers: {
        Cookie: cookies,
        Accept: "application/json",
        "User-Agent": "greenhouse-recruiting-cli/0.1.0",
      },
      redirect: "manual",
    });

    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get("location") || "";
      if (location.includes("login") || location.includes("sign_in")) {
        throw new Error(
          "Session expired — redirected to login. Refresh your Greenhouse session in Chrome."
        );
      }
      throw new Error(`Unexpected redirect to: ${location}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make an authenticated GET request and return raw HTML.
   */
  async getHtml(path: string): Promise<string> {
    const cookies = this.getCookies();
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      headers: {
        Cookie: cookies,
        Accept: "text/html",
        "User-Agent": "greenhouse-recruiting-cli/0.1.0",
      },
      redirect: "manual",
    });

    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get("location") || "";
      if (location.includes("login") || location.includes("sign_in")) {
        throw new Error("Session expired.");
      }
      throw new Error(`Unexpected redirect to: ${location}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.text();
  }

  // ─── Interview Kit (JSON API) ─────────────────────────────────

  /**
   * Fetch interview kit data via JSON API.
   * Endpoint: /guides/:guide_id/people/:person_id.json?application_id=:app_id
   */
  async getInterviewKit(
    guideId: string,
    personId: string,
    applicationId?: string
  ): Promise<InterviewKitResponse> {
    const qs = applicationId ? `?application_id=${applicationId}` : "";
    return this.getJson<InterviewKitResponse>(
      `/guides/${guideId}/people/${personId}.json${qs}`
    );
  }

  // ─── Scorecard ──────────────────────────────────────────────────

  /**
   * Get the scorecard data from the interview kit JSON response.
   */
  async getScorecard(
    guideId: string,
    personId: string,
    applicationId?: string
  ): Promise<ScorecardData> {
    const kit = await this.getInterviewKit(guideId, personId, applicationId);
    return kit.scorecard;
  }

  // ─── Dashboard ──────────────────────────────────────────────────

  /**
   * Get upcoming interviews from the dashboard widget.
   */
  async getMyInterviews(): Promise<DashboardInterviews> {
    return this.getJson<DashboardInterviews>(
      "/dashboards/widgets/my_interviews"
    );
  }
}

// ─── Types ──────────────────────────────────────────────────────

export interface InterviewKitResponse {
  candidate: {
    name: string;
    title: string;
    photo: string;
    phone: string;
    email: string;
    details: Array<{ type: string; title: string; label: string; url: string }>;
    attachments: Array<{
      url: string;
      label: string;
      size: string;
      needs_generating: boolean;
    }>;
    profile_url: string;
  };
  interview: {
    job_name: string;
    interview_name: string;
    interview_date: { date: string; start_time: string; end_time: string } | null;
    interview_location: { location: string } | null;
  };
  interview_kit: {
    purpose: string; // HTML rubric content
    questions: Array<{
      question_id: number;
      question: string;
      answer_id: number;
    }>;
    focus_attributes: unknown[];
    interview_schedule: Array<{
      interviewers: string[];
      interview_name: string;
      interview_date: unknown;
      interview_location: unknown;
    }>;
  };
  job_details: unknown;
  user: { can_add_private_notes: boolean };
  scorecard: ScorecardData;
}

export interface ScorecardQuestionOption {
  id: number;
  scorecard_question_id: number;
  name: string;
  priority: number;
  active: boolean;
}

export interface ScorecardQuestion {
  question_id: number;
  question: string;
  answer_id: number;
  answer: string | null;
  answer_with_tags: string | null;
  boolean_value: boolean | null;
  scorecard_question_options: ScorecardQuestionOption[];
  selected_scorecard_question_option_id: number | null;
  selected_scorecard_question_option_ids: number[];
  required: boolean;
  priority: number;
  answer_type: "single_select" | "multi_select" | "text" | "yes_no";
}

export interface ScorecardData {
  id: number;
  complete: boolean;
  draft: boolean;
  candidate_rating_id: number | null;
  key_takeaways: string | null;
  key_takeaways_with_tags: string | null;
  public_notes: string | null;
  public_notes_with_tags: string | null;
  attributes_by_type: unknown[];
  updated_at: string;
  questions: ScorecardQuestion[];
  edit_scorecard_url: string;
  save_scorecard_url: string;
}

export interface DashboardInterviews {
  meta: { count: number };
  interviews: Array<{
    id: number;
    time: string;
    name: string;
    job: { name: string };
    candidate: { full_name: string; title_and_company: string };
    action: { text: string; link: string };
  }>;
}

// ─── Singleton & Exports ────────────────────────────────────────

let defaultClient: GreenhouseClient | null = null;

function getClient(): GreenhouseClient {
  if (!defaultClient) {
    defaultClient = new GreenhouseClient();
  }
  return defaultClient;
}

export const getInterviewKit = (
  guideId: string,
  personId: string,
  applicationId?: string
) => getClient().getInterviewKit(guideId, personId, applicationId);

export const getScorecard = (
  guideId: string,
  personId: string,
  applicationId?: string
) => getClient().getScorecard(guideId, personId, applicationId);

export const getMyInterviews = () => getClient().getMyInterviews();

export const getHtml = (path: string) => getClient().getHtml(path);
