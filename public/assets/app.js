/* Battle of Interns. Single-page app: splash, accounts, home, study materials, quiz, ranking and admin panel.
   Talks to window.BOI_API (api-remote.js for the hosted site, api-local.js for the demo). */
(function () {
  "use strict";
  const API = window.BOI_API;
  const $app = document.getElementById("app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const mmss = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
  const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");
  const fmtSize = (b) => (!b ? "" : b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB");
  const assetUrl = (u) => (!u ? "" : /^(https?:|data:|blob:)/.test(u) ? u : (window.BOI_ASSET_BASE || "") + u);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  const token = () => store.get("boi_token");

  /* ---------------- Background and hero art (original line-art) ---------------- */
  const MOTIFS = `
    <g transform="rotate(-18 46 48)"><rect x="18" y="38" width="56" height="20" rx="10"/><path d="M74 48c6-6 10 6 16 0M74 48c8 4 12-2 18 2"/></g>
    <g><circle cx="150" cy="38" r="7"/><circle cx="164" cy="32" r="7"/><circle cx="158" cy="48" r="7"/><circle cx="172" cy="46" r="7"/></g>
    <g transform="rotate(34 214 118)"><rect x="190" y="109" width="48" height="18" rx="9"/><path d="M214 109v18"/><circle cx="226" cy="118" r="1.6"/><circle cx="232" cy="114" r="1.2"/><circle cx="231" cy="122" r="1.2"/></g>
    <g><path d="M70 136l17 10v20l-17 10-17-10v-20z"/><circle cx="70" cy="136" r="3"/><circle cx="87" cy="166" r="3"/><circle cx="53" cy="166" r="3"/></g>
    <path d="M118 206c6-14 14-14 20 0s14 14 20 0 14-14 20 0 14 14 20 0"/>
    <g><path d="M200 238c0-30 12-42 40-40-2 28-14 40-40 40z"/><path d="M200 238c12-12 22-22 34-34"/></g>
    <g><circle cx="42" cy="232" r="10"/><path d="M42 218v-6M42 246v6M28 232h-6M56 232h6M32 222l-4-4M52 242l4 4M52 222l4-4M32 242l-4 4"/></g>
    <path d="M118 96h10M123 91v10"/><circle cx="236" cy="22" r="2"/><circle cx="110" cy="248" r="2"/><circle cx="12" cy="120" r="2"/>
    <g transform="rotate(20 150 130)"><rect x="128" y="123" width="44" height="14" rx="7"/></g>`;
  const BG_ART = `
    <div class="bgart" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <defs>
        <pattern id="boiPat" width="260" height="260" patternUnits="userSpaceOnUse">${MOTIFS}</pattern>
        <pattern id="boiPat2" width="260" height="260" patternUnits="userSpaceOnUse" patternTransform="scale(1.7)">${MOTIFS}</pattern>
      </defs>
      <g class="drift2" opacity="0.22"><rect x="-1200" y="-1200" width="400%" height="400%" fill="url(#boiPat2)" stroke="none"/></g>
      <g class="drift1" opacity="0.42"><rect x="0" y="0" width="300%" height="300%" fill="url(#boiPat)" stroke="none"/></g>
    </svg>
    <svg class="floater f1" viewBox="-30 -30 60 60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="0" cy="0" r="10"/><path d="M0-14v-6M0 14v6M-14 0h-6M14 0h6M-10-10l-4-4M10 10l4 4M10-10l4-4M-10 10l-4 4"/></svg>
    <svg class="floater f2" viewBox="-34 -22 68 44" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><g transform="rotate(-20)"><rect x="-26" y="-9" width="52" height="18" rx="9"/><path d="M0-9v18"/><circle cx="12" cy="0" r="1.6"/><circle cx="18" cy="-4" r="1.2"/><circle cx="17" cy="4" r="1.2"/></g></svg>
    <svg class="floater f3" viewBox="-12 -16 44 36" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="0" cy="0" r="7"/><circle cx="14" cy="-6" r="7"/><circle cx="8" cy="10" r="7"/><circle cx="22" cy="8" r="7"/></svg>
    </div>`;
  const HERO_ART = `
    <svg class="hero-art" viewBox="0 0 150 190" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <g transform="rotate(-28 75 95)">
        <rect x="42" y="16" width="66" height="158" rx="33"/>
        <path d="M42 95h66"/>
        <g class="acc"><circle cx="64" cy="46" r="6"/><circle cx="78" cy="40" r="6"/><circle cx="72" cy="56" r="6"/><circle cx="86" cy="54" r="6"/>
          <g transform="rotate(-20 75 78)"><rect x="56" y="72" width="38" height="12" rx="6"/></g>
          <path d="M60 30c4-4 8 2 12-2"/></g>
        <path d="M75 112l12 7v14l-12 7-12-7v-14z"/><circle cx="75" cy="112" r="2"/><circle cx="87" cy="133" r="2"/><circle cx="63" cy="133" r="2"/>
        <path d="M58 160c0-16 7-23 22-22-1 15-8 22-22 22z"/><path d="M58 160l16-16"/>
        <path d="M94 150c4-6 10-6 14 0"/>
      </g>
      <g class="acc" transform="translate(118 150)"><circle cx="0" cy="0" r="12"/><path d="M0-16v-5M0 16v5M-16 0h-5M16 0h5M-11-11l-4-4M11 11l4 4M11-11l4-4M-11 11l-4 4"/></g>
    </svg>`;



  let settings = { campaignName: "Battle of Interns", sponsor: "Moxaclav", durationSec: 600, questionCount: 25, leaderboardPublic: true, showExplanations: true, registrationOpen: true, quiz: { state: "locked" }, splash: {}, banners: { top: {}, popup: {} }, terms: "", institutions: [] };
  let toastTimer = null;

  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
  }
  function confirmBox({ title, body, okText = "Confirm", danger = false }) {
    return new Promise((resolve) => {
      const bg = document.createElement("div"); bg.className = "modal-bg";
      bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p class="muted">${esc(body)}</p>
        <div class="row end"><button class="btn" data-x="no">Cancel</button><button class="btn ${danger ? "danger" : "primary"}" data-x="yes">${esc(okText)}</button></div></div>`;
      bg.addEventListener("click", (e) => { const x = e.target.getAttribute("data-x"); if (x) { bg.remove(); resolve(x === "yes"); } });
      document.body.appendChild(bg);
    });
  }
  function modal(html, { wide = false } = {}) {
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" ${wide ? 'style="max-width:720px;max-height:90vh;overflow:auto"' : ""} role="dialog" aria-modal="true">${html}</div>`;
    bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest("[data-close]")) bg.remove(); });
    document.body.appendChild(bg); return bg;
  }
  function showTerms() {
    modal(`<div class="row between"><h2>Terms and conditions</h2><button class="btn sm" data-close>Close</button></div><div class="terms-body">${esc(settings.terms)}</div>`, { wide: true });
  }
  function termsList() { return settings.terms.split(/\n+/).map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean); }

  function shell(inner, { wide = false, right = "", banner = true } = {}) {
    if (!document.querySelector(".bgart")) document.body.insertAdjacentHTML("afterbegin", BG_ART);
    const top = settings.banners && settings.banners.top;
    $app.innerHTML = `
      <header class="topbar"><div class="topbar-in">
        <a class="brand" href="#" title="${esc(settings.campaignName)}"><span class="logo-badge"><img src="${esc(logoUrl())}" alt="${esc(settings.campaignName)}"></span><span class="brand-sub">World AMR Awareness Week</span></a>
        ${right}
      </div></header>
      ${banner && top && top.enabled && top.image ? `<div class="banner-top">${top.link ? `<a href="${esc(top.link)}" target="_blank" rel="noopener">` : ""}<img src="${esc(assetUrl(top.image))}" alt="">${top.link ? "</a>" : ""}</div>` : ""}
      <main class="wrap ${wide ? "wide" : ""}">${inner}</main>
      <div class="footer">Square Pharmaceuticals PLC &middot; <a href="#terms">Terms and conditions</a> ${settings.demo ? '&middot; <span class="demo-badge">DEMO</span>' : ""}</div>`;
  }
  function userChip() {
    const name = (Home.me && Home.me.participant.name) || "";
    return token() ? `<div class="user-chip"><span class="pill accent" title="${esc(name)}">${esc(name.split(" ").slice(0, 2).join(" ") || "Signed in")}</span><button class="btn sm ghost" id="btnLogout">Log out</button></div>` : "";
  }
  function bindLogout() { const b = document.getElementById("btnLogout"); if (b) b.addEventListener("click", async () => { API.logout(token()); store.del("boi_token"); Home.me = null; location.hash = ""; route(); }); }

  /* ---------------- Routing ---------------- */
  let routing = false;
  async function route() {
    if (routing) return; routing = true;
    try { settings = await API.getSettings(); } catch (e) { /* keep defaults */ }
    Home.stopTimer(); Quiz.stopTimer();
    const h = location.hash.replace("#", "");
    document.body.classList.toggle("admin", h === "admin");
    document.body.classList.toggle("splash-mode", h === "" && !token());
    routing = false;
    if (h === "admin") return Admin.mount();
    if (h === "terms") return Terms.page();
    if (h === "board") return Board.mount();
    if (h === "register") return Auth.register();
    if (h === "login") return Auth.login();
    if (h === "quiz") return Quiz.start();
    if (h === "result") return Quiz.result();
    return token() ? Home.mount() : Splash.mount();
  }
  window.addEventListener("hashchange", route);

  /* ---------------- Splash ---------------- */
  const Splash = {
    mount() {
      if (!document.querySelector(".bgart")) document.body.insertAdjacentHTML("afterbegin", BG_ART);
      const sp = settings.splash || {};
      const th = sp.theme || {};
      const vars = [["--sp-bg1", th.bg1], ["--sp-bg2", th.bg2], ["--sp-bg3", th.bg3], ["--sp-cta1", th.cta1], ["--sp-cta2", th.cta2], ["--sp-cta-text", th.ctaText], ["--sp-logo", th.logoWidth ? th.logoWidth + "px" : ""], ["--sp-visual", th.visualWidth ? th.visualWidth + "px" : ""]].filter(([, v]) => v).map(([k, v]) => `${k}:${esc(v)}`).join(";");
      $app.innerHTML = `
        <div class="splash poster" style="${vars}">
          <div class="splash-bg"></div>
          <div class="splash-body">
            ${sp.kicker !== "" ? `<span class="splash-kicker">${esc(sp.kicker || "World AMR Awareness Week · 18 to 24 November")}</span>` : ""}
            ${th.hideLogo ? `<h1>${esc(sp.headline || settings.campaignName)}</h1>` : `<img class="splash-logo" src="${esc(logoUrl())}" alt="${esc(sp.headline || settings.campaignName)}">`}
            ${sp.sub ? `<p class="splash-sub">${esc(sp.sub)}</p>` : ""}
            ${th.hideVisual ? "" : `<img class="splash-visual" src="${esc(visualUrl())}" alt="">`}
            ${settings.registrationOpen ? `<a class="btn hero-cta gold" href="#register">${esc(sp.cta || "Register Now")}</a>` : `<button class="btn hero-cta" disabled>Registration closed</button>`}
            <p class="splash-login">Already registered? <a href="#login">Log in</a></p>
          </div>
          <div class="splash-foot">
            <b>Terms and conditions</b>
            <ol>${termsList().map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
            <div class="foot-row"><span>Square Pharmaceuticals PLC ${settings.demo ? '&middot; <span class="demo-badge">DEMO</span>' : ""}</span><a href="#terms" id="lnkTerms">Read full terms and conditions</a></div>
          </div>
        </div>`;
      document.getElementById("lnkTerms").addEventListener("click", (e) => { e.preventDefault(); showTerms(); });
    },
  };
  const DEFAULT_IMG = window.BOI_DEFAULT_IMAGES || { logo: "assets/img/logo-amr-avengers.png", visual: "assets/img/shield-capsule.png" };
  const logoUrl = () => assetUrl((settings.splash || {}).icon) || assetUrl(DEFAULT_IMG.logo);
  const visualUrl = () => assetUrl((settings.splash || {}).visual) || assetUrl(DEFAULT_IMG.visual);
  function splashIcon(cls) { return `<img class="${cls || "hero-art"} hero-icon" src="${esc(logoUrl())}" alt="${esc(settings.campaignName)}">`; }
  const Terms = {
    page() { shell(`<div class="card stack"><div class="row between"><h1 style="font-size:1.5rem">Terms and conditions</h1><a class="btn sm" href="#">Back</a></div><div class="terms-body">${esc(settings.terms)}</div></div>`, { right: userChip() }); bindLogout(); },
  };

  /* ---------------- Accounts ---------------- */
  const Auth = {
    pwField(id, label, hint) {
      return `<div class="field"><label for="${id}">${label}</label><div class="pw-wrap"><input class="input" id="${id}" name="${id}" type="password" autocomplete="${id === "password" ? "new-password" : "current-password"}" required><button type="button" class="pw-toggle" data-pw="${id}">Show</button></div>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
    },
    bindPw(root) { root.querySelectorAll("[data-pw]").forEach((b) => b.addEventListener("click", () => { const i = root.querySelector("#" + b.dataset.pw); i.type = i.type === "password" ? "text" : "password"; b.textContent = i.type === "password" ? "Show" : "Hide"; })); },
    showErrors(form, problems) {
      form.querySelectorAll(".field").forEach((f) => { f.classList.remove("invalid"); const er = f.querySelector(".err"); if (er) er.remove(); });
      for (const [k, msg] of Object.entries(problems)) {
        const inp = form.querySelector(`[name="${k}"]`); const f = inp && inp.closest(".field");
        if (f) { f.classList.add("invalid"); f.insertAdjacentHTML("beforeend", `<span class="err">${esc(msg)}</span>`); } else toast(msg);
      }
      const first = form.querySelector(".field.invalid .input"); if (first) first.focus();
    },
    register(err) {
      if (token()) { location.hash = ""; return; }
      shell(`
        <div class="stack">
          <div class="hero"><div class="hero-text"><span class="eyebrow">Registration</span><h1>Create your account</h1><p class="muted">Register once now. On quiz day you log in with your mobile number and a password you cannot forget.</p></div>${HERO_ART}</div>
          ${settings.registrationOpen ? `
          <form class="card stack" id="regForm" novalidate>
            ${err ? `<div class="alert bad">${esc(err)}</div>` : ""}
            <div class="field"><label for="f_name">Full name</label><input class="input" id="f_name" name="name" autocomplete="name" placeholder="Dr. Full Name" required></div>
            <div class="grid-2">
              <div class="field"><label for="f_phone">Mobile number</label><input class="input" id="f_phone" name="phone" inputmode="tel" placeholder="01XXXXXXXXX" autocomplete="tel" required><span class="hint">11 digits. This is your login ID.</span></div>
              <div class="field"><label for="f_email">Email</label><input class="input" id="f_email" name="email" type="email" inputmode="email" placeholder="you@example.com" required></div>
            </div>
            <div class="grid-2">
              <div class="field"><label for="f_bmdc">BMDC registration number <span class="muted">(optional)</span></label><input class="input" id="f_bmdc" name="bmdc" placeholder="If you have one" autocomplete="off"><span class="hint">Leave blank if yours has not been issued yet.</span></div>
              <div class="field"><label for="f_bday">Day of the month you were born</label><input class="input" id="f_bday" name="birthDay" inputmode="numeric" maxlength="2" placeholder="e.g. 01 or 20" required><span class="hint">Just the day, two digits. It becomes part of your password.</span></div>
            </div>
            <div class="field"><label for="f_inst">Medical college / hospital</label>
              <select class="input" id="f_inst" name="institution" required><option value="">Select your medical college</option>${(settings.institutions || []).map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}<option value="__other">Other (not in the list)</option></select></div>
            <div class="field" id="instOtherWrap" hidden><label for="f_inst_other">Name of your medical college</label><input class="input" id="f_inst_other" name="institutionOther" placeholder="Type the full name"></div>
            <div class="alert info" id="pwPreview"><b>Your password</b> will be your birth day followed by the last 4 digits of your mobile number. Fill in both fields above to see it.</div>
            <div class="field"><label class="check"><input type="checkbox" id="f_consent" name="consent" required><span>I confirm I am an intern doctor and I accept the <a href="#terms" id="lnkTerms2">terms and conditions</a>, including that my name and score may appear on the ranking board.</span></label></div>
            <button class="btn primary block" type="submit" id="btnStart">Create account</button>
            <p class="small muted" style="text-align:center">Already registered? <a href="#login">Log in</a></p>
          </form>` : `<div class="alert warn">Registration is closed. If you already registered, <a href="#login">log in</a>.</div>`}
        </div>`, { banner: false });
      const form = document.getElementById("regForm"); if (!form) return;
      Auth.bindPw(form);
      document.getElementById("lnkTerms2").addEventListener("click", (e) => { e.preventDefault(); showTerms(); });
      const instSel = document.getElementById("f_inst"), instOther = document.getElementById("instOtherWrap");
      instSel.addEventListener("change", () => { instOther.hidden = instSel.value !== "__other"; if (!instOther.hidden) document.getElementById("f_inst_other").focus(); });
      const preview = () => { const bd = form.birthDay.value.replace(/\D/g, "").padStart(2, "0").slice(-2); const ph = form.phone.value.replace(/\D/g, ""); const el = document.getElementById("pwPreview"); if (/^(0[1-9]|[12]\d|3[01])$/.test(bd) && ph.length >= 4) el.innerHTML = `<b>Your password will be: <span class="mono" style="font-size:1.1em">${esc(bd + ph.slice(-4))}</span></b><br><span class="small">Birth day ${esc(bd)} + last 4 digits of your mobile number ${esc(ph.slice(-4))}. Please note it down.</span>`; else el.innerHTML = `<b>Your password</b> will be your birth day followed by the last 4 digits of your mobile number. Fill in both fields above to see it.`; };
      form.birthDay.addEventListener("input", preview); form.phone.addEventListener("input", preview);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(form).entries());
        d.consent = form.consent.checked;
        d.birthDay = (d.birthDay || "").replace(/\D/g, "").padStart(2, "0").slice(-2);
        if (d.institution === "__other") d.institution = (d.institutionOther || "").trim();
        delete d.institutionOther;
        const problems = Auth.validate(d);
        if (Object.keys(problems).length) { Auth.showErrors(form, problems); return; }
        const btn = document.getElementById("btnStart"); btn.disabled = true; btn.textContent = "Creating account...";
        try { const r = await API.register(d); store.set("boi_token", r.token); toast("Account created. Your password is " + d.birthDay + d.phone.replace(/\D/g, "").slice(-4)); location.hash = ""; route(); }
        catch (ex) { Auth.register(ex.message || "Could not register."); }
      });
    },
    validate(d) {
      const p = {};
      if (!d.name || d.name.trim().length < 3) p.name = "Enter your full name.";
      if (!/^(\+?88)?01[3-9]\d{8}$/.test((d.phone || "").replace(/[\s-]/g, ""))) p.phone = "Enter an 11-digit Bangladeshi mobile number.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((d.email || "").trim())) p.email = "Enter a valid email address.";
      if (!d.institution || d.institution.trim().length < 3) p.institution = "Select your medical college, or choose Other and type it.";
      if (!/^(0[1-9]|[12]\d|3[01])$/.test(d.birthDay || "")) p.birthDay = "Enter the day of the month you were born, 01 to 31.";
      if (!d.consent) p.consent = "Please accept the terms and conditions to continue.";
      return p;
    },
    login(err) {
      if (token()) { location.hash = ""; return; }
      shell(`<div class="stack" style="max-width:440px;margin:0 auto">
        <div class="hero-text"><span class="eyebrow">Welcome back</span><h1>Log in</h1><p class="muted">Use the mobile number you registered with.</p></div>
        <form class="card stack" id="loginForm" novalidate>
          ${err ? `<div class="alert bad">${esc(err)}</div>` : ""}
          <div class="field"><label for="l_phone">Mobile number</label><input class="input" id="l_phone" name="phone" inputmode="tel" placeholder="01XXXXXXXXX" autocomplete="tel" required></div>
          ${Auth.pwField("password", "Password", "Your birth day (2 digits) + the last 4 digits of your mobile number. Born on the 5th with a number ending 3344: <b>053344</b>.")}
          <button class="btn primary block" type="submit" id="btnLogin">Log in</button>
          <p class="small muted" style="text-align:center">New here? <a href="#register">Register now</a><br>Still cannot log in? Contact the organisers.</p>
        </form></div>`, { banner: false });
      const form = document.getElementById("loginForm"); Auth.bindPw(form);
      form.addEventListener("submit", async (e) => {
        e.preventDefault(); const btn = document.getElementById("btnLogin"); btn.disabled = true; btn.textContent = "Logging in...";
        try { const r = await API.login(form.phone.value, form.password.value); store.set("boi_token", r.token); location.hash = ""; route(); }
        catch (ex) { Auth.login(ex.message); }
      });
    },
  };

  /* ---------------- Home (participant dashboard) ---------------- */
  const Home = {
    me: null, timer: null,
    stopTimer() { clearInterval(Home.timer); Home.timer = null; },
    async mount() {
      try { Home.me = await API.me(token()); }
      catch (e) { store.del("boi_token"); Home.me = null; if (/log in|session/i.test(e.message)) { Splash.mount(); return; } shell(`<div class="alert bad">${esc(e.message)}</div>`); return; }
      const me = Home.me, p = me.participant, a = me.attempt, q = settings.quiz || { state: "locked" };
      const quizCard = (() => {
        if (a && a.status === "completed") return `<div class="state"><span class="state-dot open"></span><b>You have completed the quiz</b></div>
          <div class="score-tile"><div class="score-big num">${a.score}<small>/${a.total}</small></div><div><p class="muted">${a.rank ? `Current rank <b class="num">#${a.rank}</b>` : ""} &middot; ${mmss(a.timeTakenSec)}</p><p class="small muted">Ranking is by score, then faster completion time.</p></div></div>
          <div class="row"><a class="btn primary" href="#result">See your result</a>${settings.leaderboardPublic ? `<a class="btn" href="#board">Ranking board</a>` : ""}</div>`;
        if (a && a.status === "in_progress") return `<div class="state"><span class="state-dot open"></span><b>Your quiz is in progress</b></div><p class="muted">Your clock is running. Continue where you left off.</p><a class="btn primary" href="#quiz">Continue quiz</a>`;
        const first = p.name.replace(/^dr\.?\s*/i, "").split(" ")[0];
        if (q.state === "open") return `<div class="state"><span class="state-dot open"></span><b>Your quiz is ready, Dr. ${esc(first)}</b></div><p class="muted">${settings.questionCount} questions in ${Math.round(settings.durationSec / 60)} minutes, one attempt. Your clock starts the moment you press Start, so find a quiet spot first.</p>${q.endAt ? `<p class="small muted">Closes ${fmtDate(q.endAt)}.</p>` : ""}<a class="btn primary" href="#quiz" id="btnGo">Start quiz</a>`;
        if (q.state === "scheduled") return `<div class="cd-hero"><span class="eyebrow">Thanks for registering, Dr. ${esc(first)}</span><h2>Your quiz starts in</h2><div class="countdown big" id="countdown"></div><p class="muted small">${fmtDate(q.startAt)}. The Start button will appear right here. Meanwhile, go through the study materials below to prepare; we add new ones from time to time.</p></div>`;
        if (q.state === "closed") return `<div class="state"><span class="state-dot closed"></span><b>The quiz is closed</b></div><p class="muted">Thank you for taking part. ${settings.leaderboardPublic ? '<a href="#board">See the final ranking</a>.' : ""}</p>`;
        return `<div class="cd-hero"><span class="eyebrow">Thanks for registering, Dr. ${esc(first)}</span><h2>You are on the list</h2><div class="countdown big muted-cd"><div class="cd"><b>--</b><span>days</span></div><div class="cd"><b>--</b><span>hours</span></div><div class="cd"><b>--</b><span>min</span></div></div><p class="muted small">The countdown appears here as soon as we set the quiz date, and the Start button on the day. Meanwhile, go through the study materials below to prepare; we add new ones from time to time.</p></div>`;
      })();
      shell(`
        <div class="stack">
          <div class="home-head"><div><span class="eyebrow">Participant</span><h1>Hello, ${esc(p.name)}</h1><p class="muted small">${esc(p.institution || "")}${p.bmdc ? ` &middot; BMDC ${esc(p.bmdc)}` : ""}</p></div></div>
          <div class="card quiz-card">${quizCard}</div>
          <div class="stack-sm">
            <div class="row between"><h2>Study materials</h2><span class="small muted">${me.materials.length} reference${me.materials.length === 1 ? "" : "s"}</span></div>
            ${me.materials.length ? `<div class="materials">${me.materials.map((m) => `<a class="material" href="${esc(assetUrl(m.url))}" target="_blank" rel="noopener"><div class="ic ${esc(m.type)}">${esc((m.type || "link").toUpperCase())}</div><div class="t"><b>${esc(m.title)}</b><span>${esc(m.description || "")}${m.size ? ` &middot; ${fmtSize(m.size)}` : ""}</span></div><span class="go">${m.type === "link" ? "Open" : "Download"}</span></a>`).join("")}</div>` : `<div class="card tint">Study materials will appear here when the organisers add them.</div>`}
          </div>
          <div class="rules">
            <div class="rule"><div class="rule-ic">${settings.questionCount}</div><b>MCQ, one at a time</b><p>Pick one option and press Next. No going back.</p></div>
            <div class="rule"><div class="rule-ic">${Math.round(settings.durationSec / 60)}m</div><b>On the clock</b><p>The timer starts when you press Start and keeps running if you leave the page.</p></div>
            <div class="rule"><div class="rule-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h11a4 4 0 0 1 0 8H9"/><path d="M12 11l-3 4 3 4"/></svg></div><b>Skip and return</b><p>Skipped questions come back after the last one.</p></div>
            <div class="rule"><div class="rule-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21l4-4 4 4M12 3v14"/><path d="M5 8l7-5 7 5"/></svg></div><b>Winners</b><p>Highest score wins. Ties go to the faster completion time.</p></div>
          </div>
          ${settings.leaderboardPublic ? `<a class="btn block" href="#board">View ranking board</a>` : ""}
        </div>`, { right: userChip() });
      bindLogout();
      if (q.state === "scheduled") Home.countdown(q.startAt);
      Home.popup();
    },
    countdown(at) {
      const el = document.getElementById("countdown"); if (!el) return;
      const tick = () => {
        let s = Math.max(0, Math.floor((at - Date.now()) / 1000));
        const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
        el.innerHTML = `<div class="cd"><b class="num">${d}</b><span>day${d === 1 ? "" : "s"}</span></div><div class="cd"><b class="num">${pad(h)}</b><span>hours</span></div><div class="cd"><b class="num">${pad(m)}</b><span>min</span></div><div class="cd"><b class="num">${pad(s)}</b><span>sec</span></div>`;
        if (at - Date.now() <= 0) { Home.stopTimer(); route(); }
      };
      tick(); Home.timer = setInterval(tick, 1000);
    },
    popup() {
      const pb = settings.banners && settings.banners.popup;
      if (!pb || !pb.enabled || !pb.image || session.get("boi_popup_seen")) return;
      session.set("boi_popup_seen", "1");
      const secs = Math.max(3, Number(pb.seconds) || 10);
      const bg = document.createElement("div"); bg.className = "popup-bg";
      bg.innerHTML = `<div class="popup">${pb.link ? `<a href="${esc(pb.link)}" target="_blank" rel="noopener">` : ""}<img src="${esc(assetUrl(pb.image))}" alt="">${pb.link ? "</a>" : ""}<button class="popup-close" aria-label="Close">&times;</button><span class="popup-timer" id="popupTimer">Closes in ${secs}s</span></div>`;
      let left = secs; const close = () => { clearInterval(iv); bg.remove(); };
      const iv = setInterval(() => { left--; const t = document.getElementById("popupTimer"); if (t) t.textContent = `Closes in ${left}s`; if (left <= 0) close(); }, 1000);
      bg.querySelector(".popup-close").addEventListener("click", close);
      bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
      document.body.appendChild(bg);
    },
  };

  /* ---------------- Quiz ---------------- */
  const Quiz = {
    attempt: null, answers: {}, queue: [], seen: new Set(), tabSwitches: 0, timerId: null, saveTimer: null, submitting: false,
    async start() {
      if (!token()) { location.hash = "login"; return; }
      Quiz.stopTimer(); Quiz.submitting = false;
      shell(`<div class="card stack"><p class="muted">Preparing your quiz...</p></div>`, { banner: false });
      try {
        const a = await API.startAttempt(token());
        Quiz.attempt = a; Quiz.answers = a.answers || {}; Quiz.tabSwitches = a.tabSwitches || 0;
        Quiz.queue = a.questions.map((q) => q.id).filter((id) => !(id in Quiz.answers)); Quiz.seen = new Set();
        if (Quiz.queue.length === 0 || Date.now() >= a.endsAt) return Quiz.submit(true);
        if (Object.keys(Quiz.answers).length === 0) toast("Your clock has started.");
        Quiz.renderQuestion(); Quiz.startTimer();
        document.addEventListener("visibilitychange", Quiz.onVis);
      } catch (e) {
        if (/already completed/i.test(e.message)) { location.hash = "result"; return; }
        shell(`<div class="card stack"><div class="alert warn">${esc(e.message)}</div><a class="btn" href="#">Back to home</a></div>`, { banner: false });
      }
    },
    onVis() { if (document.hidden && Quiz.attempt) { Quiz.tabSwitches++; Quiz.queueSave(); } },
    startTimer() { Quiz.stopTimer(); Quiz.timerId = setInterval(Quiz.tick, 250); Quiz.tick(); },
    stopTimer() { clearInterval(Quiz.timerId); Quiz.timerId = null; document.removeEventListener("visibilitychange", Quiz.onVis); },
    tick() {
      if (!Quiz.attempt) return;
      const left = Math.max(0, Math.ceil((Quiz.attempt.endsAt - Date.now()) / 1000));
      const el = document.getElementById("timer");
      if (el) { const t = document.getElementById("timeText"); if (t) t.textContent = mmss(left); el.classList.toggle("warn", left <= 120 && left > 30); el.classList.toggle("bad", left <= 30); }
      if (left <= 0 && !Quiz.submitting) Quiz.submit(true);
    },
    queueSave() { clearTimeout(Quiz.saveTimer); Quiz.saveTimer = setTimeout(() => { API.saveProgress(token(), { answers: Quiz.answers, tabSwitches: Quiz.tabSwitches }).catch(() => {}); }, 600); },
    renderQuestion() {
      const a = Quiz.attempt; const qs = a.questions; const total = qs.length;
      const qid = Quiz.queue[0]; const q = qs.find((x) => x.id === qid); const idx = qs.indexOf(q);
      const answered = Object.keys(Quiz.answers).length;
      const revisit = Quiz.seen.has(qid); Quiz.seen.add(qid);
      const skippedCount = Quiz.queue.filter((id) => Quiz.seen.has(id) && id !== qid).length;
      shell(`
        <div class="stack">
          <div class="quiz-head">
            <div><span class="eyebrow">Question ${idx + 1} of ${total}</span><br><span class="small muted num">${answered} answered &middot; ${skippedCount} skipped</span></div>
            <div class="timer num" id="timer" aria-live="off"><span class="timer-dot"></span><span id="timeText">${mmss(Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000)))}</span></div>
          </div>
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${answered}"><i style="width:${(answered / total) * 100}%"></i><i class="skip" style="width:${(skippedCount / total) * 100}%"></i></div>
          ${revisit ? `<div class="alert info">You skipped this one earlier. It is back for a second look.</div>` : ""}
          <div class="card stack">
            <p class="qtext">${esc(q.text)}</p>
            <div class="options" role="radiogroup" aria-label="Options">
              ${q.options.map((o) => `<button type="button" class="opt" role="radio" aria-checked="false" data-key="${esc(o.key)}"><span class="key">${esc(o.key)}</span><span>${esc(o.text)}</span></button>`).join("")}
            </div>
            <div class="qnav"><button class="btn" id="btnSkip" type="button">Skip for now</button><button class="btn primary" id="btnNext" type="button" disabled>Next</button></div>
          </div>
          <div class="row between"><span class="small muted">Answers lock when you press Next.</span><button class="btn ghost sm" id="btnFinish" type="button">Finish early</button></div>
        </div>`, { right: `<span class="pill accent num">${answered}/${total}</span>`, banner: false });
      let picked = null; const next = document.getElementById("btnNext");
      document.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => { picked = b.dataset.key; document.querySelectorAll(".opt").forEach((x) => { x.classList.toggle("selected", x === b); x.setAttribute("aria-checked", x === b ? "true" : "false"); }); next.disabled = false; }));
      next.addEventListener("click", () => { if (!picked) return; Quiz.answers[qid] = picked; Quiz.queue.shift(); Quiz.queueSave(); Quiz.advance(); });
      document.getElementById("btnSkip").addEventListener("click", () => { if (Quiz.queue.length === 1) { toast("This is the last unanswered question."); return; } Quiz.queue.push(Quiz.queue.shift()); Quiz.advance(); });
      document.getElementById("btnFinish").addEventListener("click", async () => {
        const left = Quiz.queue.length;
        const ok = await confirmBox({ title: "Finish the quiz now?", body: left ? `${left} question${left > 1 ? "s are" : " is"} still unanswered and will count as wrong.` : "All questions answered. Submit your answers?", okText: "Submit", danger: !!left });
        if (ok) Quiz.submit(false);
      });
    },
    advance() { if (Quiz.queue.length === 0) return Quiz.submit(false); Quiz.renderQuestion(); },
    async submit(auto) {
      if (Quiz.submitting) return;
      Quiz.submitting = true; Quiz.stopTimer();
      shell(`<div class="card stack"><h2>${auto ? "Time is up." : "Submitting..."}</h2><p class="muted">Scoring your answers.</p></div>`, { banner: false });
      try { const r = await API.submitAttempt(token(), { answers: Quiz.answers, tabSwitches: Quiz.tabSwitches }); Quiz.attempt = null; Quiz.submitting = false; Quiz.showResult(r, auto); }
      catch (e) { Quiz.submitting = false; shell(`<div class="card stack"><div class="alert bad">${esc(e.message)}</div><button class="btn" onclick="location.reload()">Try again</button></div>`); }
    },
    async result() {
      if (!token()) { location.hash = "login"; return; }
      try { const r = await API.getResult(token()); if (!r.completed) { location.hash = ""; return; } Quiz.showResult(r, false); }
      catch (e) { shell(`<div class="alert bad">${esc(e.message)}</div>`); }
    },
    showResult(r, timedOut) {
      Quiz.stopTimer();
      const wrong = r.review.filter((x) => !x.isCorrect);
      const pct = Math.round((r.correct / r.total) * 100);
      const render = (tab) => {
        shell(`
          <div class="stack">
            ${timedOut ? `<div class="alert warn">Time ran out, so your answers were submitted automatically.</div>` : ""}
            <div class="card stack">
              <div class="row between"><span class="eyebrow">Your result</span><a class="btn sm" href="#">Home</a></div>
              <div class="score-tile">
                <div class="score-big num">${r.score}<small>/${r.total}</small></div>
                <div><h2>${esc(r.name)}</h2><p class="muted small">${r.rank ? `Rank <b class="num">#${r.rank}</b> of ${r.totalParticipants} so far` : ""} ${pct >= 80 ? '<span class="pill good">Top form</span>' : pct >= 50 ? '<span class="pill accent">Solid</span>' : '<span class="pill warn">Keep reading</span>'}</p></div>
              </div>
              <div class="stat-row num">
                <div class="stat"><b>${r.correct}</b><span>Correct</span></div><div class="stat"><b>${r.wrong}</b><span>Wrong</span></div><div class="stat"><b>${r.skipped}</b><span>Unanswered</span></div><div class="stat"><b>${mmss(r.timeTakenSec)}</b><span>Time</span></div>
              </div>
              <p class="small muted">Winners are selected by score first, then faster completion time. Rank may change as more doctors finish.</p>
            </div>
            ${r.showExplanations ? `<div class="tabs" role="tablist">
              <button class="tab ${tab === "wrong" ? "active" : ""}" data-t="wrong">Learn from mistakes (${wrong.length})</button>
              <button class="tab ${tab === "all" ? "active" : ""}" data-t="all">All ${r.total} questions</button>
              ${settings.leaderboardPublic ? `<button class="tab ${tab === "board" ? "active" : ""}" data-t="board">Ranking</button>` : ""}
            </div>
            <div id="tabBody">${tab === "board" ? `<div class="muted small">Loading ranking...</div>` : Quiz.reviewList(tab === "wrong" ? wrong : r.review)}</div>` : `<div class="card tint">Answer explanations will be released after the quiz closes.</div>${settings.leaderboardPublic ? `<a class="btn block" href="#board">View ranking board</a>` : ""}`}
          </div>`, { right: userChip() });
        bindLogout();
        document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => render(b.dataset.t)));
        if (tab === "board") Board.fill(document.getElementById("tabBody"));
      };
      render("wrong");
    },
    reviewList(items) {
      if (!items.length) return `<div class="card tint"><b>Perfect score.</b> Nothing to review.</div>`;
      return `<div class="review">${items.map((x) => `
        <div class="card flat review-item ${x.isCorrect ? "ok" : ""}">
          <div class="row between"><span class="eyebrow">Q${x.number}</span>${x.isCorrect ? '<span class="pill good">Correct</span>' : x.yourAnswer ? '<span class="pill bad">Wrong</span>' : '<span class="pill warn">Unanswered</span>'}</div>
          <p class="qtext" style="font-size:1rem">${esc(x.text)}</p>
          <div class="options">${x.options.map((o) => `<div class="opt ${o.key === x.correct ? "correct" : (o.key === x.yourAnswer ? "wrong" : "")}" style="cursor:default"><span class="key">${esc(o.key)}</span><span>${esc(o.text)}</span></div>`).join("")}</div>
          ${x.explanation ? `<div class="explain"><b>Why:</b> ${esc(x.explanation).replace(/\n/g, "<br>")}</div>` : ""}
        </div>`).join("")}</div>`;
    },
  };

  /* ---------------- Ranking board ---------------- */
  const Board = {
    async mount() {
      shell(`<div class="stack"><div class="hero-text"><span class="eyebrow">Live ranking</span><h1>Ranking board</h1><p class="muted">Highest score first, then faster completion time. Updates as doctors finish.</p></div><div id="boardBody" class="stack"><div class="muted small">Loading...</div></div><a class="btn block" href="#">Back</a></div>`, { right: userChip() });
      bindLogout(); Board.fill(document.getElementById("boardBody"));
    },
    async fill(el) {
      try {
        const b = await API.getLeaderboard(token());
        if (!b.rows.length) { el.innerHTML = `<div class="card tint">No one has finished yet. Be the first name on the board.</div>`; return; }
        el.innerHTML = `<div class="row between"><span class="small muted num">${b.totalParticipants} finished &middot; top ${b.rows.length}</span><button class="btn sm" id="btnRefresh">Refresh</button></div>
          <div class="board">${b.rows.map((r) => `<div class="board-row ${r.isMe ? "me" : ""} ${r.rank <= 3 ? "top" : ""}"><span class="rank num">${r.rank <= 3 ? ["&#129351;", "&#129352;", "&#129353;"][r.rank - 1] : "#" + r.rank}</span><div class="who"><b>${esc(r.name)}${r.isMe ? " (you)" : ""}</b><span>${esc(r.institution || "")}</span></div><div class="sc num"><b>${r.score}/${r.total}</b><span>${mmss(r.timeTakenSec)}</span></div></div>`).join("")}</div>
          ${b.me && !b.rows.some((r) => r.isMe) ? `<div class="board-row me"><span class="rank num">#${b.me.rank}</span><div class="who"><b>${esc(b.me.name)} (you)</b></div><div class="sc num"><b>${b.me.score}/${b.me.total}</b><span>${mmss(b.me.timeTakenSec)}</span></div></div>` : ""}`;
        document.getElementById("btnRefresh").addEventListener("click", () => Board.fill(el));
      } catch (e) { el.innerHTML = `<div class="alert warn">${esc(e.message)}</div>`; }
    },
  };

  /* ---------------- Admin ---------------- */
  const Admin = {
    tab: "overview", token: null,
    async mount() {
      Admin.token = session.get("boi_admin");
      if (!Admin.token) return Admin.login();
      Admin.render();
    },
    login(err) {
      shell(`<div class="card stack" style="max-width:420px;margin:0 auto"><h2>Admin sign in</h2>${err ? `<div class="alert bad">${esc(err)}</div>` : ""}
        <form id="loginForm" class="stack"><div class="field"><label for="a_pw">Password</label><input class="input" type="password" id="a_pw" autocomplete="current-password" required>${settings.demo ? '<span class="hint">Demo password: <b>admin123</b></span>' : ""}</div>
        <button class="btn primary block" type="submit">Sign in</button><a class="btn ghost block" href="#">Back to site</a></form></div>`, { banner: false });
      document.getElementById("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        try { const r = await API.adminLogin(document.getElementById("a_pw").value); Admin.token = r.adminToken; session.set("boi_admin", r.adminToken); Admin.render(); }
        catch (ex) { Admin.login(ex.message); }
      });
    },
    logout() { session.del("boi_admin"); Admin.token = null; API.adminLogout && API.adminLogout(); location.hash = ""; },
    async guard(fn) {
      try { return await fn(); } catch (e) { if (/unauthori[sz]ed|sign in/i.test(e.message)) { Admin.token = null; session.del("boi_admin"); Admin.login("Session expired. Sign in again."); } else toast(e.message); throw e; }
    },
    render() {
      const tabs = [["overview", "Overview"], ["questions", "Questions"], ["participants", "Participants"], ["materials", "Study materials"], ["appearance", "Splash & banners"], ["smsbase", "SMS base"], ["colleges", "Medical colleges"], ["settings", "Settings"]];
      shell(`<div class="stack">
        <div class="row between"><div><span class="eyebrow">Admin panel</span><h1>Campaign control</h1></div><div class="row"><a class="btn sm" href="#" target="_blank">View site</a><button class="btn sm ghost" id="btnLogout">Sign out</button></div></div>
        <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${Admin.tab === k ? "active" : ""}" data-t="${k}">${l}</button>`).join("")}</div>
        <div id="adminBody"><div class="muted small">Loading...</div></div></div>`, { wide: true, banner: false });
      document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => { Admin.tab = b.dataset.t; Admin.render(); }));
      document.getElementById("btnLogout").addEventListener("click", Admin.logout);
      Admin[Admin.tab](document.getElementById("adminBody"));
    },
    async refreshSettings() { settings = await API.getSettings(); },

    async overview(el) {
      const s = await Admin.guard(() => API.adminStats(Admin.token));
      const q = s.quiz || settings.quiz; const label = { open: "Open", locked: "Not opened yet", scheduled: "Scheduled", closed: "Closed" }[q.state] || q.state;
      el.innerHTML = `<div class="stack">
        <div class="card stack">
          <div class="row between"><div class="state"><span class="state-dot ${q.state}"></span><b>Quiz access: ${label}</b>${q.state === "scheduled" ? `<span class="small muted">starts ${fmtDate(q.startAt)}</span>` : ""}${q.state === "open" && q.endAt ? `<span class="small muted">closes ${fmtDate(q.endAt)}</span>` : ""}</div>
            <div class="row">${settings.quizMode === "scheduled" || (s.quizMode === "scheduled") ? `<span class="small muted">Controlled by schedule (Settings)</span>` : q.state === "open" ? `<button class="btn sm danger" id="btnClose">Close the quiz now</button>` : `<button class="btn sm primary" id="btnOpen">Open the quiz now</button>`}</div></div>
          <p class="small muted">Participants see the Start button only while the quiz is open. Doctors who already started keep their own 10-minute clock.</p>
        </div>
        <div class="grid-4">
          <div class="kpi"><b class="num">${s.participants}</b><span>Registered</span></div>
          <div class="kpi"><b class="num">${s.completed}</b><span>Completed</span></div>
          <div class="kpi"><b class="num">${s.completed ? s.avgScore.toFixed(1) : "0"}</b><span>Average score / ${s.total}</span></div>
          <div class="kpi"><b class="num">${s.completed ? mmss(Math.round(s.avgTimeSec)) : "00:00"}</b><span>Average time</span></div>
        </div>
        <div class="grid-4">
          <div class="kpi"><b class="num">${s.inProgress}</b><span>In progress now</span></div>
          <div class="kpi"><b class="num">${s.smsBase}</b><span>Numbers in SMS base</span></div>
          <div class="kpi"><b class="num">${s.fromBase}</b><span>Registered from SMS base</span></div>
          <div class="kpi"><b class="num">${s.participants - s.fromBase}</b><span>Registered outside base</span></div>
        </div>
        <div class="row between"><h2>Question difficulty</h2><span class="small muted">Share of participants who answered correctly</span></div>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Question</th><th>Answered</th><th>Correct</th><th style="width:140px">Accuracy</th></tr></thead><tbody>
          ${s.questionStats.map((q, i) => { const p = q.attempts ? Math.round((q.correct / q.attempts) * 100) : 0; return `<tr><td class="num">${i + 1}</td><td>${esc(q.text)}</td><td class="num">${q.attempts}</td><td class="num">${q.correct}</td><td><div class="row" style="gap:8px"><div class="bar grow ${p < 40 ? "low" : p < 70 ? "mid" : ""}"><i style="width:${p}%"></i></div><span class="num small">${q.attempts ? p + "%" : "n/a"}</span></div></td></tr>`; }).join("")}
        </tbody></table></div></div>`;
      const setOpen = async (v) => { await Admin.guard(() => API.adminSaveSettings(Admin.token, { quizMode: "manual", quizOpen: v })); await Admin.refreshSettings(); toast(v ? "Quiz opened" : "Quiz closed"); Admin.render(); };
      const bo = document.getElementById("btnOpen"), bc = document.getElementById("btnClose");
      if (bo) bo.addEventListener("click", async () => { if (await confirmBox({ title: "Open the quiz now?", body: "Every registered doctor will see the Start button immediately.", okText: "Open quiz" })) setOpen(true); });
      if (bc) bc.addEventListener("click", async () => { if (await confirmBox({ title: "Close the quiz?", body: "New attempts will be blocked. Doctors mid-quiz can still finish.", okText: "Close quiz", danger: true })) setOpen(false); });
    },

    async questions(el) {
      const list = await Admin.guard(() => API.adminQuestions(Admin.token));
      el.innerHTML = `<div class="stack">
        <div class="row between"><div><h2>${list.length} questions</h2><span class="small muted">${list.filter((q) => q.active).length} active. Each participant gets ${settings.questionCount} of the active ones${settings.shuffle === false ? "" : ", shuffled"}.</span></div>
          <div class="row"><button class="btn sm" id="btnImport">Import</button><button class="btn sm" id="btnExportQ">Export JSON</button><button class="btn sm primary" id="btnAdd">Add question</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Question</th><th>Answer</th><th>Status</th><th></th></tr></thead><tbody>
          ${list.map((q, i) => `<tr><td class="num">${i + 1}</td><td>${esc(q.text)}<br><span class="small muted">${["A", "B", "C", "D"].map((k) => `${k}. ${esc(q.options[k])}`).join(" &nbsp; ")}</span></td><td><span class="pill good">${esc(q.correct)}</span></td><td><span class="pill ${q.active ? "accent" : ""}">${q.active ? "Active" : "Hidden"}</span></td><td class="actions"><button class="btn sm" data-edit="${q.id}">Edit</button> <button class="btn sm danger" data-del="${q.id}">Delete</button></td></tr>`).join("")}
        </tbody></table></div></div>`;
      el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => Admin.editQuestion(list.find((q) => q.id === b.dataset.edit))));
      el.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
        if (await confirmBox({ title: "Delete this question?", body: "Existing answers to it stay in the export, but it will no longer be served.", okText: "Delete", danger: true })) { await Admin.guard(() => API.adminDeleteQuestion(Admin.token, b.dataset.del)); toast("Deleted"); Admin.render(); }
      }));
      document.getElementById("btnAdd").addEventListener("click", () => Admin.editQuestion(null));
      document.getElementById("btnExportQ").addEventListener("click", () => Admin.download("questions.json", JSON.stringify(list.map(({ text, options, correct, explanation }) => ({ text, options, correct, explanation })), null, 2), "application/json"));
      document.getElementById("btnImport").addEventListener("click", () => Admin.importDialog());
    },
    editQuestion(q) {
      const v = (k) => esc(q ? q.options[k] : "");
      const bg = modal(`<form id="qForm" class="stack"><h2>${q ? "Edit question" : "New question"}</h2>
        <div class="field"><label for="q_text">Question</label><textarea class="input" id="q_text" required>${esc(q ? q.text : "")}</textarea></div>
        <div class="grid-2">${["A", "B", "C", "D"].map((k) => `<div class="field"><label for="q_${k}">Option ${k}</label><input class="input" id="q_${k}" value="${v(k)}" required></div>`).join("")}</div>
        <div class="grid-2"><div class="field"><label for="q_correct">Correct option</label><select class="input" id="q_correct">${["A", "B", "C", "D"].map((k) => `<option ${q && q.correct === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
        <div class="field"><label for="q_active">Status</label><select class="input" id="q_active"><option value="1" ${!q || q.active ? "selected" : ""}>Active</option><option value="0" ${q && !q.active ? "selected" : ""}>Hidden</option></select></div></div>
        <div class="field"><label for="q_expl">Explanation (shown after the quiz)</label><textarea class="input" id="q_expl" style="min-height:120px">${esc(q ? q.explanation : "")}</textarea></div>
        <div class="row end"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`, { wide: true });
      bg.querySelector("#qForm").addEventListener("submit", async (e) => {
        e.preventDefault(); const g = (id) => bg.querySelector("#" + id).value;
        const payload = { id: q ? q.id : null, text: g("q_text").trim(), options: { A: g("q_A").trim(), B: g("q_B").trim(), C: g("q_C").trim(), D: g("q_D").trim() }, correct: g("q_correct"), explanation: g("q_expl").trim(), active: g("q_active") === "1" };
        await Admin.guard(() => API.adminSaveQuestion(Admin.token, payload)); bg.remove(); toast("Saved"); Admin.render();
      });
    },
    importDialog() {
      const bg = modal(`<h2>Import questions</h2>
        <p class="muted small">Upload a <b>.json</b> file (same format as Export) or a <b>.csv</b> with columns: <code>question, option_a, option_b, option_c, option_d, correct, explanation</code>. The seed file in the repo is a ready template.</p>
        <input type="file" id="impFile" accept=".json,.csv,text/csv,application/json" class="input">
        <label class="check"><input type="checkbox" id="impReplace"><span>Replace all existing questions (otherwise append)</span></label>
        <div id="impStatus" class="small muted"></div>
        <div class="row end"><button class="btn" data-close>Cancel</button><button class="btn primary" id="impGo" disabled>Import</button></div>`);
      let parsed = null;
      bg.querySelector("#impFile").addEventListener("change", (e) => {
        const f = e.target.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try { parsed = f.name.toLowerCase().endsWith(".json") ? JSON.parse(rd.result) : Admin.parseCsv(rd.result); }
          catch (ex) { parsed = null; bg.querySelector("#impStatus").textContent = "Could not read file: " + ex.message; return; }
          const bad = parsed.filter((q) => !q.text || !q.options || !["A", "B", "C", "D"].every((k) => q.options[k]) || !/^[ABCD]$/.test(q.correct));
          bg.querySelector("#impStatus").textContent = `${parsed.length} questions found${bad.length ? `, ${bad.length} invalid rows will be skipped` : ""}.`;
          parsed = parsed.filter((q) => !bad.includes(q)); bg.querySelector("#impGo").disabled = !parsed.length;
        };
        rd.readAsText(f);
      });
      bg.querySelector("#impGo").addEventListener("click", async () => { const r = await Admin.guard(() => API.adminImportQuestions(Admin.token, parsed, bg.querySelector("#impReplace").checked)); bg.remove(); toast(`${r.count} questions imported`); Admin.render(); });
    },
    parseCsv(text) {
      const rows = []; let row = [], cell = "", inQ = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += c; }
        else if (c === '"') inQ = true;
        else if (c === ",") { row.push(cell); cell = ""; }
        else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
        else cell += c;
      }
      if (cell || row.length) { row.push(cell); rows.push(row); }
      const head = rows.shift().map((h) => h.trim().toLowerCase());
      const col = (r, name) => r[head.indexOf(name)] ?? "";
      return rows.filter((r) => r.some((x) => x.trim())).map((r) => ({ text: col(r, "question").trim(), options: { A: col(r, "option_a").trim(), B: col(r, "option_b").trim(), C: col(r, "option_c").trim(), D: col(r, "option_d").trim() }, correct: col(r, "correct").trim().toUpperCase(), explanation: col(r, "explanation").trim() }));
    },

    async participants(el, q = "") {
      const list = await Admin.guard(() => API.adminParticipants(Admin.token, { q }));
      el.innerHTML = `<div class="stack">
        <div class="row between"><h2>${list.length} participant${list.length === 1 ? "" : "s"}</h2>
          <div class="row"><input class="input" id="pSearch" placeholder="Search name, BMDC, phone, email, college" value="${esc(q)}" style="min-width:240px"><button class="btn sm" id="btnCsv1">Export participants CSV</button><button class="btn sm" id="btnCsv2">Export all answers CSV</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Password</th><th>BMDC</th><th>College</th><th>SMS base</th><th>Status</th><th>Score</th><th>Time</th><th>Tab switches</th><th>Registered</th><th></th></tr></thead><tbody>
          ${list.length ? list.map((p) => `<tr><td><b>${esc(p.name)}</b><br><span class="small muted">${esc(p.email)}</span></td><td class="num mono">${esc(p.phone)}</td><td class="num mono small" title="Birth day + last 4 digits">${esc((p.birthDay || "??") + p.phone.slice(-4))}</td><td class="num">${esc(p.bmdc || "")}</td><td class="small">${esc(p.institution || "")}</td><td>${p.inBase ? '<span class="pill good">in base</span>' : '<span class="pill">outside</span>'}</td>
            <td><span class="pill ${p.status === "completed" ? "good" : p.status === "in_progress" ? "warn" : ""}">${esc(p.status.replace("_", " "))}</span>${p.late ? ' <span class="pill bad">late</span>' : ""}</td>
            <td class="num">${p.status === "completed" ? `${p.score}/${p.total}` : ""}</td><td class="num">${p.status === "completed" ? mmss(p.timeTakenSec) : ""}</td><td class="num">${p.tabSwitches > 0 ? `<span class="pill ${p.tabSwitches > 3 ? "bad" : "warn"}">${p.tabSwitches}</span>` : "0"}</td><td class="small num">${fmtDate(p.registeredAt)}</td>
            <td class="actions"><button class="btn sm" data-view="${p.id}" ${p.status === "completed" ? "" : "disabled"}>Answers</button> <button class="btn sm" data-pw="${p.id}">Password</button> ${p.status !== "registered" ? `<button class="btn sm" data-reset="${p.id}" title="Delete their attempt so they can take the quiz again">Reset attempt</button>` : ""} <button class="btn sm danger" data-del="${p.id}">Remove</button></td></tr>`).join("") : `<tr><td colspan="12" class="muted">No participants yet.</td></tr>`}
        </tbody></table></div>
        <p class="small muted">Phone numbers are stored as 11 digits (01XXXXXXXXX), the same format as the SMS base, and exported as text so Excel keeps the leading zero. The Password column shows the standard password (birth day + last 4 digits) so you can remind a doctor over the phone; the "Password" button overrides it if someone typed the wrong birth day. Tab switches count how often the quiz page was hidden during the attempt.</p></div>`;
      let st; document.getElementById("pSearch").addEventListener("input", (e) => { clearTimeout(st); st = setTimeout(() => Admin.participants(el, e.target.value), 300); });
      el.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
        if (await confirmBox({ title: "Remove participant?", body: "Their account, answers and ranking entry will be deleted.", okText: "Remove", danger: true })) { await Admin.guard(() => API.adminDeleteParticipant(Admin.token, b.dataset.del)); toast("Removed"); Admin.participants(el, q); }
      }));
      el.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", async () => {
        if (await confirmBox({ title: "Reset this attempt?", body: "Their answers and score are deleted and they can take the quiz again from the start.", okText: "Reset", danger: true })) { await Admin.guard(() => API.adminResetParticipantAttempt(Admin.token, b.dataset.reset)); toast("Attempt reset"); Admin.participants(el, q); }
      }));
      el.querySelectorAll("[data-pw]").forEach((b) => b.addEventListener("click", () => {
        const p = list.find((x) => x.id === b.dataset.pw);
        const bg = modal(`<form id="pwForm" class="stack"><h2>New password for ${esc(p.name)}</h2><p class="small muted">Only needed if the doctor cannot log in with the standard password. Tell them the new one by phone or SMS. They log in with ${esc(p.phone)}.</p><div class="field"><label for="np">New password</label><input class="input" id="np" minlength="6" required autocomplete="off"></div><div class="row end"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Set password</button></div></form>`);
        bg.querySelector("#pwForm").addEventListener("submit", async (e) => { e.preventDefault(); await Admin.guard(() => API.adminSetParticipantPassword(Admin.token, p.id, bg.querySelector("#np").value)); bg.remove(); toast("Password updated"); });
      }));
      el.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", async () => {
        const ans = await Admin.guard(() => API.adminParticipantAnswers(Admin.token, b.dataset.view)); const p = list.find((x) => x.id === b.dataset.view);
        modal(`<div class="row between"><h2>${esc(p.name)}</h2><button class="btn sm" data-close>Close</button></div>
          <div class="table-wrap"><table><thead><tr><th>#</th><th>Question</th><th>Answer</th><th>Correct</th><th></th></tr></thead><tbody>${ans.map((a, i) => `<tr><td class="num">${i + 1}</td><td>${esc(a.text)}</td><td>${esc(a.answer || "skipped")}</td><td>${esc(a.correct)}</td><td>${a.isCorrect ? '<span class="pill good">&#10003;</span>' : '<span class="pill bad">&#10007;</span>'}</td></tr>`).join("")}</tbody></table></div>`, { wide: true });
      }));
      document.getElementById("btnCsv1").addEventListener("click", async () => { const r = await Admin.guard(() => API.adminExport(Admin.token, "participants")); Admin.download(r.filename, r.csv, "text/csv"); });
      document.getElementById("btnCsv2").addEventListener("click", async () => { const r = await Admin.guard(() => API.adminExport(Admin.token, "answers")); Admin.download(r.filename, r.csv, "text/csv"); });
    },

    async materials(el) {
      const list = await Admin.guard(() => API.adminMaterials(Admin.token));
      el.innerHTML = `<div class="stack">
        <div class="row between"><div><h2>${list.length} study material${list.length === 1 ? "" : "s"}</h2><span class="small muted">Participants see the visible ones on their home page after logging in, in this order.</span></div><button class="btn sm primary" id="btnAddM">Add material</button></div>
        <div class="table-wrap"><table><thead><tr><th></th><th>Title</th><th>Type</th><th>Size</th><th>Visible</th><th></th></tr></thead><tbody>
          ${list.length ? list.map((m, i) => `<tr><td class="actions"><button class="btn sm ghost" data-up="${i}" ${i === 0 ? "disabled" : ""} title="Move up">&uarr;</button><button class="btn sm ghost" data-down="${i}" ${i === list.length - 1 ? "disabled" : ""} title="Move down">&darr;</button></td><td><b>${esc(m.title)}</b><br><span class="small muted">${esc(m.description || "")}</span><br><a class="small" href="${esc(assetUrl(m.url))}" target="_blank" rel="noopener">${esc(m.url.length > 70 ? m.url.slice(0, 70) + "..." : m.url)}</a></td><td><span class="pill">${esc((m.type || "link").toUpperCase())}</span></td><td class="num small">${fmtSize(m.size)}</td><td><span class="pill ${m.visible ? "good" : ""}">${m.visible ? "Visible" : "Hidden"}</span></td><td class="actions"><button class="btn sm" data-edit="${m.id}">Edit</button> <button class="btn sm danger" data-del="${m.id}">Delete</button></td></tr>`).join("") : `<tr><td colspan="6" class="muted">No materials yet.</td></tr>`}
        </tbody></table></div></div>`;
      const reorder = async (from, to) => { const ids = list.map((m) => m.id); const [x] = ids.splice(from, 1); ids.splice(to, 0, x); await Admin.guard(() => API.adminOrderMaterials(Admin.token, ids)); Admin.materials(el); };
      el.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => reorder(+b.dataset.up, +b.dataset.up - 1)));
      el.querySelectorAll("[data-down]").forEach((b) => b.addEventListener("click", () => reorder(+b.dataset.down, +b.dataset.down + 1)));
      el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => Admin.editMaterial(list.find((m) => m.id === b.dataset.edit), el)));
      el.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => { if (await confirmBox({ title: "Delete this material?", body: "It disappears from every participant's page.", okText: "Delete", danger: true })) { await Admin.guard(() => API.adminDeleteMaterial(Admin.token, b.dataset.del)); toast("Deleted"); Admin.materials(el); } }));
      document.getElementById("btnAddM").addEventListener("click", () => Admin.editMaterial(null, el));
    },
    editMaterial(m, el) {
      const bg = modal(`<form id="mForm" class="stack"><h2>${m ? "Edit material" : "Add study material"}</h2>
        <div class="field"><label for="m_title">Title</label><input class="input" id="m_title" value="${esc(m ? m.title : "")}" required placeholder="e.g. WHO AWaRe Classification 2023"></div>
        <div class="field"><label for="m_desc">Short description</label><input class="input" id="m_desc" value="${esc(m ? m.description : "")}" placeholder="One line on what it covers"></div>
        <div class="radio-row"><label><input type="radio" name="m_src" value="file" ${!m || m.type !== "link" ? "checked" : ""}> Upload a file (PDF, Excel, Word, PowerPoint, image)</label><label><input type="radio" name="m_src" value="link" ${m && m.type === "link" ? "checked" : ""}> Link to a web page</label></div>
        <div class="field" id="m_fileWrap"><input type="file" class="input" id="m_file" accept=".pdf,.xlsx,.xls,.docx,.doc,.pptx,.png,.jpg,.jpeg"><span class="hint" id="m_fileHint">${m && m.type !== "link" ? "Current file kept unless you choose a new one." : "Large reports can take a minute to upload."}</span></div>
        <div class="field" id="m_linkWrap" ${m && m.type === "link" ? "" : "hidden"}><label for="m_url">Web address</label><input class="input" id="m_url" value="${esc(m && m.type === "link" ? m.url : "")}" placeholder="https://..."></div>
        <label class="check"><input type="checkbox" id="m_vis" ${!m || m.visible ? "checked" : ""}><span>Visible to participants</span></label>
        <div class="row end"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit" id="m_save">Save</button></div></form>`);
      const srcRadios = bg.querySelectorAll("[name=m_src]"); const sync = () => { const v = bg.querySelector("[name=m_src]:checked").value; bg.querySelector("#m_fileWrap").hidden = v !== "file"; bg.querySelector("#m_linkWrap").hidden = v !== "link"; };
      srcRadios.forEach((r) => r.addEventListener("change", sync));
      bg.querySelector("#mForm").addEventListener("submit", async (e) => {
        e.preventDefault(); const btn = bg.querySelector("#m_save"); const src = bg.querySelector("[name=m_src]:checked").value;
        let url = m && m.type !== "link" ? m.url : "", type = m ? m.type : "", size = m ? m.size : null;
        try {
          if (src === "file") { const f = bg.querySelector("#m_file").files[0]; if (f) { btn.disabled = true; btn.textContent = "Uploading..."; const up = await API.adminUpload(Admin.token, "materials", f); url = up.url; type = up.type; size = up.size; } if (!url) throw new Error("Choose a file to upload."); }
          else { url = bg.querySelector("#m_url").value.trim(); type = "link"; size = null; if (!/^https?:\/\//.test(url)) throw new Error("Enter a full web address starting with https://"); }
          await Admin.guard(() => API.adminSaveMaterial(Admin.token, { id: m ? m.id : null, title: bg.querySelector("#m_title").value.trim(), description: bg.querySelector("#m_desc").value.trim(), url, type, size, visible: bg.querySelector("#m_vis").checked }));
          bg.remove(); toast("Saved"); Admin.materials(el);
        } catch (ex) { toast(ex.message); btn.disabled = false; btn.textContent = "Save"; }
      });
    },

    async appearance(el) {
      const s = await Admin.guard(() => API.adminSettings(Admin.token));
      const top = s.bannerTop || {}, pop = s.bannerPopup || {}, th = s.splashTheme || {};
      const builtIn = { sp_img: DEFAULT_IMG.logo, sp_vis: DEFAULT_IMG.visual };
      const imgField = (id, url, kind, hint) => `<div class="stack-sm"><div id="${id}_prev">${url ? `<img class="img-preview" src="${esc(assetUrl(url))}" alt="">` : builtIn[id] ? `<img class="img-preview" style="background:#123c8f;padding:8px" src="${esc(assetUrl(builtIn[id]))}" alt=""><span class="small muted">Built-in default in use.</span>` : `<span class="small muted">No image yet.</span>`}</div><div class="row"><input type="file" class="input" id="${id}_file" accept=".png,.jpg,.jpeg,.webp,.gif" style="max-width:320px"><button class="btn sm" type="button" data-upload="${id}" data-kind="${kind}">Upload</button>${url ? `<button class="btn sm ghost" type="button" data-clear="${id}">Remove</button>` : ""}</div><input type="hidden" id="${id}" value="${esc(url || "")}"><span class="hint">${hint}</span></div>`;
      el.innerHTML = `<div class="stack">
        <form class="card stack" id="apForm">
          <h2>Start screen</h2>
          <div class="grid-2">
            <div class="field"><label for="sp_kicker">Small line above the logo</label><input class="input" id="sp_kicker" value="${esc(s.splashKicker ?? "World AMR Awareness Week · 18 to 24 November")}" placeholder="Leave empty to hide"></div>
            <div class="field"><label for="sp_head">Headline (shown if the logo is hidden; also the page name)</label><input class="input" id="sp_head" value="${esc(s.splashHeadline || "")}"></div>
            <div class="field"><label for="sp_sub">Sub-line under the logo</label><input class="input" id="sp_sub" value="${esc(s.splashSub || "")}" placeholder="Leave empty to hide"></div>
            <div class="field"><label for="sp_cta">Button text</label><input class="input" id="sp_cta" value="${esc(s.splashCta || "Register Now")}"></div>
          </div>
          <div class="grid-4">
            <div class="field"><label for="th_bg1">Background top</label><input class="input" type="color" id="th_bg1" value="${esc(th.bg1 || "#1d5fb8")}"></div>
            <div class="field"><label for="th_bg2">Background middle</label><input class="input" type="color" id="th_bg2" value="${esc(th.bg2 || "#123c8f")}"></div>
            <div class="field"><label for="th_bg3">Background bottom</label><input class="input" type="color" id="th_bg3" value="${esc(th.bg3 || "#0b2a6a")}"></div>
            <div class="field"><label for="th_ctatext">Button text colour</label><input class="input" type="color" id="th_ctatext" value="${esc(th.ctaText || "#0b2a6a")}"></div>
            <div class="field"><label for="th_cta1">Button colour (top)</label><input class="input" type="color" id="th_cta1" value="${esc(th.cta1 || "#ffd969")}"></div>
            <div class="field"><label for="th_cta2">Button colour (bottom)</label><input class="input" type="color" id="th_cta2" value="${esc(th.cta2 || "#f5b72b")}"></div>
            <div class="field"><label for="th_logow">Logo width (px, desktop)</label><input class="input" type="number" id="th_logow" min="200" max="900" value="${esc(th.logoWidth || 560)}"></div>
            <div class="field"><label for="th_visw">Key visual width (px, desktop)</label><input class="input" type="number" id="th_visw" min="200" max="900" value="${esc(th.visualWidth || 420)}"></div>
          </div>
          <div class="row"><label class="check"><input type="checkbox" id="th_hidelogo" ${th.hideLogo ? "checked" : ""}><span>Hide the logo and show the headline as text instead</span></label><label class="check"><input type="checkbox" id="th_hidevis" ${th.hideVisual ? "checked" : ""}><span>Hide the key visual</span></label></div>
          <div class="row"><button class="btn sm" type="button" id="th_reset">Reset colours and sizes to the poster defaults</button></div>
          <div class="field"><label>Campaign logo</label>${imgField("sp_img", s.splashIcon, "splash", "Shown at the top of the start screen and on the registration page. PNG with a transparent background, about 1200 x 680 px, under 1 MB. Leave empty to use the built-in AMR Avengers logo.")}</div>
          <div class="field"><label>Key visual (below the sub-line)</label>${imgField("sp_vis", s.splashVisual, "splash", "The shield-and-capsule picture. PNG with soft or transparent edges, about 800 x 600 px, under 1 MB. Leave empty to use the built-in one.")}</div>
          <h2>Top banner</h2>
          <label class="check"><input type="checkbox" id="bt_on" ${top.enabled ? "checked" : ""}><span>Show a horizontal banner at the top of the participant pages</span></label>
          <div class="field"><label>Banner image</label>${imgField("bt_img", top.image, "banners", "Recommended 1200 x 300 px (4:1). Shown full width on phones.")}</div>
          <div class="field"><label for="bt_link">Link when tapped (optional)</label><input class="input" id="bt_link" value="${esc(top.link || "")}" placeholder="https://..."></div>
          <h2>Pop-up banner</h2>
          <label class="check"><input type="checkbox" id="bp_on" ${pop.enabled ? "checked" : ""}><span>Show a pop-up when a participant enters their home page (once per visit)</span></label>
          <div class="field"><label>Pop-up image</label>${imgField("bp_img", pop.image, "banners", "Recommended 1080 x 1350 px (4:5) or square. Participants can close it any time.")}</div>
          <div class="grid-2"><div class="field"><label for="bp_link">Link when tapped (optional)</label><input class="input" id="bp_link" value="${esc(pop.link || "")}" placeholder="https://..."></div><div class="field"><label for="bp_sec">Closes automatically after (seconds)</label><input class="input" id="bp_sec" type="number" min="3" max="60" value="${pop.seconds || 10}"></div></div>
          <div class="row end"><button class="btn primary" type="submit">Save appearance</button></div>
        </form></div>`;
      el.querySelectorAll("[data-upload]").forEach((b) => b.addEventListener("click", async () => {
        const id = b.dataset.upload; const f = el.querySelector("#" + id + "_file").files[0]; if (!f) { toast("Choose an image first."); return; }
        b.disabled = true; b.textContent = "Uploading...";
        try { const up = await API.adminUpload(Admin.token, b.dataset.kind, f); el.querySelector("#" + id).value = up.url; el.querySelector("#" + id + "_prev").innerHTML = `<img class="img-preview" src="${esc(assetUrl(up.url))}" alt="">`; toast("Uploaded. Press Save appearance to apply."); }
        catch (ex) { toast(ex.message); }
        b.disabled = false; b.textContent = "Upload";
      }));
      el.querySelector("#th_reset").addEventListener("click", () => { const d = { th_bg1: "#1d5fb8", th_bg2: "#123c8f", th_bg3: "#0b2a6a", th_cta1: "#ffd969", th_cta2: "#f5b72b", th_ctatext: "#0b2a6a", th_logow: 560, th_visw: 420 }; Object.entries(d).forEach(([k, v]) => { el.querySelector("#" + k).value = v; }); el.querySelector("#th_hidelogo").checked = false; el.querySelector("#th_hidevis").checked = false; toast("Defaults restored. Press Save appearance to apply."); });
      el.querySelectorAll("[data-clear]").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.clear; el.querySelector("#" + id).value = ""; el.querySelector("#" + id + "_prev").innerHTML = `<span class="small muted">Removed${builtIn[id] ? ", the built-in default will be used" : ""}. Press Save appearance to apply.</span>`; }));
      document.getElementById("apForm").addEventListener("submit", async (e) => {
        e.preventDefault(); const g = (id) => el.querySelector("#" + id);
        await Admin.guard(() => API.adminSaveSettings(Admin.token, { splashHeadline: g("sp_head").value.trim(), splashSub: g("sp_sub").value.trim(), splashKicker: g("sp_kicker").value.trim(), splashCta: g("sp_cta").value.trim() || "Register Now", splashIcon: g("sp_img").value, splashVisual: g("sp_vis").value,
          splashTheme: { bg1: g("th_bg1").value, bg2: g("th_bg2").value, bg3: g("th_bg3").value, cta1: g("th_cta1").value, cta2: g("th_cta2").value, ctaText: g("th_ctatext").value, logoWidth: Number(g("th_logow").value) || 560, visualWidth: Number(g("th_visw").value) || 420, hideLogo: g("th_hidelogo").checked, hideVisual: g("th_hidevis").checked }, bannerTop: { enabled: g("bt_on").checked, image: g("bt_img").value, link: g("bt_link").value.trim() }, bannerPopup: { enabled: g("bp_on").checked, image: g("bp_img").value, link: g("bp_link").value.trim(), seconds: Number(g("bp_sec").value) || 10 } }));
        await Admin.refreshSettings(); toast("Appearance saved"); Admin.appearance(el);
      });
    },

    async smsbase(el) {
      const st = await Admin.guard(() => API.adminSmsBaseStats(Admin.token));
      el.innerHTML = `<div class="stack">
        <div class="grid-4">
          <div class="kpi"><b class="num">${st.total}</b><span>Numbers in SMS base</span></div>
          <div class="kpi"><b class="num">${st.registered}</b><span>Registered from base ${st.total ? `(${Math.round((st.registered / st.total) * 100)}%)` : ""}</span></div>
          <div class="kpi"><b class="num">${st.completed}</b><span>Completed from base</span></div>
          <div class="kpi"><b class="num">${st.outsideBase}</b><span>Registered outside base</span></div>
        </div>
        <div class="card stack"><h2>Upload the SMS base</h2>
          <p class="small muted">Upload the same list you send SMS to: an Excel (.xlsx), CSV or text file with one mobile number per row (any column named phone/mobile/number, or the first column). Numbers are stored as 11 digits (01XXXXXXXXX); +88 and spaces are removed automatically. Duplicates are ignored.</p>
          <div class="row"><input type="file" class="input" id="sbFile" accept=".xlsx,.xls,.csv,.txt" style="max-width:360px"><label class="check"><input type="checkbox" id="sbReplace"><span>Replace the existing base</span></label><button class="btn primary" id="sbGo" disabled>Upload</button></div>
          <div id="sbStatus" class="small muted"></div>
        </div>
        <div class="card stack"><h2>Reports</h2>
          <p class="small muted">The match report lists every number in the SMS base with whether it registered, completed, its score and rank, followed by any participants who registered from numbers outside the base. Open it in Excel and filter.</p>
          <div class="row"><button class="btn" id="sbExport">Export SMS base match report (CSV)</button><button class="btn danger" id="sbClear" ${st.total ? "" : "disabled"}>Clear base</button></div>
        </div></div>`;
      let phones = null;
      el.querySelector("#sbFile").addEventListener("change", async (e) => {
        const f = e.target.files[0]; if (!f) return; const status = el.querySelector("#sbStatus"); status.textContent = "Reading file...";
        try { phones = await Admin.readPhoneFile(f); status.textContent = `${phones.length} numbers found in ${f.name}.`; el.querySelector("#sbGo").disabled = !phones.length; }
        catch (ex) { status.textContent = "Could not read the file: " + ex.message; phones = null; }
      });
      el.querySelector("#sbGo").addEventListener("click", async () => {
        const b = el.querySelector("#sbGo"); b.disabled = true; b.textContent = "Uploading...";
        try { let added = 0, invalid = 0, total = 0; const replace = el.querySelector("#sbReplace").checked; for (let i = 0; i < phones.length; i += 2000) { const r = await API.adminSmsBaseUpload(Admin.token, phones.slice(i, i + 2000), replace && i === 0); added += r.added; invalid += r.invalid; total = r.total; } toast(`${added} numbers added${invalid ? `, ${invalid} invalid skipped` : ""}. Base now ${total}.`); Admin.smsbase(el); }
        catch (ex) { toast(ex.message); b.disabled = false; b.textContent = "Upload"; }
      });
      el.querySelector("#sbExport").addEventListener("click", async () => { const r = await Admin.guard(() => API.adminExport(Admin.token, "smsmatch")); Admin.download(r.filename, r.csv, "text/csv"); });
      el.querySelector("#sbClear").addEventListener("click", async () => { if (await confirmBox({ title: "Clear the SMS base?", body: "Participants are not affected; only the comparison list is removed.", okText: "Clear", danger: true })) { await Admin.guard(() => API.adminSmsBaseClear(Admin.token)); toast("Cleared"); Admin.smsbase(el); } });
    },
    async readPhoneFile(f) {
      const name = f.name.toLowerCase();
      const pick = (rows) => {
        if (!rows.length) return [];
        let col = 0; const head = rows[0].map((h) => String(h ?? "").toLowerCase());
        const hi = head.findIndex((h) => /phone|mobile|number|msisdn|cell/.test(h)); if (hi >= 0) { col = hi; rows = rows.slice(1); }
        return rows.map((r) => String(r[col] ?? "").trim()).filter(Boolean);
      };
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        if (!window.XLSX) await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; sc.onload = res; sc.onerror = () => rej(new Error("Could not load the Excel reader. Save the file as CSV and try again.")); document.head.appendChild(sc); });
        const buf = await f.arrayBuffer(); const wb = window.XLSX.read(buf, { type: "array" }); const ws = wb.Sheets[wb.SheetNames[0]];
        return pick(window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }));
      }
      const text = await f.text(); const rows = text.split(/\r?\n/).map((l) => l.split(/[,\t;]/));
      return pick(rows);
    },

    async colleges(el, q = "") {
      const list = await Admin.guard(() => API.adminInstitutions(Admin.token));
      const shown = list.filter((n) => !q || n.toLowerCase().includes(q.toLowerCase()));
      el.innerHTML = `<div class="stack">
        <div class="row between"><div><h2>${list.length} medical colleges</h2><span class="small muted">These appear in the registration drop-down, alphabetically. Doctors can also choose "Other" and type a name.</span></div>
          <form class="row" id="addInst"><input class="input" id="instNew" placeholder="Add a college, e.g. Thakurgaon Medical College, Thakurgaon" style="min-width:300px" required><button class="btn sm primary" type="submit">Add</button></form></div>
        <div class="row between"><input class="input" id="instSearch" placeholder="Filter list" value="${esc(q)}" style="max-width:280px"><button class="btn sm" id="instReset">Restore default list</button></div>
        <div class="table-wrap"><table><thead><tr><th>#</th><th>Medical college</th><th></th></tr></thead><tbody>
          ${shown.map((n, i) => `<tr><td class="num">${i + 1}</td><td>${esc(n)}</td><td class="actions"><button class="btn sm danger" data-rm="${esc(n)}">Remove</button></td></tr>`).join("") || `<tr><td colspan="3" class="muted">No match.</td></tr>`}
        </tbody></table></div></div>`;
      const save = async (next) => { await Admin.guard(() => API.adminSaveInstitutions(Admin.token, next)); await Admin.refreshSettings(); Admin.colleges(el, document.getElementById("instSearch").value); };
      document.getElementById("addInst").addEventListener("submit", async (e) => { e.preventDefault(); const v = document.getElementById("instNew").value.trim(); if (!v) return; if (list.some((n) => n.toLowerCase() === v.toLowerCase())) { toast("Already in the list"); return; } await save([...list, v]); toast("Added"); });
      let st; document.getElementById("instSearch").addEventListener("input", (e) => { clearTimeout(st); st = setTimeout(() => Admin.colleges(el, e.target.value), 250); });
      el.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", async () => { if (await confirmBox({ title: "Remove this college?", body: b.dataset.rm + " will no longer appear in the drop-down. Existing registrations keep their value.", okText: "Remove", danger: true })) { await save(list.filter((n) => n !== b.dataset.rm)); toast("Removed"); } }));
      document.getElementById("instReset").addEventListener("click", async () => { if (await confirmBox({ title: "Restore the default list?", body: "Your additions and removals will be replaced by the built-in list of 112 colleges.", okText: "Restore" })) { await save(null); toast("Default list restored"); } });
    },

    async settings(el) {
      const s = await Admin.guard(() => API.adminSettings(Admin.token));
      const toLocal = (ms) => { if (!ms) return ""; const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
      el.innerHTML = `<div class="stack">
        <form class="card stack" id="accForm"><h2>Quiz access</h2>
          <div class="radio-row"><label><input type="radio" name="qmode" value="manual" ${s.quizMode !== "scheduled" ? "checked" : ""}> Manual: I open and close the quiz myself</label><label><input type="radio" name="qmode" value="scheduled" ${s.quizMode === "scheduled" ? "checked" : ""}> Scheduled: opens and closes at set times</label></div>
          <div id="qManual" ${s.quizMode === "scheduled" ? "hidden" : ""}><label class="check"><input type="checkbox" id="q_open" ${s.quizOpen ? "checked" : ""}><span>The quiz is open now (participants can press Start)</span></label></div>
          <div id="qSched" class="grid-2" ${s.quizMode === "scheduled" ? "" : "hidden"}>
            <div class="field"><label for="q_start">Opens at</label><input class="input" id="q_start" type="datetime-local" value="${toLocal(s.quizStartAt)}"><span class="hint">Participants see a live countdown to this moment.</span></div>
            <div class="field"><label for="q_end">Closes at</label><input class="input" id="q_end" type="datetime-local" value="${toLocal(s.quizEndAt)}"><span class="hint">Leave blank to keep it open until you close it.</span></div>
          </div>
          <label class="check"><input type="checkbox" id="s_reg" ${s.registrationOpen !== false ? "checked" : ""}><span>Registration is open (new doctors can create accounts)</span></label>
          <label class="check"><input type="checkbox" id="s_board" ${s.leaderboardPublic ? "checked" : ""}><span>Ranking board visible to participants</span></label>
          <label class="check"><input type="checkbox" id="s_expl" ${s.showExplanations !== false ? "checked" : ""}><span>Show correct answers and explanations to a doctor right after they submit (switch off until the quiz closes if you want to prevent answer sharing)</span></label>
          <div class="row end"><button class="btn primary" type="submit">Save access settings</button></div>
        </form>
        <form class="card stack" id="setForm"><h2>Quiz settings</h2>
          <div class="grid-2">
            <div class="field"><label for="s_name">Campaign name</label><input class="input" id="s_name" value="${esc(s.campaignName)}"></div>
            <div class="field"><label for="s_sponsor">Brand line</label><input class="input" id="s_sponsor" value="${esc(s.sponsor)}"></div>
            <div class="field"><label for="s_dur">Duration (minutes)</label><input class="input" id="s_dur" type="number" min="1" max="120" value="${Math.round(s.durationSec / 60)}"></div>
            <div class="field"><label for="s_count">Questions per attempt</label><input class="input" id="s_count" type="number" min="1" max="200" value="${s.questionCount}"><span class="hint">If fewer active questions exist, all of them are used.</span></div>
          </div>
          <label class="check"><input type="checkbox" id="s_shuffle" ${s.shuffle ? "checked" : ""}><span>Shuffle question order for every participant</span></label>
          <div class="field"><label for="s_terms">Terms and conditions (one point per line)</label><textarea class="input" id="s_terms" style="min-height:160px">${esc(s.terms || "")}</textarea></div>
          <div class="row end"><button class="btn primary" type="submit">Save settings</button></div>
        </form>
        <form class="card stack" id="pwForm"><h2>Admin password</h2>
          <div class="grid-2"><div class="field"><label for="pw_old">Current password</label><input class="input" type="password" id="pw_old" required></div><div class="field"><label for="pw_new">New password</label><input class="input" type="password" id="pw_new" minlength="8" required></div></div>
          <div class="row end"><button class="btn" type="submit">Change password</button></div></form>
        <div class="card stack"><h2>Danger zone</h2><p class="muted small">Use before going live to clear test entries. Questions, materials and settings stay.</p><div class="row"><button class="btn danger" id="btnResetAttempts">Clear all quiz attempts (keep accounts)</button><button class="btn danger" id="btnReset">Delete all participants</button></div></div>
      </div>`;
      el.querySelectorAll("[name=qmode]").forEach((r) => r.addEventListener("change", () => { const v = el.querySelector("[name=qmode]:checked").value; el.querySelector("#qManual").hidden = v !== "manual"; el.querySelector("#qSched").hidden = v !== "scheduled"; }));
      const g = (id) => el.querySelector("#" + id);
      document.getElementById("accForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const mode = el.querySelector("[name=qmode]:checked").value;
        await Admin.guard(() => API.adminSaveSettings(Admin.token, { quizMode: mode, quizOpen: g("q_open").checked, quizStartAt: g("q_start").value ? new Date(g("q_start").value).getTime() : null, quizEndAt: g("q_end").value ? new Date(g("q_end").value).getTime() : null, registrationOpen: g("s_reg").checked, leaderboardPublic: g("s_board").checked, showExplanations: g("s_expl").checked }));
        await Admin.refreshSettings(); toast("Access settings saved"); Admin.settings(el);
      });
      document.getElementById("setForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        await Admin.guard(() => API.adminSaveSettings(Admin.token, { campaignName: g("s_name").value.trim() || "Battle of Interns", sponsor: g("s_sponsor").value.trim(), durationSec: Math.max(60, Number(g("s_dur").value) * 60), questionCount: Math.max(1, Number(g("s_count").value)), shuffle: g("s_shuffle").checked, terms: g("s_terms").value.trim() }));
        await Admin.refreshSettings(); toast("Settings saved"); Admin.settings(el);
      });
      document.getElementById("pwForm").addEventListener("submit", async (e) => { e.preventDefault(); await Admin.guard(() => API.adminChangePassword(Admin.token, g("pw_old").value, g("pw_new").value)); toast("Password changed"); e.target.reset(); });
      document.getElementById("btnResetAttempts").addEventListener("click", async () => { if (await confirmBox({ title: "Clear all quiz attempts?", body: "Every score is deleted; accounts stay and everyone can take the quiz again.", okText: "Clear attempts", danger: true })) { await Admin.guard(() => API.adminResetAttempts(Admin.token)); toast("Attempts cleared"); } });
      document.getElementById("btnReset").addEventListener("click", async () => { if (await confirmBox({ title: "Delete all participants?", body: "Accounts, answers and rankings are deleted. This cannot be undone. Export first if you need the data.", okText: "Delete everything", danger: true })) { await Admin.guard(() => API.adminReset(Admin.token)); store.del("boi_token"); toast("Participants deleted"); Admin.tab = "overview"; Admin.render(); } });
    },

    async download(filename, text, type) {
      try { if (window.claude && window.claude.use) { const dl = await window.claude.use("downloads"); if (dl) { await dl.save({ filename, data: new Blob([text], { type }) }); return; } } } catch (e) { /* viewer declined; fall through */ }
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
  };


  route();
})();
