/* Demo adapter: same functions as api-remote.js, but everything is kept in this browser's
   localStorage. Used only for the standalone demo page. Nothing is sent anywhere. */
window.BOI_API = (function () {
  "use strict";
  const KEY = "boi_demo_v5";
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));
  const fail = (m) => { throw new Error(m); };
  const norm = (s) => String(s || "").trim();
  const normBmdc = (s) => norm(s).toUpperCase().replace(/\s+/g, " ").slice(0, 40);
  const normPhone = (s) => norm(s).replace(/[^\d+]/g, "").replace(/^\+?88/, "");
  const DEFAULT_TERMS = "1. Participation is open exclusively to medical doctors currently serving as interns in recognized medical colleges or hospitals in Bangladesh.\n2. Each participant can register and participate only once.\n3. The quiz must be completed within the stipulated time using a personal internet-enabled device.\n4. Winners will be selected based on scores and completion time. The organizer's decision will be final.\n5. The organizer reserves the right to disqualify participants for unfair practices and modify or cancel the campaign if necessary.";
  const defaultSettings = () => ({ campaignName: "Battle of Interns", sponsor: "Moxaclav", durationSec: 600, questionCount: 25, shuffle: true, leaderboardPublic: true, showExplanations: true, registrationOpen: true,
    quizMode: "manual", quizOpen: true, quizStartAt: null, quizEndAt: null,
    splashIcon: "", splashVisual: "", splashKicker: "World AMR Awareness Week · 18 to 24 November", splashCta: "Register Now", splashTheme: {}, splashHeadline: "Battle of Interns", splashSub: "An online quiz on rational antimicrobial use for intern doctors of Bangladesh. World AMR Awareness Week, 18 to 24 November.",
    bannerTop: { enabled: false, image: "", link: "" }, bannerPopup: { enabled: false, image: "", link: "", seconds: 10 }, terms: DEFAULT_TERMS });
  const seedMaterials = () => (window.BOI_SEED_MATERIALS || []).map((m, i) => ({ id: "m" + (i + 1), title: m.title, description: m.description || "", url: m.url || ((window.BOI_ASSET_BASE || "") + "materials/" + m.file), type: m.type || "link", size: m.size || null, visible: true, createdAt: Date.now() }));

  function seed() {
    const questions = (window.BOI_SEED_QUESTIONS || []).map((q, i) => ({ id: "q" + (i + 1), text: q.text, options: q.options, correct: q.correct, explanation: q.explanation, active: true }));
    const db = { settings: defaultSettings(), adminPassword: "admin123", questions, participants: [], attempts: [], institutions: (window.BOI_SEED_INSTITUTIONS || []).slice(), materials: seedMaterials(), smsBase: [] };
    // A few sample finishers so the ranking board is not empty in the demo. Admin > Settings > Delete all participants removes them.
    const samples = [["Dr. Tanvir Ahmed", "Dhaka Medical College Hospital (DMCH)", 23, 412], ["Dr. Nusrat Jahan", "Sir Salimullah Medical College Hospital", 22, 388], ["Dr. Rafiul Islam", "Chittagong Medical College Hospital", 22, 455], ["Dr. Farhana Haque", "Mymensingh Medical College Hospital", 20, 501], ["Dr. Sabbir Hossain", "Rajshahi Medical College & Hospital", 18, 530], ["Dr. Mehzabin Chowdhury", "Sylhet MAG Osmani Medical College Hospital", 15, 572]];
    samples.forEach(([name, inst, score, secs], i) => {
      const pid = "sample" + i, now = Date.now() - (i + 1) * 3600 * 1000;
      const ph = "017000000" + (10 + i); db.participants.push({ id: pid, token: "t_" + pid, name, email: "sample" + (i + 1) + "@example.com", bmdc: "A-" + (100001 + i), phone: ph, institution: inst, birthDay: "15", password: "15" + ph.slice(-4), registeredAt: now, lastLoginAt: now });
      const order = questions.map((q) => q.id).slice(0, db.settings.questionCount);
      const answers = {}; let wrongLeft = order.length - score;
      order.forEach((qid) => { const q = questions.find((x) => x.id === qid); if (wrongLeft > 0 && Math.random() < 0.35) { answers[qid] = ["A", "B", "C", "D"].find((k) => k !== q.correct); wrongLeft--; } else answers[qid] = q.correct; });
      for (const qid of order) { if (wrongLeft <= 0) break; const q = questions.find((x) => x.id === qid); if (answers[qid] === q.correct) { answers[qid] = ["A", "B", "C", "D"].find((k) => k !== q.correct); wrongLeft--; } }
      const a = { id: "a_" + pid, participantId: pid, startedAt: now, endsAt: now + 600000, order, answers, tabSwitches: i === 4 ? 5 : 0, status: "completed", submittedAt: now + secs * 1000 };
      Object.assign(a, scoreAttempt(db, a)); db.attempts.push(a);
    });
    db.smsBase = db.participants.slice(0, 4).map((p) => p.phone).concat(["01700000099", "01800000098"]);
    return db;
  }
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.questions) { s.settings = Object.assign(defaultSettings(), s.settings); if (!s.materials) s.materials = seedMaterials(); if (!s.smsBase) s.smsBase = []; return s; } } catch (e) {} const db = seed(); save(db); return db; }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { fail("The demo could not save (browser storage is full or blocked). Images in the demo must be small."); } }

  function quizState(s) {
    const now = Date.now();
    if (s.quizMode === "scheduled") {
      if (s.quizStartAt && now < s.quizStartAt) return { state: "scheduled", startAt: s.quizStartAt, endAt: s.quizEndAt || null };
      if (s.quizEndAt && now >= s.quizEndAt) return { state: "closed", startAt: s.quizStartAt || null, endAt: s.quizEndAt };
      return { state: "open", startAt: s.quizStartAt || null, endAt: s.quizEndAt || null };
    }
    return { state: s.quizOpen ? "open" : "locked", startAt: null, endAt: null };
  }
  function sortedInst(list) { return list.slice().sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })); }
  function publicSettings(db) {
    const s = db.settings; const ac = db.questions.filter((q) => q.active).length;
    return { campaignName: s.campaignName, sponsor: s.sponsor, durationSec: s.durationSec, questionCount: ac ? Math.min(s.questionCount, ac) : s.questionCount, leaderboardPublic: s.leaderboardPublic, showExplanations: s.showExplanations !== false, registrationOpen: s.registrationOpen !== false,
      quiz: Object.assign(quizState(s), { serverNow: Date.now() }), splash: { icon: s.splashIcon || "", visual: s.splashVisual || "", kicker: s.splashKicker, cta: s.splashCta || "Register Now", theme: s.splashTheme || {}, headline: s.splashHeadline, sub: s.splashSub }, banners: { top: s.bannerTop, popup: s.bannerPopup }, terms: s.terms || DEFAULT_TERMS, institutions: sortedInst(db.institutions || []), demo: true };
  }
  function scoreAttempt(db, a) {
    let correct = 0, wrong = 0, skipped = 0;
    for (const qid of a.order) { const q = db.questions.find((x) => x.id === qid); const ans = a.answers[qid]; if (!ans) skipped++; else if (q && ans === q.correct) correct++; else wrong++; }
    const timeTakenSec = Math.min(Math.round((a.submittedAt - a.startedAt) / 1000), Math.round((a.endsAt - a.startedAt) / 1000));
    return { score: correct, correct, wrong, skipped, total: a.order.length, timeTakenSec: Math.max(0, timeTakenSec) };
  }
  function ranked(db) {
    return db.attempts.filter((a) => a.status === "completed").sort((x, y) => y.score - x.score || x.timeTakenSec - y.timeTakenSec || x.submittedAt - y.submittedAt)
      .map((a, i) => ({ a, p: db.participants.find((p) => p.id === a.participantId), rank: i + 1 }));
  }
  function result(db, a, p) {
    const r = ranked(db).find((x) => x.a.id === a.id); const showExp = db.settings.showExplanations !== false;
    const review = a.order.map((qid, i) => { const q = db.questions.find((x) => x.id === qid) || { text: "(question removed)", options: {}, correct: "", explanation: "" }; const ya = a.answers[qid] || null; const base = { number: i + 1, id: qid, text: q.text, options: ["A", "B", "C", "D"].filter((k) => q.options[k]).map((k) => ({ key: k, text: q.options[k] })), yourAnswer: ya, isCorrect: ya === q.correct }; return showExp ? Object.assign(base, { correct: q.correct, explanation: q.explanation }) : base; });
    return { completed: true, name: p.name, score: a.score, total: a.total, correct: a.correct, wrong: a.wrong, skipped: a.skipped, timeTakenSec: a.timeTakenSec, rank: r ? r.rank : null, totalParticipants: db.attempts.filter((x) => x.status === "completed").length, showExplanations: showExp, review };
  }
  function pByToken(db, token) { if (!token) fail("Please log in."); const p = db.participants.find((x) => x.token === token); if (!p) fail("Your session has expired. Please log in again."); return p; }
  function adminCheck(db, token) { if (!token || token !== db._adminToken) fail("Unauthorised. Please sign in."); }
  const csvCell = (v) => { const s = String(v ?? ""); if (s.startsWith('="')) return s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const csvPhone = (p) => '="' + p + '"';
  const pRow = (db, p) => { const a = db.attempts.find((x) => x.participantId === p.id); return { id: p.id, name: p.name, email: p.email, bmdc: p.bmdc, phone: p.phone, institution: p.institution, birthDay: p.birthDay || "", registeredAt: p.registeredAt, lastLoginAt: p.lastLoginAt || null, status: a ? a.status : "registered", score: a && a.score != null ? a.score : null, total: a && a.total ? a.total : null, timeTakenSec: a && a.timeTakenSec != null ? a.timeTakenSec : null, tabSwitches: a ? a.tabSwitches : 0, submittedAt: a && a.submittedAt ? a.submittedAt : null, late: false, inBase: db.smsBase.includes(p.phone), aid: a && a.id }; };
  const readAsDataUrl = (file) => new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = () => rej(new Error("Could not read the file.")); rd.readAsDataURL(file); });

  return {
    async getSettings() { return delay(publicSettings(load())); },

    async register(d) {
      const db = load();
      if (db.settings.registrationOpen === false) fail("Registration is closed.");
      const bmdc = normBmdc(d.bmdc), phone = normPhone(d.phone), email = norm(d.email).toLowerCase();
      let bd = norm(d.birthDay).replace(/\D/g, ""); if (bd.length === 1) bd = "0" + bd;
      if (!/^01[3-9]\d{8}$/.test(phone)) fail("Enter an 11-digit Bangladeshi mobile number.");
      if (!/^(0[1-9]|[12]\d|3[01])$/.test(bd)) fail("Enter the day of the month you were born (01 to 31).");
      const ex = db.participants.find((p) => p.phone === phone || p.email === email || (bmdc && p.bmdc === bmdc));
      if (ex) { if (ex.phone === phone) fail("This mobile number is already registered. Log in instead."); if (bmdc && ex.bmdc === bmdc) fail("This BMDC number is already registered. Log in with the mobile number you used."); fail("This email is already registered. Log in with the mobile number you used."); }
      const p = { id: uid(), token: "t_" + uid(), name: norm(d.name), email, bmdc, phone, institution: norm(d.institution), birthDay: bd, password: bd + phone.slice(-4), registeredAt: Date.now(), lastLoginAt: Date.now() };
      db.participants.push(p); save(db);
      return delay({ token: p.token });
    },
    async login(phone, password) {
      const db = load(); const p = db.participants.find((x) => x.phone === normPhone(phone));
      if (!p || p.password !== password) fail("Mobile number or password is incorrect.");
      p.lastLoginAt = Date.now(); save(db); return delay({ token: p.token });
    },
    async logout() { return { ok: true }; },
    async me(token) {
      const db = load(); const p = pByToken(db, token); const a = db.attempts.find((x) => x.participantId === p.id);
      const r = a && a.status === "completed" ? ranked(db).find((x) => x.a.id === a.id) : null;
      return delay({ participant: { id: p.id, name: p.name, phone: p.phone, email: p.email, bmdc: p.bmdc, institution: p.institution, birthDay: p.birthDay || "" }, attempt: a ? { status: a.status, score: a.score ?? null, total: a.total ?? null, timeTakenSec: a.timeTakenSec ?? null, rank: r ? r.rank : null, endsAt: a.endsAt } : null, materials: db.materials.filter((m) => m.visible) });
    },

    async startAttempt(token) {
      const db = load(); const p = pByToken(db, token);
      let a = db.attempts.find((x) => x.participantId === p.id);
      if (a && a.status === "completed") fail("You have already completed the quiz.");
      if (!a) {
        const qs = quizState(db.settings); if (qs.state !== "open") fail(qs.state === "closed" ? "The quiz is closed." : "The quiz has not opened yet.");
        const active = db.questions.filter((q) => q.active); if (!active.length) fail("No questions are available yet.");
        let order = active.map((q) => q.id); if (db.settings.shuffle) order.sort(() => Math.random() - 0.5); order = order.slice(0, db.settings.questionCount);
        const now = Date.now();
        a = { id: uid(), participantId: p.id, startedAt: now, endsAt: now + db.settings.durationSec * 1000, order, answers: {}, tabSwitches: 0, status: "in_progress" };
        db.attempts.push(a); save(db);
      }
      const questions = a.order.map((qid) => { const q = db.questions.find((x) => x.id === qid); return { id: qid, text: q ? q.text : "(removed)", options: q ? ["A", "B", "C", "D"].filter((k) => q.options[k]).map((k) => ({ key: k, text: q.options[k] })) : [] }; });
      return delay({ attemptId: a.id, startedAt: a.startedAt, endsAt: a.endsAt, durationSec: db.settings.durationSec, questions, answers: a.answers, tabSwitches: a.tabSwitches, serverNow: Date.now() });
    },
    async saveProgress(token, { answers, tabSwitches }) {
      const db = load(); const p = pByToken(db, token); const a = db.attempts.find((x) => x.participantId === p.id && x.status === "in_progress");
      if (!a) return { ok: true }; a.answers = Object.assign({}, a.answers, answers || {}); a.tabSwitches = Math.max(a.tabSwitches, tabSwitches || 0); save(db); return { ok: true };
    },
    async submitAttempt(token, { answers, tabSwitches }) {
      const db = load(); const p = pByToken(db, token); const a = db.attempts.find((x) => x.participantId === p.id); if (!a) fail("No attempt found.");
      if (a.status !== "completed") { a.answers = Object.assign({}, a.answers, answers || {}); a.tabSwitches = Math.max(a.tabSwitches, tabSwitches || 0); a.submittedAt = Date.now(); a.status = "completed"; Object.assign(a, scoreAttempt(db, a)); save(db); }
      return delay(result(db, a, p));
    },
    async getResult(token) { const db = load(); const p = pByToken(db, token); const a = db.attempts.find((x) => x.participantId === p.id); if (!a || a.status !== "completed") return { completed: false }; return delay(result(db, a, p)); },
    async getLeaderboard(token) {
      const db = load(); if (!db.settings.leaderboardPublic && !db._adminToken) fail("The ranking board is not public right now.");
      const me = token ? db.participants.find((p) => p.token === token) : null; const all = ranked(db);
      const rows = all.slice(0, 50).map((x) => ({ rank: x.rank, name: x.p.name, institution: x.p.institution, score: x.a.score, total: x.a.total, timeTakenSec: x.a.timeTakenSec, isMe: !!me && x.p.id === me.id }));
      const mine = me ? all.find((x) => x.p.id === me.id) : null;
      return delay({ rows, totalParticipants: all.length, me: mine ? { rank: mine.rank, name: me.name, score: mine.a.score, total: mine.a.total, timeTakenSec: mine.a.timeTakenSec } : null });
    },

    /* ---- admin ---- */
    async adminLogin(password) { const db = load(); if (password !== db.adminPassword) fail("Wrong password."); db._adminToken = "adm_" + uid(); save(db); return delay({ adminToken: db._adminToken }); },
    async adminLogout() { const db = load(); delete db._adminToken; save(db); },
    async adminStats(t) {
      const db = load(); adminCheck(db, t); const done = db.attempts.filter((a) => a.status === "completed");
      const qs = db.questions.map((q) => { let attempts = 0, correct = 0; done.forEach((a) => { if (a.order.includes(q.id)) { attempts++; if (a.answers[q.id] === q.correct) correct++; } }); return { id: q.id, text: q.text, attempts, correct }; });
      const fromBase = db.participants.filter((p) => db.smsBase.includes(p.phone)).length;
      return delay({ participants: db.participants.length, completed: done.length, inProgress: db.attempts.length - done.length, total: Math.min(db.settings.questionCount, db.questions.filter((q) => q.active).length), avgScore: done.length ? done.reduce((s, a) => s + a.score, 0) / done.length : 0, avgTimeSec: done.length ? done.reduce((s, a) => s + a.timeTakenSec, 0) / done.length : 0, questionStats: qs, quiz: quizState(db.settings), quizMode: db.settings.quizMode, smsBase: db.smsBase.length, fromBase });
    },
    async adminQuestions(t) { const db = load(); adminCheck(db, t); return delay(db.questions.map((q) => ({ ...q }))); },
    async adminSaveQuestion(t, q) {
      const db = load(); adminCheck(db, t);
      if (!q.text || !["A", "B", "C", "D"].every((k) => q.options[k]) || !/^[ABCD]$/.test(q.correct)) fail("Fill in the question, all four options and the correct option.");
      if (q.id) { const i = db.questions.findIndex((x) => x.id === q.id); if (i < 0) fail("Question not found."); db.questions[i] = { ...db.questions[i], text: q.text, options: q.options, correct: q.correct, explanation: q.explanation || "", active: !!q.active }; }
      else db.questions.push({ id: "q_" + uid(), text: q.text, options: q.options, correct: q.correct, explanation: q.explanation || "", active: q.active !== false });
      save(db); return { ok: true };
    },
    async adminDeleteQuestion(t, id) { const db = load(); adminCheck(db, t); db.questions = db.questions.filter((q) => q.id !== id); save(db); return { ok: true }; },
    async adminImportQuestions(t, list, replace) { const db = load(); adminCheck(db, t); if (replace) db.questions = []; list.forEach((q) => db.questions.push({ id: "q_" + uid(), text: q.text, options: q.options, correct: q.correct, explanation: q.explanation || "", active: true })); save(db); return { count: list.length }; },
    async adminParticipants(t, { q } = {}) {
      const db = load(); adminCheck(db, t); const s = (q || "").toLowerCase();
      return delay(db.participants.filter((p) => !s || [p.name, p.bmdc, p.phone, p.email, p.institution].some((v) => String(v || "").toLowerCase().includes(s))).sort((a, b) => b.registeredAt - a.registeredAt).map((p) => pRow(db, p)));
    },
    async adminParticipantAnswers(t, id) {
      const db = load(); adminCheck(db, t); const a = db.attempts.find((x) => x.participantId === id); if (!a) fail("No attempt.");
      return delay(a.order.map((qid) => { const q = db.questions.find((x) => x.id === qid) || { text: "(removed)", correct: "" }; return { text: q.text, answer: a.answers[qid] || null, correct: q.correct, isCorrect: a.answers[qid] === q.correct }; }));
    },
    async adminDeleteParticipant(t, id) { const db = load(); adminCheck(db, t); db.participants = db.participants.filter((p) => p.id !== id); db.attempts = db.attempts.filter((a) => a.participantId !== id); save(db); return { ok: true }; },
    async adminSetParticipantPassword(t, id, pw) { const db = load(); adminCheck(db, t); const p = db.participants.find((x) => x.id === id); if (!p) fail("Participant not found."); if (!pw || pw.length < 6) fail("Password must be at least 6 characters."); p.password = pw; save(db); return { ok: true }; },
    async adminResetParticipantAttempt(t, id) { const db = load(); adminCheck(db, t); db.attempts = db.attempts.filter((a) => a.participantId !== id); save(db); return { ok: true }; },
    async adminExport(t, kind) {
      const db = load(); adminCheck(db, t); const stamp = new Date().toISOString().slice(0, 10); const rk = ranked(db); const rankOf = (p) => { const r = rk.find((x) => x.p.id === p.id); return r ? r.rank : ""; };
      if (kind === "answers") {
        const rows = [["name", "phone", "bmdc", "question_no", "question", "answer", "correct_option", "is_correct"]];
        db.attempts.filter((a) => a.status === "completed").forEach((a) => { const p = db.participants.find((x) => x.id === a.participantId); a.order.forEach((qid, i) => { const q = db.questions.find((x) => x.id === qid) || { text: "", correct: "" }; rows.push([p.name, csvPhone(p.phone), p.bmdc, i + 1, q.text, a.answers[qid] || "", q.correct, a.answers[qid] === q.correct ? 1 : 0]); }); });
        return { filename: `battle-of-interns-answers-${stamp}.csv`, csv: csv(rows) };
      }
      if (kind === "smsmatch") {
        const rows = [["phone", "in_sms_base", "registered", "name", "bmdc", "email", "institution", "status", "score", "total", "time_taken_sec", "rank", "registered_at"]];
        const byPhone = new Map(db.participants.map((p) => [p.phone, p]));
        db.smsBase.slice().sort().forEach((ph) => { const p = byPhone.get(ph); const r = p ? pRow(db, p) : null; rows.push([csvPhone(ph), "yes", p ? "yes" : "no", r ? r.name : "", r ? r.bmdc : "", r ? r.email : "", r ? r.institution : "", r ? r.status : "", r && r.score != null ? r.score : "", r && r.total ? r.total : "", r && r.timeTakenSec != null ? r.timeTakenSec : "", p ? rankOf(p) : "", p ? new Date(p.registeredAt).toISOString() : ""]); byPhone.delete(ph); });
        byPhone.forEach((p) => { const r = pRow(db, p); rows.push([csvPhone(p.phone), "no", "yes", r.name, r.bmdc, r.email, r.institution, r.status, r.score ?? "", r.total ?? "", r.timeTakenSec ?? "", rankOf(p), new Date(p.registeredAt).toISOString()]); });
        return { filename: `battle-of-interns-sms-base-match-${stamp}.csv`, csv: csv(rows) };
      }
      const rows = [["rank", "name", "phone", "bmdc", "email", "institution", "birth_day", "in_sms_base", "registered_at", "status", "score", "total", "time_taken_sec", "tab_switches", "late_submission", "submitted_at"]];
      db.participants.forEach((p) => { const r = pRow(db, p); rows.push([rankOf(p), r.name, csvPhone(r.phone), r.bmdc, r.email, r.institution, csvPhone(r.birthDay), r.inBase ? "yes" : "no", new Date(r.registeredAt).toISOString(), r.status, r.score ?? "", r.total ?? "", r.timeTakenSec ?? "", r.tabSwitches, "", r.submittedAt ? new Date(r.submittedAt).toISOString() : ""]); });
      return { filename: `battle-of-interns-participants-${stamp}.csv`, csv: csv(rows) };
    },
    async adminInstitutions(t) { const db = load(); adminCheck(db, t); return delay(sortedInst(db.institutions || [])); },
    async adminSaveInstitutions(t, list) { const db = load(); adminCheck(db, t); db.institutions = list === null ? (window.BOI_SEED_INSTITUTIONS || []).slice() : list.map((x) => String(x).trim()).filter(Boolean); save(db); return { ok: true }; },
    async adminMaterials(t) { const db = load(); adminCheck(db, t); return delay(db.materials.slice()); },
    async adminSaveMaterial(t, m) {
      const db = load(); adminCheck(db, t); if (!m.title || !m.url) fail("Give the material a title and a file or link.");
      if (m.id) { const i = db.materials.findIndex((x) => x.id === m.id); if (i < 0) fail("Material not found."); db.materials[i] = { ...db.materials[i], title: m.title, description: m.description || "", url: m.url, type: m.type || "link", size: m.size || null, visible: m.visible !== false }; }
      else db.materials.push({ id: "m_" + uid(), title: m.title, description: m.description || "", url: m.url, type: m.type || "link", size: m.size || null, visible: m.visible !== false, createdAt: Date.now() });
      save(db); return { ok: true };
    },
    async adminDeleteMaterial(t, id) { const db = load(); adminCheck(db, t); db.materials = db.materials.filter((m) => m.id !== id); save(db); return { ok: true }; },
    async adminOrderMaterials(t, ids) { const db = load(); adminCheck(db, t); db.materials.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); save(db); return { ok: true }; },
    async adminUpload(t, kind, file) {
      const db = load(); adminCheck(db, t);
      if (file.size > 2.5 * 1024 * 1024) fail("The demo keeps files in your browser, so uploads are limited to 2.5 MB here. The live site accepts full-size files.");
      const url = await readAsDataUrl(file); const ext = (file.name.split(".").pop() || "").toLowerCase();
      return { url, name: file.name, size: file.size, type: ["pdf", "xlsx", "xls", "docx", "doc", "pptx", "png", "jpg", "jpeg"].includes(ext) ? ext : "file" };
    },
    async adminSmsBaseUpload(t, phones, replace) {
      const db = load(); adminCheck(db, t); if (replace) db.smsBase = []; let added = 0, invalid = 0; const set = new Set(db.smsBase);
      phones.forEach((raw) => { const ph = normPhone(raw); if (/^01[3-9]\d{8}$/.test(ph)) { if (!set.has(ph)) { set.add(ph); added++; } } else invalid++; });
      db.smsBase = Array.from(set); save(db); return { added, invalid, total: db.smsBase.length };
    },
    async adminSmsBaseStats(t) { const db = load(); adminCheck(db, t); const inBase = db.participants.filter((p) => db.smsBase.includes(p.phone)); return delay({ total: db.smsBase.length, registered: inBase.length, completed: inBase.filter((p) => db.attempts.some((a) => a.participantId === p.id && a.status === "completed")).length, outsideBase: db.participants.length - inBase.length }); },
    async adminSmsBaseClear(t) { const db = load(); adminCheck(db, t); db.smsBase = []; save(db); return { ok: true }; },
    async adminSettings(t) { const db = load(); adminCheck(db, t); return delay({ ...db.settings }); },
    async adminSaveSettings(t, s) { const db = load(); adminCheck(db, t); db.settings = { ...db.settings, ...s }; save(db); return { ok: true }; },
    async adminChangePassword(t, oldPw, newPw) { const db = load(); adminCheck(db, t); if (oldPw !== db.adminPassword) fail("Current password is wrong."); if ((newPw || "").length < 8) fail("New password must be at least 8 characters."); db.adminPassword = newPw; save(db); return { ok: true }; },
    async adminReset(t) { const db = load(); adminCheck(db, t); db.participants = []; db.attempts = []; save(db); return { ok: true }; },
    async adminResetAttempts(t) { const db = load(); adminCheck(db, t); db.attempts = []; save(db); return { ok: true }; },
  };
})();
