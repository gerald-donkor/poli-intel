# EviBrief Demo Script

This script provides a click-by-click walkthrough for demonstrating EviBrief to Tropenbos Ghana. It relies on the local database being populated via `npm run db:seed`.

## Pre-demo Checklist

1. **Configure Staff Emails:**
   In `.env.local`, set the four `SEED_*_EMAIL` variables to the real Google Workspace accounts of the people attending the demo (or your own testing accounts):
   ```
   SEED_DIRECTOR_EMAIL=director@example.org
   SEED_POLICY_OFFICER_EMAIL=policy@example.org
   SEED_RESEARCH_OFFICER_EMAIL=research@example.org
   SEED_FIELD_OFFICER_EMAIL=field@example.org
   ```
   *If these are not set, sign-in will create a default Field Officer account instead of the appropriate role.*

2. **Prepare the Database:**
   Run the migration and seed scripts:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
   *(Running the seed script a second time is a safe no-op.)*

3. **Start the Application:**
   ```bash
   npm run dev
   ```

4. **Optional: Start the Inngest Dev Server:**
   To show live background jobs (e.g., the Evidence Matcher), open a new terminal and run:
   ```bash
   npm run inngest:dev
   ```

## Walkthrough

### 1. The Evidence Library (Research Officer or Director)
- **Sign in** with the Google account configured for `SEED_DIRECTOR_EMAIL` or `SEED_RESEARCH_OFFICER_EMAIL`.
- **Navigate** to the Evidence Library.
- **Show Classification States:**
  - Notice the "Pending Classification" alert at the top showing the queue count.
  - Filter by `public_published` to see embedded, searchable items (like the EUDR regulation text and Forestry Commission notice).
  - Filter by `community_sourced` to see field data that is intentionally kept out of the generative pipeline.
  - **State Proved:** "A queue holding new uploads pending a Research Officer's classification decision."

### 2. The Signal Board (Policy Advocacy Officer or Director)
- **Navigate** to Policy Radar (the Signal Board).
- **Show Kanban States:**
  - Observe signals in different lanes (e.g., Immediate, Near Term).
  - Click on the **EUDR deforestation-free supply chains notice** signal.
  - View its **Evidence Matcher panel**. You will see the retrieved evidence chunks and their relevance scores.
  - Note another signal where the Matcher outcome is an explicit gap ("No matching evidence found") — proving that silence is reported, not assumed.
  - **State Proved:** "A policy signal with the Evidence Matcher panel showing explicit gap outcomes."

### 3. Brief Generation and Hallucination Guard
- **Navigate** to Briefs and open the seeded generated brief (the EUDR brief).
- **Show the Hallucination Flag:**
  - Point out the open flag in the text (it will have the slate/pulse treatment or reduced-motion equivalent).
  - Click **Approve** (as Programme Director).
  - **Observe the server-side refusal:** The system blocks approval while an unsupported claim is open.
  - **Resolve the flag:** Click the flag, provide a resolution reason (e.g., "Verified against source paragraph 4"), and resolve it.
  - Click **Approve** again. It succeeds, and the status changes to "Published".
  - **State Proved:** "A draft brief showing the hallucination guard's slate/pulse treatment on an unsupported claim." (and the refusal logic).

### 4. Brief Export and Audience Switching
- **Show Export:**
  - Click the **Export to Word** button. Confirm the `.docx` file downloads.
- **Show Audience Switcher:**
  - On the same brief, use the Audience Switcher (e.g., switch from Ghana Ministry Official to EU Regulator).
  - A diff view appears, showing the proposed reframing.
  - Discard the changes to prove the approved version is not mutated.

### 5. Stakeholder CRM
- **Navigate** to Stakeholders.
- **Show Share History:**
  - Select the seeded stakeholder (e.g., "Dr. Kwame Mensah" at "Ministry of Lands and Natural Resources").
  - View the brief history to see the EUDR brief was shared with them.

### 6. Impact Map
- **Navigate** to the Impact Map.
- **Show Verified Influence:**
  - Point out the drawn path indicating a verified influence event (e.g., a "National Strategy" alignment).

### 7. Field Submissions (Field Officer)
- **Sign out**, then **Sign in** with the Google account configured for `SEED_FIELD_OFFICER_EMAIL`.
- **Navigate** to Field Submissions.
- **Show the Queue:**
  - See the pending field submission in their history.
  - Emphasize that this submission is *not* visible in the Evidence Library's generative path—it is held in the `community_sourced` state awaiting review by a Research Officer or Director.
  - **State Proved:** "The Field Officer dashboard showing a submission queued for review."

### 8. Offline Fallback (Network Disconnection)
- **Simulate Offline:**
  - In your browser's DevTools (Network tab), set throttling to "Offline".
  - Refresh the page or attempt to navigate.
  - **Show the Banner:** The offline banner appears, explaining what is cached and what is unavailable.
  - **State Proved:** "The offline fallback banner shown when network is lost."

## Caveats and Not Wired Yet
Honesty builds trust. Be upfront about these components which are documented as inert-by-default or pending configuration:
- **PDF Export:** Pandoc is an external dependency not available on standard Vercel deployments. It requires a custom host setup (e.g., `PANDOC_BIN`). Word export works everywhere.
- **Sentry & PostHog:** Error tracking and analytics are inert unless their respective `.env` variables are configured.
- **WhatsApp / USSD:** Real messaging credentials (Meta Cloud API, Africa's Talking) are not wired in this demo. The web UI reflects their intended state.