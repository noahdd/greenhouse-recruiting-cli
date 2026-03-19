import { describe, it, expect, vi, beforeEach } from "vitest";

const MOCK_INTERVIEW_KIT_JSON = {
  candidate: {
    name: "Jane Doe",
    title: "",
    photo: "https://example.com/photo.jpg",
    phone: "+15551234567",
    email: "jane@example.com",
    details: [],
    attachments: [],
    profile_url: "",
  },
  interview: {
    job_name: "Software Engineer",
    interview_name: "debugging",
    interview_date: null,
    interview_location: null,
  },
  interview_kit: {
    purpose: "<p>Rubric content here</p>",
    questions: [{ question_id: 1, question: "Score", answer_id: 100 }],
    focus_attributes: [],
    interview_schedule: [],
  },
  job_details: {},
  user: { can_add_private_notes: false },
  scorecard: {
    id: 10001,
    complete: false,
    draft: true,
    candidate_rating_id: null,
    key_takeaways: null,
    key_takeaways_with_tags: null,
    public_notes: null,
    public_notes_with_tags: null,
    attributes_by_type: [],
    updated_at: "2025-01-01T12:00:00.000-05:00",
    questions: [
      {
        question_id: 20001,
        question: "Overall score & rating",
        answer_id: 30001,
        answer: null,
        answer_with_tags: null,
        boolean_value: null,
        scorecard_question_options: [
          { id: 1, scorecard_question_id: 20001, name: "Strong Yes (9 - 10 pts)", priority: 0, active: true },
          { id: 2, scorecard_question_id: 20001, name: "Yes (6 - 8 pts)", priority: 1, active: true },
        ],
        selected_scorecard_question_option_id: null,
        selected_scorecard_question_option_ids: [],
        required: true,
        priority: 0,
        answer_type: "single_select",
      },
    ],
    edit_scorecard_url: "/scorecards/10001/edit",
    save_scorecard_url: "/guides/123/people/456/scorecards",
  },
};

describe("GreenhouseClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches interview kit via JSON API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(MOCK_INTERVIEW_KIT_JSON),
        headers: new Headers({ "content-type": "application/json" }),
      })
    );

    process.env.GREENHOUSE_SESSION_COOKIE = "test_session=abc123";

    const { GreenhouseClient } = await import("../../src/client.js");
    const client = new GreenhouseClient("https://test.greenhouse.io");

    const kit = await client.getInterviewKit("123", "456");
    expect(kit.candidate.name).toBe("Jane Doe");
    expect(kit.interview.job_name).toBe("Software Engineer");
    expect(kit.scorecard.id).toBe(10001);
    expect(kit.scorecard.questions).toHaveLength(1);
    expect(kit.scorecard.questions[0].answer_type).toBe("single_select");

    delete process.env.GREENHOUSE_SESSION_COOKIE;
  });

  it("fetches scorecard data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(MOCK_INTERVIEW_KIT_JSON),
        headers: new Headers({ "content-type": "application/json" }),
      })
    );

    process.env.GREENHOUSE_SESSION_COOKIE = "test_session=abc123";

    const { GreenhouseClient } = await import("../../src/client.js");
    const client = new GreenhouseClient("https://test.greenhouse.io");

    const scorecard = await client.getScorecard("123", "456");
    expect(scorecard.id).toBe(10001);
    expect(scorecard.save_scorecard_url).toBe("/guides/123/people/456/scorecards");
    expect(scorecard.questions[0].scorecard_question_options).toHaveLength(2);

    delete process.env.GREENHOUSE_SESSION_COOKIE;
  });

  it("throws on redirect to login (expired session)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 302,
        headers: new Headers({ location: "/users/sign_in" }),
        text: () => Promise.resolve(""),
      })
    );

    process.env.GREENHOUSE_SESSION_COOKIE = "test_session=expired";

    const { GreenhouseClient } = await import("../../src/client.js");
    const client = new GreenhouseClient("https://test.greenhouse.io");

    await expect(client.getJson("/test")).rejects.toThrow("Session expired");

    delete process.env.GREENHOUSE_SESSION_COOKIE;
  });
});
