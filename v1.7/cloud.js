/* 무드맵 서버 연결(Supabase) — SDK 없이 REST로 직접 호출합니다.
   브라우저에는 공개 가능한 anon 키만 사용하며, 실제 접근 제어는 서버의 RLS가 합니다. */
(function () {
  "use strict";
  var cfg = window.MOODMAP_CONFIG || {};
  var URL_ = String(cfg.SUPABASE_URL || "").replace(/\/+$/, ""), KEY = cfg.SUPABASE_ANON_KEY || "";
  var SK = "moodmap.session", sess = null;

  function enabled() { return !!(URL_ && KEY); }
  try { sess = JSON.parse(localStorage.getItem(SK)); } catch (e) { sess = null; }
  function store(s) {
    sess = s;
    try { if (s) localStorage.setItem(SK, JSON.stringify(s)); else localStorage.removeItem(SK); } catch (e) { /* 무시 */ }
  }
  function toSession(r) {
    var u = r.user || {};
    return { access_token: r.access_token, refresh_token: r.refresh_token,
      expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600),
      user: { id: u.id, email: u.email, name: (u.user_metadata || {}).display_name || "" } };
  }
  function fail(status, body) {
    var e = new Error((body && (body.msg || body.message || body.error_description || body.error)) || "요청에 실패했습니다.");
    e.status = status; e.code = (body && (body.error_code || body.code)) || ""; return e;
  }
  function raw(url, opt) {
    return fetch(url, opt).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        if (!r.ok) throw fail(r.status, j);
        return j;
      });
    }, function () { var e = new Error("네트워크 연결을 확인해 주세요."); e.code = "network"; throw e; });
  }
  function authCall(path, body, bearer) {
    var h = { apikey: KEY, "Content-Type": "application/json" };
    if (bearer) h.Authorization = "Bearer " + bearer;
    return raw(URL_ + "/auth/v1/" + path, { method: "POST", headers: h, body: JSON.stringify(body || {}) });
  }

  function signUp(email, password, name) {
    return authCall("signup", { email: email, password: password, data: { display_name: name } }).then(function (r) {
      if (!r || !r.access_token) { var e = new Error("확인 메일이 필요한 설정입니다."); e.code = "confirm_required"; throw e; }
      store(toSession(r)); return sess;
    });
  }
  function signIn(email, password) {
    return authCall("token?grant_type=password", { email: email, password: password }).then(function (r) { store(toSession(r)); return sess; });
  }
  var refreshing = null;
  function refresh() {
    if (!sess || !sess.refresh_token) return Promise.reject(new Error("로그인이 필요합니다."));
    if (!refreshing) {
      refreshing = authCall("token?grant_type=refresh_token", { refresh_token: sess.refresh_token })
        .then(function (r) { store(toSession(r)); refreshing = null; return sess; },
          function (e) { refreshing = null; if (e.status && e.status < 500) store(null); throw e; });
    }
    return refreshing;
  }
  function token() {
    if (!sess) return Promise.reject(new Error("로그인이 필요합니다."));
    if (sess.expires_at - 60 > Date.now() / 1000) return Promise.resolve(sess.access_token);
    return refresh().then(function (s) { return s.access_token; });
  }
  function signOut() {
    var t = sess && sess.access_token;
    store(null);
    if (t) authCall("logout", {}, t).catch(function () { /* 서버 응답과 무관하게 이 기기에서는 로그아웃 */ });
    return Promise.resolve();
  }
  function call(method, path, body, prefer, retried) {
    return token().then(function (t) {
      var h = { apikey: KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" };
      if (prefer) h.Prefer = prefer;
      return raw(URL_ + "/rest/v1/" + path, { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    }).catch(function (e) {
      if (e.status === 401 && !retried && sess) return refresh().then(function () { return call(method, path, body, prefer, true); });
      throw e;
    });
  }
  function msg(e) {
    var c = (e && e.code) || "", m = (e && e.message) || "";
    if (c === "network") return "네트워크 연결을 확인해 주세요.";
    if (c === "invalid_credentials" || /invalid login/i.test(m)) return "이메일 또는 비밀번호가 올바르지 않습니다.";
    if (c === "user_already_exists" || /already registered/i.test(m)) return "이미 가입된 이메일입니다. 로그인해 주세요.";
    if (c === "weak_password") return "비밀번호가 너무 약합니다. 8자 이상, 영문과 숫자를 섞어 주세요.";
    if (c === "email_provider_disabled") return "서버에서 이메일 가입이 꺼져 있습니다. 관리자에게 문의해 주세요.";
    if (c === "over_request_rate_limit" || c === "over_email_send_rate_limit" || (e && e.status === 429)) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
    if (c === "validation_failed" || /valid email|email address/i.test(m)) return "올바른 이메일 주소를 입력해 주세요.";
    if (c === "confirm_required") return "이 서버는 이메일 확인이 필요한 설정입니다. 관리자에게 문의해 주세요.";
    if (e && e.status === 42501 || c === "42501") return "권한이 없습니다.";
    return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  window.MoodCloud = {
    enabled: enabled,
    session: function () { return sess; },
    signUp: signUp, signIn: signIn, signOut: signOut, msg: msg,
    get: function (path) { return call("GET", path); },
    insert: function (table, rows) { return call("POST", table, rows, "return=minimal"); },
    patch: function (path, body) { return call("PATCH", path, body, "return=minimal"); },
    del: function (path) { return call("DELETE", path, undefined, "return=minimal"); },
    rpc: function (fn, args) { return call("POST", "rpc/" + fn, args || {}); }
  };
})();
