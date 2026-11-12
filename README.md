# Battle of Interns

Online MCQ quiz for intern doctors, run by Moxaclav (Square Pharmaceuticals PLC) for World AMR Awareness Week.

Two ways to run it:

1. **Demo (no server)**: open `demo/battle-of-interns-demo.html` in any browser. Everything is stored in that browser only. Use it for management approval.
2. **Live site (PHP + SQLite)**: upload the `public` folder to any web host that runs PHP 8. Shared across all participants, with a real ranking board and admin panel.

---

## 1. What the quiz does

**Participant side (`index.html`)**

| Feature | Detail |
|---|---|
| Start screen | Poster-style splash in the campaign's deep blue, with the "Moxaclav presents AMR Avengers" logo, the shield-and-capsule key visual, a gold "Register Now" button, a "Log in" link, the five terms and conditions in the footer and a link to the full text. Logo and key visual are replaceable from Admin > Splash & banners (`public/assets/img/` holds the defaults). |
| Accounts | Register once with name, mobile number (11 digits, 01XXXXXXXXX, the login ID), email, BMDC number (optional, free text), birth day (DD) and medical college (drop-down of 104 colleges A to Z, plus "Other" with free text). The password is standard for everyone: birth day + last 4 digits of the mobile number (born on the 20th, number ending 3344 = 203344). It is shown on the form before submitting and explained on the login page, so there is no forgot-password flow. Participants stay logged in on their device. Admin can still override a password. |
| Home page | After login: a "Thanks for registering" card with a large countdown to the scheduled start (or a placeholder until a date is set), then the Start button on the day; study materials; rules; ranking link. A horizontal banner on top and a pop-up banner (auto-closes after N seconds, closable) can be switched on from admin. |
| Quiz gating | The Start button appears only when the quiz is open. Admin opens/closes it manually or schedules an open and close time; participants see a live countdown. |
| Timed | 10 minutes by default (admin can change). The end time is fixed by the server when the quiz starts, so closing the tab does not pause it. The page auto-submits at 00:00. Timer turns amber at 2 minutes and red at 30 seconds. |
| 25 questions, one at a time | From the approved "Rational Use of Antimicrobial Agents" set. Shuffled per participant (admin can switch off). Pick an option, press Next. No going back. |
| Skip and return | "Skip for now" moves the question to the end of the queue. After the last question, skipped ones come back in order, marked "back for a second look". The progress line shows answered (teal) and skipped (amber). |
| Finish early | Available at any time, with a confirmation that shows how many questions are still unanswered. |
| Results and learning | Score, correct/wrong/unanswered, time taken, current rank. "Learn from mistakes" shows every wrong or unanswered question with the correct option and explanation. Admin can hold explanations back until the quiz closes. |
| Study materials | Six references are pre-loaded (WHO AWaRe classification, WHO AWaRe antibiotic book, WHO stewardship toolkit, Bangladesh STG, National AMR Surveillance Report, WHO EML 2023 Web Annex C). Admin can add, hide, reorder or delete materials, as uploaded files or links. |
| Ranking board | 1 point per correct answer, no negative marking. Ties are broken by faster completion time, then earlier submission. Winners are selected on this order. Top 50 shown, own row highlighted. Admin can hide the board. |
| Resume safety | Progress is saved to the server after every answer. Refreshing the page continues where the doctor left off. |
| Anti-cheat signals | Correct answers never leave the server during the quiz (scoring is server-side). Tab switches are counted and shown to admin. Submissions more than 20 seconds after the deadline are scored from the last saved progress and flagged "late". |
| Mobile first | Designed for phones; also works on desktop. Light and dark mode follow the device setting. |

**Admin panel (`index.html#admin`)**

There is no link to the admin panel on the participant pages on purpose. Open it by adding `#admin` to the quiz address, e.g. `https://your-domain/battle/#admin`.

| Tab | What you can do |
|---|---|
| Overview | Quiz access status with one-click Open / Close. Registered, completed, in progress, average score and time, SMS-base coverage. Per-question accuracy bars. |
| Ranking | Full ranking of everyone who finished (not just the top 50), visible to admin even when hidden from participants, with a one-click show/hide toggle. Download as Excel (.xlsx, phone numbers kept as text) or CSV. |
| Questions | Add, edit, hide or delete questions. Import from `.json` or `.csv` (append or replace all). Export all questions as JSON. |
| Participants | Search by name, BMDC, phone, email or college. Password column (birth day + last 4) to remind a doctor by phone. "In base / outside" badge against the SMS base. View a participant's answer sheet, set a new password, reset their attempt, or remove them. Export participants CSV and the full answers CSV. Phone numbers are exported as 11-digit text (Excel keeps the leading zero). |
| Study materials | Upload files (PDF, Excel, Word, PowerPoint, images) or add links; title, description, visible/hidden, reorder. |
| Splash & banners | Start screen: small line above the logo, logo image, headline, sub-line, key visual image, button text, background colours (top/middle/bottom), button colours, logo and visual sizes, hide logo or visual, reset to poster defaults. Top banner (image, link, on/off). Pop-up banner (image, link, seconds, on/off). |
| SMS base | Upload the SMS number list (.xlsx, .csv or .txt). Shows how many from the base registered and completed. Export the match report: every base number with registered / completed / score / rank, plus registrations from outside the base. |
| Medical colleges | Add or remove colleges from the registration drop-down, or restore the built-in list of 104. |
| Settings | Quiz access (manual open/close or scheduled start/end), registration open/closed, ranking board visible, show explanations after submission, duration, questions per attempt, shuffle, terms and conditions text, admin password, clear attempts, delete all participants. |

---|---|
| Overview | Registered, completed, average score, average time. Per-question accuracy bars (find the hardest questions). |
| Ranking | Full ranking of everyone who finished (not just the top 50), visible to admin even when hidden from participants, with a one-click show/hide toggle. Download as Excel (.xlsx, phone numbers kept as text) or CSV. |
| Questions | Add, edit, hide or delete questions. Import from `.json` or `.csv` (append or replace all). Export all questions as JSON. |
| Medical colleges | Add or remove colleges from the registration drop-down, filter the list, or restore the built-in list of 112 (`seed/institutions.json`). |
| Participants | Search by name, BMDC, phone, email or institution. View a participant's full answer sheet. Remove a participant (frees their BMDC number to retake). Export participants CSV (with rank, score, time, tab switches, late flag) and a full answers CSV (one row per question per participant). |
| Settings | Campaign name and brand line, duration, questions per attempt, open/close times, shuffle on/off, ranking board visible on/off, pause registration. Change admin password. "Clear all participants" to wipe test data before launch. |

---

## 2. Folder map

```
battle-of-interns/
  README.md                       this file
  public/                         upload THIS folder to the web host (it becomes the website)
    index.html                    the quiz page (and admin panel at #admin)
    assets/app.css                styles
    assets/app.js                 all screens: register, quiz, result, ranking, admin
    assets/api-remote.js          how the page talks to the PHP API
    api/index.php                 the whole backend (routes, scoring, timer, admin)
    api/config.php                settings to edit before going live
    materials/                    the six pre-loaded reference files
    uploads/                      files uploaded from the admin panel (materials, banners, splash); keep writable
    .user.ini and .htaccess       raise the PHP upload limit to 64 MB on most hosts
  data/                           the SQLite database is created here automatically (keep it out of git)
  seed/questions.json             the 30 starting questions, loaded on first run
  seed/questions.csv              same questions as a CSV template for admin import
  seed/institutions.json          the compiled list of 104 medical colleges for the type-ahead
  seed/materials.json             the six study materials loaded on first run
  demo/battle-of-interns-demo.html  standalone demo, no server needed
  demo/api-local.js               demo version of the API (browser storage)
  demo/build_demo.py              rebuilds the demo file after editing app.js or app.css
```

---

## 3. Deploying the live site (for the developer)

Requirements: PHP 8.0 or newer with `pdo_sqlite` (standard on almost every shared host, cPanel, Hostinger, etc.). No database server, no Composer, no build step.

1. **Edit `public/api/config.php`**
   - `initial_admin_password`: the first admin password (change it again from the admin panel after first login).
   - `secret`: paste any long random string.
   - `db_path`: leave as is (`data/quiz.sqlite`, outside `public`). If the host does not allow writing outside the web root, point it to a writable folder and protect it (see step 4).
2. **Upload** the contents of `public/` to the web root (e.g. `public_html/` or a sub-folder like `public_html/battle/`). Upload `seed/` and `data/` one level above, next to `public/`, matching the folder map. If you put the quiz in a sub-folder, keep the same relative layout.
3. **Make `data/` and `public/uploads/` writable** by PHP (permissions 755 or 775 usually; 777 only if the host insists). The database and tables are created on the first request; the seed questions, medical colleges and study materials load automatically.
   The included `public/.user.ini` and `public/.htaccess` raise the PHP upload limit to 64 MB so large PDFs can be added from the admin panel. If uploads still fail with "larger than the server allows", set `upload_max_filesize` and `post_max_size` in the host's PHP settings panel.
4. **Protect the database.** `data/.htaccess` already denies web access on Apache. On Nginx add:
   ```
   location ~ /data/ { deny all; }
   ```
5. **HTTPS** is required in practice (participants enter phone numbers). Use the host's free Let's Encrypt certificate.
6. Open `https://your-domain/battle/` and `https://your-domain/battle/#admin`. Sign in, go to Settings, change the password, set the open/close times, then "Clear all participants" before launch.

Optional: to serve the API from a different domain than the page, set `cors_origins` in `config.php` and `window.BOI_API_BASE = "https://api-domain/api/index.php"` in `index.html` before `api-remote.js`.

**Running locally for a quick check**

```
php -S localhost:8080 -t public
```
then open http://localhost:8080 . Delete `data/quiz.sqlite` to start fresh.

---

## 4. Managing questions

Three ways, all equivalent:

- **Admin panel** (recommended for marketing): Questions > Add question, or Import.
- **CSV import**: columns `question, option_a, option_b, option_c, option_d, correct, explanation`. `correct` is A, B, C or D. `seed/questions.csv` is a filled template; edit it in Excel, save as CSV (UTF-8), import.
- **Seed file**: replace `seed/questions.json` before first deployment. It is only read when the database is created.

The seed file holds the 25 approved questions from "Rational Use of Antimicrobial Agents - MCQ Questionnaire for Intern Doctors" with explanations and references.

---

## 5. API reference (for the developer)

All routes: `POST api/index.php?r=<route>` with a JSON body, JSON reply. Errors come back as `{"error": "message"}` with a 4xx status. Admin routes need the header `X-Admin-Token` from `admin/login`.

| Route | Body | Returns |
|---|---|---|
| `settings` | | public settings: quiz state, splash, banners, terms, colleges |
| `register` | name, email, bmdc (optional), phone, institution, birthDay, consent | `{token}` (logged in); password = birthDay + last 4 digits of phone |
| `login` | phone, password | `{token}` |
| `me` | token | participant, attempt summary, visible materials |
| `start` | token | attempt with questions (no answer keys), endsAt, saved answers; refused unless the quiz is open |
| `progress` | token, answers, tabSwitches | `{ok}` |
| `submit` | token, answers, tabSwitches | full result with review and rank |
| `result` | token | result if completed |
| `leaderboard` | token (optional) | top 50 + own row |
| `admin/login` | password | `{adminToken}` (valid 8 h) |
| `admin/upload` | multipart: kind (materials/banners/splash), file | `{url, size, type}` |
| `admin/stats`, `admin/questions`, `admin/question-save`, `admin/question-delete`, `admin/question-import`, `admin/participants`, `admin/participant-answers`, `admin/participant-delete`, `admin/participant-password`, `admin/participant-reset-attempt`, `admin/ranking`, `admin/export` (kind: participants, answers, smsmatch), `admin/institutions`, `admin/institutions-save`, `admin/materials`, `admin/material-save`, `admin/material-delete`, `admin/material-order`, `admin/smsbase-upload`, `admin/smsbase-stats`, `admin/smsbase-clear`, `admin/settings`, `admin/settings-save`, `admin/password`, `admin/reset`, `admin/reset-attempts` | see `assets/api-remote.js` | |

Database tables: `settings`, `questions`, `participants` (with password hash), `attempts` (one per participant; answers stored as JSON), `materials`, `sms_base`. Created automatically in `api/index.php`; an older database is upgraded in place.

---

## 6. Rebuilding the demo after changes

Edit `public/assets/app.js` or `app.css`, then run:

```
python3 demo/build_demo.py
```

This regenerates `demo/battle-of-interns-demo.html`. The demo admin password is `admin123` and is stored in the browser only.

---

## 7. Ideas not built yet (easy to add later)

- OTP verification of the mobile number by SMS before the quiz starts.
- Email the result and a certificate of participation (needs an SMTP account on the host).
- Negative marking or per-question time limits.
- Lock the quiz to a single device fingerprint per BMDC number.
- Pull BMDC numbers from an approved list so only invited interns can register.
