# Handover: Battle of Interns

Everything a developer needs to take this project live and maintain it is in this repository. There are no hidden dependencies: no framework, no package manager, no build step for the live site, no external database server.

## What you are receiving

| Part | Where | Technology |
|---|---|---|
| Quiz page and admin panel | `public/index.html`, `public/assets/` | Plain HTML, CSS and JavaScript (no framework) |
| Backend API | `public/api/index.php` | One PHP 8 file, SQLite via PDO |
| Server settings | `public/api/config.php` | Edit before deployment |
| Question bank | `seed/questions.json`, `seed/questions.csv` | 25 approved questions, loaded on first run; editable later from the admin panel |
| Study materials | `public/materials/`, `seed/materials.json` | Six reference files, listed on first run; more can be uploaded from the admin panel |
| Standalone demo | `demo/`, `index.html` (root) | Same front end with a browser-storage backend; served on GitHub Pages |
| Documentation | `README.md` | Features, deployment, question management, API reference |

## Go-live checklist

1. Clone the repo. Open `public/api/config.php` and set `initial_admin_password` and `secret`.
2. Upload `public/` to the web root of a PHP 8 host (HTTPS required). Place `seed/` and `data/` one level above `public/`, exactly as in the repo. Make `data/` and `public/uploads/` writable by PHP. Check that a 20 MB upload works from Admin > Study materials (the included `.user.ini`/`.htaccess` raise the limit to 64 MB on most hosts).
3. Open the site once. The database and tables are created automatically; the 25 questions, 104 medical colleges and 6 study materials load.
4. Open `/#admin`, sign in, change the password (Settings tab).
5. Confirm the question set (Questions tab). Upload the SMS base (SMS base tab). Set the splash background and any banners (Splash & banners tab).
6. Settings > Quiz access: choose manual or scheduled. Registration can stay open while the quiz is closed; doctors register early and log in on quiz day. Confirm duration (10 min) and questions per attempt (25).
7. Run two or three test attempts from phones. Check the ranking board and the CSV exports.
8. Settings > Clear all participants. The quiz is live.

## Day-to-day operations (no developer needed)

- Open or close the quiz: Admin > Overview (one click) or schedule it in Settings.
- Add, edit or hide questions: Admin > Questions.
- Add study materials, banners, splash image: the matching admin tabs.
- Remind a doctor of their password (birth day + last 4 digits): Admin > Participants, Password column; override it with the Password button if needed.
- Compare with the SMS base: Admin > SMS base > Export match report.
- Watch participation and per-question accuracy: Admin > Overview.
- Look up a doctor, view their answer sheet, remove a duplicate: Admin > Participants.
- Download results: Admin > Participants > Export (participants CSV with rank, score, time; answers CSV with every response).
- Pause or close: Admin > Settings.

## Where to change things in code

| Change | File |
|---|---|
| Colours, fonts, spacing, background pattern opacity | `public/assets/app.css` (tokens at the top) |
| Wording on any screen, validation rules (phone format, birth day), the password formula | `public/assets/app.js` (search for the text) and `derived_password()` plus the `register` case in `public/api/index.php` |
| Scoring or ranking rule | `score_attempt()` and `rank_of()` in `public/api/index.php` |
| Allowed upload types and folders | `admin/upload` case in `public/api/index.php` |
| Splash, banner and pop-up layout | `.splash`, `.banner-top`, `.popup` rules in `public/assets/app.css` |
| Grace period after the timer, admin session length | `public/api/config.php` |
| Hero illustration and background motifs | `HERO_ART`, `MOTIFS` and `BG_ART` constants in `public/assets/app.js` |
| Demo page after any front-end change | run `python3 demo/build_demo.py` |

## Data and privacy

- Participant data (name, BMDC, phone, email, password hash) and the SMS base are stored only in `data/quiz.sqlite` on your server. Uploaded files live in `public/uploads/`. Both are excluded from git by `.gitignore`.
- Back up `data/quiz.sqlite` before and after the campaign.
- Delete the database or use Admin > Clear all participants when the data is no longer needed.

## Known limits and suggested next steps

- No SMS or email verification of the number; duplicates are prevented by BMDC/phone/email uniqueness only. Password reset is done by admin, not self-service.
- No rate limiting on the API. Add host-level rate limiting if the quiz is promoted widely.
- Single admin account. Add more if several people will manage the campaign.
- Optional features listed in README section 7 (OTP, certificates, negative marking).
