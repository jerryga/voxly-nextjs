// Shared prompt builder (runtime JS)
const templates = {
  default: `
TEMPLATE CONTEXT — MEETING (DEFAULT)
This is a formal meeting with potential decisions and follow-up actions.
`,
  brainstorm: `
TEMPLATE CONTEXT — BRAINSTORM SESSION
- Decisions are rare; include ONLY if explicitly finalized.
- Emphasize ideas, themes, and opportunities in keyPoints.
- Action items should focus on exploration or validation.
- Do NOT force executive decision structure.
`,
  interview: `
TEMPLATE CONTEXT — INTERVIEW NOTES
- Decisions are generally NOT applicable.
- Focus keyPoints on insights, opinions, and factual statements.
- Action items only if follow-up or deliverables are explicitly stated.
- Do NOT infer organizational actions.
`,
  lecture: `
TEMPLATE CONTEXT — LECTURE NOTES
- This is informational and educational content.
- Omit decisions unless explicitly assigned.
- KeyPoints should summarize concepts, frameworks, or explanations.
- Action items only reflect assignments or required work.
`,
  "voice-memo": `
TEMPLATE CONTEXT — VOICE MEMO
- This is an informal personal recording.
- Decisions may be personal commitments.
- KeyPoints may include thoughts, reminders, or ideas.
- Action items may be inferred conservatively and kept practical.
`,
};

const allowedTemplates = Object.keys(templates);

export function normalizeTemplate(template) {
  return allowedTemplates.includes(template) ? template : "default";
}

export function buildPrompt(transcript, template = "default") {
  const safeTemplate = normalizeTemplate(template);
  return `
${getSystemRole()}

${getTemplateContext(safeTemplate)}

${getCoreRules()}

${getJsonSchema()}

${getValidationRules()}

${getTwoPassRules()}

Transcript:
${transcript}
`.trim();
}

function getSystemRole() {
  return `
You are an expert Meeting Secretary.
Your task is to convert a raw transcript into a concise, executive-level structured summary.
The output must be suitable for official records.
`;
}

function getTemplateContext(template) {
  return templates[template] || templates.default;
}

function getCoreRules() {
  return `
OBJECTIVE
Capture:
- Substantive decisions
- Key discussion points without decisions
- Concrete actions occurring AFTER the transcript

Avoid procedural noise, speculation, and restating the transcript.

---

DECISIONS (CRITICAL)
- Include ONLY substantive decisions:
  - Policy, strategy, financial, governance, operational
- EXCLUDE procedural motions:
  - Agenda approval, minutes, reports, adjournment
- Use ONE sentence starting with a verb:
  Approved, Authorized, Adopted, Amended, Rejected
- Voting outcomes normalized:
  Unanimous, Carried, Rejected, Deferred
- Include mover and seconder ONLY if explicitly stated
- Never invent names or roles

FORMAT:
"Approved [subject] (Moved by [Name], Seconded by [Name], [Outcome])"
Omit seconder if not mentioned.

---

ACTION ITEMS
- Only future work explicitly requested, assigned, or committed in the transcript
- Do NOT create action items from role mentions alone
- Do NOT add items that were already completed (e.g., "already shared")
- One assignee only
- Infer assignees conservatively by role ONLY when the task itself is explicit:
  Finance → Finance / CFO
  Operations → Operations / Engineering / Facilities
  Policy → Legal / Compliance / Executive
  Communications → Communications / Marketing
- Priorities:
  HIGH → urgent, risky, blocking
  MEDIUM → standard follow-up
  LOW → informational
- Merge overlapping tasks when appropriate

---

KEY POINTS
- Discussion items with NO decision
- Each bullet under 140 characters
- Exclude unnecessary technical detail
`;
}

function getJsonSchema() {
  return `
REQUIRED JSON OUTPUT
{
  "decisions": [
    "Approved vendor selection for Q3 infrastructure upgrade (Moved by [Name], Unanimous)"
  ],
  "keyPoints": [
    "Team discussed rising cloud infrastructure costs."
  ],
  "nextSteps": [
    "Executive team to review updated budget at next meeting."
  ],
  "actionItems": [
    {
      "text": "Finalize contract with selected infrastructure vendor",
      "priority": "HIGH",
      "assignee": "Operations"
    }
  ]
}
`;
}

function getValidationRules() {
  return `
POST-VALIDATION CHECKLIST (MANDATORY)

A. Decisions
- Substantive and non-procedural
- Single verb-led sentence
- No invented names
- One mover max
- Seconder only if explicitly stated

B. Action Items
- Future-oriented only and explicitly stated
- One assignee
- No inferred tasks from role mentions
- Exclude already-completed actions
- Correct priority
- Overlaps merged

C. Key Points
- No decision content
- Under 140 characters
- Relevant only

D. Output Integrity
- Valid JSON only
- No commentary or markdown
- No empty arrays unless truly applicable
`;
}

function getTwoPassRules() {
  return `
TWO-PASS GENERATION PROCESS (MANDATORY)

PASS 1 — DRAFT
- Generate a complete draft JSON internally.
- Do NOT output this draft.

PASS 2 — VALIDATE & REGENERATE
- Apply the validation checklist.
- Regenerate a fully corrected JSON.

OUTPUT RULE
- Output ONLY the final corrected JSON.
`;
}
