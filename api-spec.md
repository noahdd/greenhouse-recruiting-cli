# Greenhouse Recruiting Internal API Spec

Discovered by probing the Greenhouse Rails app with session cookie auth.
All endpoints require the session cookie from Chrome.

## Auth

- Session cookies from Chrome's encrypted SQLite database (macOS Keychain + AES-128-CBC)
- CSRF token from `<meta name="csrf-token">` on any HTML page (required for POST/PATCH)

---

## JSON API Endpoints

### Interview Kit (primary endpoint)

**`GET /guides/:guide_id/people/:person_id.json?application_id=:app_id`**

Returns the full interview kit with candidate, rubric, scorecard, and schedule.

Response:
```json
{
  "candidate": {
    "name": "string",
    "title": "string",
    "photo": "url",
    "phone": "string",
    "email": "string",
    "details": [{"type": "string", "title": "string", "label": "string", "url": "string"}],
    "attachments": [{"url": "string", "label": "string", "size": "string"}],
    "profile_url": "string"
  },
  "interview": {
    "job_name": "string",
    "interview_name": "string",  // e.g. "debugging", "code craft challenge"
    "interview_date": {"date": "string", "start_time": "string", "end_time": "string"} | null,
    "interview_location": {"location": "string"} | null
  },
  "interview_kit": {
    "purpose": "html string",  // rubric/instructions as HTML
    "questions": [{"question_id": 123, "question": "string", "answer_id": 456}],
    "focus_attributes": [],
    "interview_schedule": [{
      "interviewers": ["string"],
      "interview_name": "string",
      "interview_date": {},
      "interview_location": {}
    }]
  },
  "scorecard": {
    "id": 12345,
    "complete": false,
    "draft": true,
    "candidate_rating_id": null,  // 1=Def Not, 2=No, 3=Yes, 4=Strong Yes
    "key_takeaways": "string | null",
    "public_notes": "string | null",
    "questions": [{
      "question_id": 123,
      "question": "string",
      "answer_id": 456,
      "answer": "string | null",
      "answer_type": "single_select | multi_select | text | yes_no",
      "scorecard_question_options": [{
        "id": 789,
        "name": "Strong Yes (9 - 10 pts)",
        "priority": 0
      }],
      "selected_scorecard_question_option_id": "number | null",
      "required": true
    }],
    "edit_scorecard_url": "/scorecards/:id/edit",
    "save_scorecard_url": "/guides/:id/people/:id/scorecards?application_id=:id"
  }
}
```

### Save Scorecard (draft or submit)

**`POST /guides/:guide_id/people/:person_id/scorecards?application_id=:app_id`**

Content-Type: `application/x-www-form-urlencoded`
Requires: `X-CSRF-Token` header + `authenticity_token` form field

Form fields:
```
utf8=✓
authenticity_token=<csrf_token>
draft=true|false                                    # true=draft, false=submit

# Per question (indexed 0, 1, 2...):
scorecard[scorecard_question_answers_attributes][N][id]=<answer_id>
scorecard[scorecard_question_answers_attributes][N][scorecard_question_id]=<question_id>

# For single_select questions:
scorecard[scorecard_question_answers_attributes][N][scorecard_question_option_ids][]=<option_id>

# For text questions:
scorecard[scorecard_question_answers_attributes][N][answer]=<text>

# Key takeaways (rich text):
notes=<html_string>

# Private notes:
public_notes=<html_string>

# Overall recommendation (1=Definitely Not, 2=No, 3=Yes, 4=Strong Yes):
scorecard[candidate_rating_id]=<1|2|3|4>
```

Response: `{"status": "success"}`

---

### Dashboard Widgets

**`GET /dashboards/widgets/my_interviews`**
**`GET /dashboards/widgets/my_interviews?type=past`**

Returns upcoming/past interviews with candidate info and interview kit links.

```json
{
  "meta": {"count": 1},
  "interviews": [{
    "id": 123,
    "time": "Mar 23, 11am - 12pm EDT",
    "name": "debugging",
    "job": {"name": "Software Engineer"},
    "candidate": {"full_name": "Jane Doe", "title_and_company": "SWE @ Company"},
    "action": {"link": "/guides/:id/people/:id?application_id=:id"}
  }]
}
```

**`GET /dashboards/widgets/my_referrals`**

Returns referral tracking with status.

**`GET /dashboards/widgets/social_media`**

Returns social media posts.

---

### Hiring Team Tags

**`GET /tags/hiring_team/:application_id`**

Returns autocomplete list of hiring team members for @-mentions in scorecard notes.

```json
[{"id": 123, "name": "@Jane Doe", "type": "User"}]
```

**`GET /tags.json`**

Returns all tags across the organization.

---

### Organization Data

**`GET /departments`** — Department tree (JSON)
**`GET /offices`** — Office tree (JSON)
**`GET /department_options`** — Department options with checkboxes
**`GET /office_options`** — Office options with checkboxes
**`GET /plans.json`** — Hiring plans (jobs)
**`GET /plans/close_reasons.json`** — Job close reasons

---

### Documents

**`GET /guides/:guide_id/people/:person_id/pdf?application_id=:app_id&scorecard_id=:id`**

Returns interview kit as PDF (binary).

**`GET /attachment_previews/:attachment_id?width=850`**

Returns attachment preview URL (for resumes).

```json
{"source": "https://pdf-viewer.cdn.greenhouse.io/..."}
```

---

## Endpoints That Don't Work (403/404)

These require higher permissions (admin/recruiter role):
- `/people/:id.json` — 403 (need admin)
- `/applications/:id.json` — 403
- `/scorecards/:id.json` — 404
- `/interviews.json` — 404
- `/people/user_options` — 403
- `/people/source_options` — 403

---

## Route Templates (from page metadata)

These use `{{id}}` placeholders and are available in the frontend JS:

- `/people/{{personId}}/applications/{{appId}}/change_state` — Change application state
- `/application_stages/{{id}}/interviews` — Stage interviews
- `/tasks/{{id}}` — Update/delete task
- `/tasks/{{id}}/status` — Update task status
- `/plans/{{id}}/openings` — Job openings
- `/plans/{{id}}/approvals` — Job approvals
- `/applications/{{id}}/attachments/{{attachment_id}}` — Candidate attachments
- `/custom_fields/{{id}}/describe` — Custom field details

## AI Tools (POST only, require specific payload)

- `/ai_tools/revise_scorecard` — AI revision of scorecard text
