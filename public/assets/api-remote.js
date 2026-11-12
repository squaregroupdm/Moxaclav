/* Hosted adapter: every function calls the PHP API in /api. Same function names as demo/api-local.js. */
window.BOI_API = (function () {
  "use strict";
  const BASE = (window.BOI_API_BASE || "api/index.php") + "?r=";

  async function call(route, body, adminToken) {
    const headers = { "Content-Type": "application/json" };
    if (adminToken) headers["X-Admin-Token"] = adminToken;
    let res;
    try { res = await fetch(BASE + route, { method: "POST", headers, body: JSON.stringify(body || {}), credentials: "same-origin" }); }
    catch (e) { throw new Error("Cannot reach the server. Check your connection and try again."); }
    let data = null;
    try { data = await res.json(); } catch (e) { throw new Error("The server returned an unexpected response (" + res.status + ")."); }
    if (!res.ok || data.error) throw new Error(data.error || ("Request failed (" + res.status + ")."));
    return data;
  }
  async function upload(adminToken, kind, file) {
    const fd = new FormData(); fd.append("kind", kind); fd.append("file", file);
    let res;
    try { res = await fetch(BASE + "admin/upload", { method: "POST", headers: { "X-Admin-Token": adminToken }, body: fd, credentials: "same-origin" }); }
    catch (e) { throw new Error("Upload failed. Check your connection and try again."); }
    let data = null;
    try { data = await res.json(); } catch (e) { throw new Error("The server refused the upload (" + res.status + "). The file may be larger than the server allows."); }
    if (!res.ok || data.error) throw new Error(data.error || "Upload failed.");
    return data;
  }

  return {
    getSettings: () => call("settings"),
    register: (d) => call("register", d),
    login: (phone, password) => call("login", { phone, password }),
    logout: (token) => call("logout", { token }).catch(() => ({})),
    me: (token) => call("me", { token }),
    startAttempt: (token) => call("start", { token }),
    saveProgress: (token, p) => call("progress", { token, ...p }),
    submitAttempt: (token, p) => call("submit", { token, ...p }),
    getResult: (token) => call("result", { token }),
    getLeaderboard: (token) => call("leaderboard", { token }),

    adminLogin: (password) => call("admin/login", { password }),
    adminLogout: () => Promise.resolve(),
    adminStats: (t) => call("admin/stats", {}, t),
    adminQuestions: (t) => call("admin/questions", {}, t),
    adminSaveQuestion: (t, q) => call("admin/question-save", q, t),
    adminDeleteQuestion: (t, id) => call("admin/question-delete", { id }, t),
    adminImportQuestions: (t, list, replace) => call("admin/question-import", { questions: list, replace: !!replace }, t),
    adminParticipants: (t, opts) => call("admin/participants", opts || {}, t),
    adminParticipantAnswers: (t, id) => call("admin/participant-answers", { id }, t),
    adminDeleteParticipant: (t, id) => call("admin/participant-delete", { id }, t),
    adminSetParticipantPassword: (t, id, newPassword) => call("admin/participant-password", { id, newPassword }, t),
    adminResetParticipantAttempt: (t, id) => call("admin/participant-reset-attempt", { id }, t),
    adminExport: (t, kind) => call("admin/export", { kind }, t),
    adminRanking: (t) => call("admin/ranking", {}, t),
    adminInstitutions: (t) => call("admin/institutions", {}, t),
    adminSaveInstitutions: (t, list) => call("admin/institutions-save", { institutions: list }, t),
    adminMaterials: (t) => call("admin/materials", {}, t),
    adminSaveMaterial: (t, m) => call("admin/material-save", m, t),
    adminDeleteMaterial: (t, id) => call("admin/material-delete", { id }, t),
    adminOrderMaterials: (t, ids) => call("admin/material-order", { ids }, t),
    adminUpload: (t, kind, file) => upload(t, kind, file),
    adminSmsBaseUpload: (t, phones, replace) => call("admin/smsbase-upload", { phones, replace: !!replace }, t),
    adminSmsBaseStats: (t) => call("admin/smsbase-stats", {}, t),
    adminSmsBaseClear: (t) => call("admin/smsbase-clear", {}, t),
    adminSettings: (t) => call("admin/settings", {}, t),
    adminSaveSettings: (t, s) => call("admin/settings-save", s, t),
    adminChangePassword: (t, oldPw, newPw) => call("admin/password", { oldPassword: oldPw, newPassword: newPw }, t),
    adminReset: (t) => call("admin/reset", {}, t),
    adminResetAttempts: (t) => call("admin/reset-attempts", {}, t),
  };
})();
