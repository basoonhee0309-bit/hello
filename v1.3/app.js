(function () {
  "use strict";

  /* ---------- 상수 ---------- */
  var CATS = {
    safety_light: { label: "안전·조명", color: "#dc2626" },
    walk: { label: "보행", color: "#d97706" },
    environment: { label: "환경·청결", color: "#059669" },
    transport: { label: "교통·편의", color: "#2563eb" },
    noise_crowd: { label: "소음·혼잡", color: "#7c3aed" },
    other: { label: "기타", color: "#64748b" }
  };
  // 10단계: 1(매우 불편함) ~ 10(매우 만족함). 필드명 discomfort는 v3 호환을 위해 유지한다.
  var LV = { 1: "매우 불편함", 2: "불편함", 3: "꽤 불편함", 4: "다소 불편함", 5: "약간 불편함", 6: "약간 만족함", 7: "다소 만족함", 8: "꽤 만족함", 9: "만족함", 10: "매우 만족함" };
  var LV_COLOR = { 1: "#b91c1c", 2: "#dc2626", 3: "#ea580c", 4: "#f97316", 5: "#d97706", 6: "#65a30d", 7: "#4d9a1a", 8: "#16a34a", 9: "#15803d", 10: "#166534" };
  // v3 5단계(5=매우 불편 … 1=매우 만족) → v4. '보통(3)'은 불편/만족 어느 쪽으로도 임의 배정하지 않고 미선택으로 둔다.
  var OLD_LV = { 5: 1, 4: 3, 3: null, 2: 8, 1: 10 };
  var MAX_PHOTOS = 5;
  var EMO = {
    anxious: { e: "😟", label: "불안함", color: "#f59e0b" },
    angry: { e: "😡", label: "화남", color: "#dc2626" },
    sad: { e: "😢", label: "슬픔", color: "#3b82f6" },
    frustrated: { e: "😣", label: "답답함", color: "#8b5cf6" },
    unpleasant: { e: "😖", label: "불쾌함", color: "#84cc16" },
    scared: { e: "😨", label: "무서움", color: "#475569" },
    relieved: { e: "😌", label: "안도감", color: "#14b8a6", pos: 1 },
    satisfied: { e: "😊", label: "만족감", color: "#22c55e", pos: 1 }
  };
  var OLD_EMO = { uncomfortable: "unpleasant", dangerous: "scared", tiring: "frustrated", annoyed: "angry" };
  function normEmo(k) { return EMO[k] ? k : (OLD_EMO[k] || "unpleasant"); }
  var STATUS = { written: "제안 작성 완료", delivered: "작성자 직접 전달 기록", edited: "제안서 수정", received: "접수 확인", reviewing: "검토 중", planned: "개선 예정", done: "개선 완료" };
  var STEPS = ["제안 작성 완료", "담당자 확인 대기", "담당자 확인 완료", "개선 검토 중", "개선 완료"];
  var STEP_IDX = { written: 0, received: 2, reviewing: 3, planned: 3, done: 4 };
  var ACTOR = { author: "작성자 기록", demo_example: "시연용 예시" };
  var DEFAULT_CHECKS = {
    safety_light: ["야간 조도 측정 및 점등 상태 확인", "어두운 구간의 조명 간격 확인", "보강이 필요한 설치 지점 검토"],
    walk: ["보도 턱·파손 구간 현장 확인", "휠체어·유모차 통행 폭 확인", "보수 우선순위 검토"],
    environment: ["쓰레기 적치 시간대·수거 주기 확인", "배출 장소 안내·시설 점검", "청소 주기 조정 검토"],
    transport: ["정류장 시설(의자·쉼터) 현황 확인", "이용이 몰리는 시간대 확인", "시설 보강 검토"],
    noise_crowd: ["혼잡·소음 발생 시간대 확인", "안전 동선·안내 점검", "관리 방안 검토"],
    other: ["현장 상황 확인", "시민이 적은 불편 이유 검토", "개선 필요성 검토"]
  };
  var CENTER = [35.2150, 128.6200];
  var KEY = "moodmap.v4";
  var SIMILAR_M = 100, PLACE_M = 50, CLUSTER_PX = 44;

  /* ---------- 유틸 ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var uid = (function () {
    var u = localStorage.getItem("moodmap.uid");
    if (!u) { u = "u" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("moodmap.uid", u); }
    return u;
  })();
  function newId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function fmt(t) { var d = new Date(t); return d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate(); }
  function fmtT(t) { var d = new Date(t); return fmt(t) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function dist(a, b, c, d) {
    var R = 6371000, r = Math.PI / 180, dl = (c - a) * r, dg = (d - b) * r;
    var x = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dg / 2) * Math.sin(dg / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }
  function b64enc(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function b64dec(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  }
  function emoOf(k) { return EMO[normEmo(k)]; }
  function catLabel(c, other) { return c === "other" ? (other || "기타") : (CATS[c] || CATS.other).label; }
  function lvBadge(n) { return n ? '<span class="badge" style="background:' + LV_COLOR[n] + '">' + LV[n] + "</span>" : ""; }
  function photosOf(i) { return i.photos || (i.photo ? [i.photo] : []); }
  function photoGrid(arr) {
    return arr.length ? '<div class="pgrid">' + arr.map(function (src, n) { return '<img class="photo" alt="첨부 사진 ' + (n + 1) + '" src="' + src + '">'; }).join("") + "</div>" : "";
  }
  function isPublic(i) { return i.visibility !== "private" && (i.author !== uid || !!(db.settings && db.settings.timelinePublic)); }
  function visibleIssues() { return db.issues.filter(function (i) { return i.author === uid || isPublic(i); }); }
  function mine() { return db.issues.filter(function (i) { return i.author === uid; }); }
  function cleanFields(f, names) {
    var n = 0;
    names.forEach(function (k) {
      var el = f.elements[k]; if (!el || !el.value) return;
      var r = window.CleanBot ? window.CleanBot.clean(el.value) : { text: el.value, count: 0 };
      if (r.count) { el.value = r.text; n += r.count; }
    });
    if (n) toast("비속어 " + n + "개를 ‘삭제된 표현’으로 바꿨어요.");
    return n;
  }

  /* ---------- 데이터: 시드·이전 ---------- */
  function normalizeProposal(p) {
    p.emotion = normEmo(p.emotion);
    p.improvements = p.improvements || "";
    p.direction = p.direction || p.request || "";
    p.checks = p.checks || [];
    p.situation = p.situation || "";
    p.comments = p.comments || [];
    p.log = p.log || [];
    var e = {}; e[p.emotion] = 1;
    p.stats = p.stats || { total: 1, same: 1, byEmotion: e, reasons: [{ emotion: p.emotion, reason: p.description, situation: "", at: p.createdAt }] };
    return p;
  }
  function seed() {
    var now = Date.now(), d = 86400000;
    var mk = function (id, cat, emo, dis, place, lat, lng, desc, sit, likes, ago) {
      return { id: id, author: "demo", visibility: "public", photos: [], category: cat, emotion: emo, discomfort: dis ? OLD_LV[dis] : null, place: place, lat: lat, lng: lng, description: desc, situation: sit, likes: likes, at: now - ago * d, demo: true };
    };
    var issues = [
      mk("d1", "safety_light", "anxious", 5, "마산 합포구 골목 입구", 35.2020, 128.5700, "정류장에서 골목으로 들어서는 구간에 조명이 없어 밤에 혼자 지나기 불안합니다.", "밤 10시 이후 혼자 귀가할 때", ["demo", "demo2", "demo3"], 3),
      mk("d5", "safety_light", "scared", 4, "마산 합포구 골목 입구", 35.2021, 128.5702, "골목 모퉁이가 어두워 사람이 갑자기 나타날 것 같아 무섭습니다.", "야간 학원 마치고 귀가", ["demo"], 2.5),
      mk("d6", "safety_light", "anxious", 4, "마산 합포구 골목 입구", 35.2019, 128.5699, "가로등이 꺼진 구간이 있어 발밑이 보이지 않아요.", "비 오는 저녁", [], 1.5),
      mk("d7", "safety_light", "angry", 3, "마산 합포구 골목 입구", 35.2020, 128.5698, "신고해도 몇 달째 그대로라 화가 납니다.", "", [], 1),
      mk("d2", "walk", "frustrated", 4, "창원 성산구 보도 턱", 35.2230, 128.6810, "보도 턱이 높아 유모차와 휠체어는 차도로 우회해야 합니다.", "유모차로 이동할 때", ["demo"], 2),
      mk("d3", "transport", "unpleasant", 3, "마산 시장 앞 정류장", 35.2085, 128.5780, "정류장 의자가 부족해 장보고 오는 어르신들이 서서 기다립니다.", "오후 장 보고 돌아오는 시간", [], 1),
      mk("d4", "environment", "unpleasant", 3, "창원 상남동 골목", 35.2220, 128.6920, "저녁마다 쓰레기가 쌓여 냄새가 심합니다.", "저녁 7시 이후", ["demo"], 5),
      mk("d8", "environment", "satisfied", 1, "창원 용지공원 산책로", 35.2260, 128.6860, "산책로 조명과 청결 관리가 잘 되어 안심하고 걸을 수 있어요.", "저녁 산책", ["demo"], 4)
    ];
    var comments = [
      { id: "c1", issueId: "d1", author: "demo2", kind: "suggestion", body: "큰길 쪽은 밝지만 골목 첫 모퉁이부터 어두워요.", at: now - 2 * d, demo: true }
    ];
    var proposals = [normalizeProposal({
      id: "p-demo", author: "demo", demo: true, issueId: "d1", title: "마산 합포구 골목 입구 야간 조명 보강 요청",
      improvements: "골목 첫 모퉁이 구간의 야간 조도가 부족합니다.",
      request: "골목 첫 모퉁이의 야간 조도를 확인하고 조명 보강을 검토해 주세요.",
      direction: "골목 첫 모퉁이의 야간 조도를 확인하고 조명 보강을 검토해 주세요.",
      checks: ["야간 조도 측정", "꺼진 가로등 점등 상태 확인"],
      place: "마산 합포구 골목 입구", lat: 35.2020, lng: 128.5700, category: "safety_light", emotion: "anxious",
      description: "정류장에서 골목으로 들어서는 구간에 조명이 없어 밤에 혼자 지나기 불안합니다.", situation: "밤 10시 이후 혼자 귀가할 때",
      reactions: 3, comments: [{ kind: "suggestion", body: "큰길 쪽은 밝지만 골목 첫 모퉁이부터 어두워요.", at: now - 2 * d }],
      stats: { total: 4, same: 2, byEmotion: { anxious: 2, scared: 1, angry: 1 }, reasons: [
        { emotion: "anxious", reason: "정류장에서 골목으로 들어서는 구간에 조명이 없어 밤에 혼자 지나기 불안합니다.", situation: "밤 10시 이후 혼자 귀가할 때", at: now - 3 * d },
        { emotion: "scared", reason: "골목 모퉁이가 어두워 사람이 갑자기 나타날 것 같아 무섭습니다.", situation: "야간 학원 마치고 귀가", at: now - 2.5 * d }
      ] },
      status: "reviewing", createdAt: now - d,
      log: [
        { status: "written", actor: "author", note: "작성 완료", at: now - d },
        { status: "received", actor: "demo_example", note: "접수 확인 (예시)", at: now - d / 2 },
        { status: "reviewing", actor: "demo_example", note: "검토 중 (예시)", at: now - d / 4 }
      ]
    })];
    return { v: 4, issues: issues, comments: comments, proposals: proposals, consults: [], settings: { timelinePublic: false } };
  }
  function migrate(old) {
    old.issues.forEach(function (i) { i.emotion = normEmo(i.emotion); i.situation = i.situation || ""; });
    (old.proposals || []).forEach(normalizeProposal);
    old.comments = old.comments || []; old.consults = old.consults || []; old.v = 2;
    return old;
  }
  function migrate3(d) {
    d.issues.forEach(function (i) {
      i.photos = i.photos || (i.photo ? [i.photo] : []); delete i.photo;
      i.visibility = i.visibility || "public"; i.categoryOther = i.categoryOther || "";
      if (!CATS[i.category]) i.category = "other";
    });
    (d.proposals || []).forEach(function (p) { p.categoryOther = p.categoryOther || ""; });
    d.settings = d.settings || { timelinePublic: false }; d.v = 3;
    return d;
  }
  function migrate4(d) {
    d.issues.forEach(function (i) { i.discomfort = i.discomfort ? (OLD_LV[i.discomfort] || null) : null; });
    (d.proposals || []).forEach(function (p) { if (p.level) p.level = OLD_LV[p.level] || null; });
    d.v = 4;
    return d;
  }
  function readKey(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  var db = readKey(KEY);
  if (!db || !db.issues) {
    var from = "moodmap.v3", old = readKey(from);
    if (old && old.issues) {
      old = old.v >= 4 ? old : migrate4(old);
    } else {
      from = "moodmap.v2"; old = readKey(from);
      if (!old || !old.issues) { from = "moodmap.v1"; old = readKey(from); if (old && old.issues) old = migrate(old); }
      if (old && old.issues) old = migrate4(migrate3(old));
    }
    if (old && old.issues) {
      try { localStorage.setItem(from + ".bak", localStorage.getItem(from)); } catch (e) { /* 백업 실패는 무시 */ }
      db = old;
    } else db = seed();
  }
  db.settings = db.settings || { timelinePublic: false };
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { return false; }
  }
  save();

  /* ---------- 상태·지도 ---------- */
  var state = { cat: "all", emo: [], sort: "new", picking: false, draft: null, dSort: "new", dPlace: "", dEmo: "" };
  var map, layer, view = null;

  function initMap() {
    if (typeof L === "undefined") {
      $("#map").innerHTML = '<p class="empty">지도를 불러오지 못했습니다. 아래 목록으로 이용해 주세요.</p>';
      return;
    }
    map = L.map("map", { zoomControl: true }).setView(CENTER, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.on("zoomend", renderIssues);
  }

  /* ---------- 장소 묶음 ---------- */
  function countBy(items) {
    var c = {}; items.forEach(function (i) { c[i.emotion] = (c[i.emotion] || 0) + 1; }); return c;
  }
  function topEmotion(items) {
    var c = countBy(items), best = null, bc = 0;
    items.slice().sort(function (a, b) { return b.at - a.at; }).forEach(function (i) { if (c[i.emotion] > bc) { bc = c[i.emotion]; best = i.emotion; } });
    return best;
  }
  function groupIssues(list) {
    var gs = [], zoom = map ? map.getZoom() : 12;
    list.forEach(function (i) {
      var g = gs.find(function (x) {
        return map ? x.pt.distanceTo(map.project([i.lat, i.lng], zoom)) <= CLUSTER_PX : dist(x.lat, x.lng, i.lat, i.lng) <= 30;
      });
      if (!g) { g = { items: [] }; gs.push(g); }
      g.items.push(i);
      g.lat = g.items.reduce(function (s, x) { return s + x.lat; }, 0) / g.items.length;
      g.lng = g.items.reduce(function (s, x) { return s + x.lng; }, 0) / g.items.length;
      if (map) g.pt = map.project([g.lat, g.lng], zoom);
    });
    gs.forEach(function (g) {
      g.by = countBy(g.items); g.top = topEmotion(g.items);
      g.likes = g.items.reduce(function (s, x) { return s + x.likes.length; }, 0);
      g.latest = Math.max.apply(null, g.items.map(function (x) { return x.at; }));
      var names = {}; g.items.forEach(function (x) { if (x.place) names[x.place] = (names[x.place] || 0) + 1; });
      g.name = Object.keys(names).sort(function (a, b) { return names[b] - names[a]; })[0] || "선택한 위치";
      g.ids = g.items.map(function (x) { return x.id; });
    });
    return gs;
  }
  function ringStyle(by, total) {
    var acc = 0, parts = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).map(function (k) {
      var s = acc / total * 100; acc += by[k]; return emoOf(k).color + " " + s + "% " + acc / total * 100 + "%";
    });
    return "background:conic-gradient(" + parts.join(",") + ")";
  }
  function ringHtml(g, cls) {
    var n = g.items.length;
    return '<div class="emk ' + (cls || "") + '" style="' + ringStyle(g.by, n) + '"><div class="emi">' + emoOf(g.top).e + "</div>" + (n > 1 ? "<b>" + n + "</b>" : "") + "</div>";
  }
  function distBar(by, total) {
    var keys = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    return '<div class="dbar" role="img" aria-label="감정 분포">' + keys.map(function (k) {
      return '<i style="flex:' + by[k] + ";background:" + emoOf(k).color + '"></i>';
    }).join("") + '</div><div class="dleg">' + keys.map(function (k) {
      return "<span>" + emoOf(k).e + " " + emoOf(k).label + " <b>" + by[k] + "</b></span>";
    }).join("") + "</div>";
  }

  /* ---------- 목록·필터 ---------- */
  function filtered() {
    return visibleIssues().filter(function (i) {
      return (state.cat === "all" || i.category === state.cat) && (!state.emo.length || state.emo.indexOf(i.emotion) >= 0);
    });
  }
  function renderFilters() {
    var h = '<button class="chip" data-cat="all" aria-pressed="' + (state.cat === "all") + '">전체 유형</button>';
    Object.keys(CATS).forEach(function (k) {
      h += '<button class="chip" data-cat="' + k + '" aria-pressed="' + (state.cat === k) + '">' + CATS[k].label + "</button>";
    });
    $("#filters").innerHTML = h;
    var base = visibleIssues().filter(function (i) { return state.cat === "all" || i.category === state.cat; }), c = countBy(base);
    var e = '<button class="chip" data-emoall="1" aria-pressed="' + (!state.emo.length) + '">전체 감정</button>';
    Object.keys(EMO).forEach(function (k) {
      e += '<button class="chip emo" data-emo="' + k + '" aria-pressed="' + (state.emo.indexOf(k) >= 0) + '">' + EMO[k].e + " " + EMO[k].label + " <b>" + (c[k] || 0) + "</b></button>";
    });
    $("#emoFilters").innerHTML = e;
  }
  function renderIssues() {
    var a = filtered(), gs = groupIssues(a);
    gs.sort(function (x, y) { return state.sort === "likes" ? y.likes - x.likes || y.latest - x.latest : y.latest - x.latest; });
    $("#count").textContent = "(" + gs.length + "개 장소 · " + a.length + "건)";
    $("#empty").hidden = a.length > 0;
    $("#list").innerHTML = gs.map(function (g) {
      var latest = g.items.slice().sort(function (x, y) { return y.at - x.at; })[0];
      return '<li><button class="card place" data-place="' + g.ids.join(",") + '">' + ringHtml(g, "sm") +
        '<div class="pc"><strong>' + esc(g.name) + "</strong>" + (g.items.every(function (x) { return x.demo; }) ? ' <span class="badge demo">예시</span>' : "") +
        '<div class="ro">' + emoOf(g.top).label + " 중심 · 기록 " + g.items.length + "건 · 공감 " + g.likes + "</div>" +
        distBar(g.by, g.items.length) + "<p>" + esc(latest.description) + "</p></div></button></li>";
    }).join("");
    if (layer) {
      layer.clearLayers();
      gs.forEach(function (g) {
        var ic = L.divIcon({ className: "", iconSize: [46, 46], iconAnchor: [23, 23], html: ringHtml(g) });
        L.marker([g.lat, g.lng], { icon: ic, title: g.name + " · " + emoOf(g.top).label + " " + g.items.length + "건" })
          .on("click", function () { g.ids.length > 1 ? openPlace(g.ids) : openIssue(g.ids[0]); }).addTo(layer);
      });
    }
    $("#stats").innerHTML = "<li><b>" + visibleIssues().length + "</b>감정 기록</li><li><b>" +
      visibleIssues().reduce(function (s, i) { return s + i.likes.length; }, 0) + "</b>공감</li><li><b>" + db.proposals.length + "</b>제안서</li>";
  }
  function renderProposals() {
    var mine = db.proposals.filter(function (p) { return p.author === uid || p.demo; });
    $("#proposalList").innerHTML = mine.length ? mine.map(function (p) {
      return '<li><button class="card" data-prop="' + p.id + '"><strong>' + esc(p.title) + "</strong>" +
        (p.demo ? ' <span class="badge demo">시연용 예시</span>' : "") +
        "<p>" + emoOf(p.emotion).e + " " + esc(p.place) + '</p><div class="meta"><span class="badge soft">' + (p.demo ? STEPS[stepIndex(p)] : "작성 완료 · 기관 접수 전") + "</span><span>" + fmt(p.createdAt) + "</span></div></button></li>";
    }).join("") : '<li class="empty">아직 작성한 제안서가 없습니다. 기록 상세에서 ‘제안 만들기’를 눌러 보세요.</li>';
  }
  function renderAll() { renderFilters(); renderIssues(); renderProposals(); renderDrawer(); }
  function catBadge(cat, other) { return '<span class="badge" style="background:' + (CATS[cat] || CATS.other).color + '">' + esc(catLabel(cat, other)) + "</span>"; }
  function emoBadge(k) { var m = emoOf(k); return '<span class="badge emob" style="background:' + m.color + '">' + m.e + " " + m.label + "</span>"; }

  /* ---------- 모달 ---------- */
  function openModal(html) { $("#modalBody").innerHTML = html; $("#modal").hidden = false; document.body.style.overflow = "hidden"; $(".sheet").scrollTop = 0; }
  function closeModal() { $("#modal").hidden = true; document.body.style.overflow = ""; $("#modalBody").innerHTML = ""; view = null; }

  /* ---------- 위치 선택 ---------- */
  function setPicking(on) {
    state.picking = on;
    $("#crosshair").hidden = !on; $("#pickbar").hidden = !on;
    $("#startPick").hidden = on;
  }
  function confirmPick() {
    var c = map.getCenter();
    state.draft = { lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6), place: "", category: "", emotion: "", discomfort: "", description: "", situation: "", photos: [], categoryOther: "", visibility: "private" };
    setPicking(false);
    openForm();
  }

  /* ---------- 감정 기록 등록 ---------- */
  function catSeg(cur) {
    return '<div class="seg">' + Object.keys(CATS).map(function (k) {
      return '<label><input type="radio" name="category" value="' + k + '"' + (cur === k ? " checked" : "") + "><span>" + CATS[k].label + "</span></label>";
    }).join("") + "</div>";
  }
  function emoGrid(cur) {
    return '<div class="emogrid">' + Object.keys(EMO).map(function (k) {
      return '<label><input type="radio" name="emotion" value="' + k + '"' + (cur === k ? " checked" : "") + '><span><i>' + EMO[k].e + "</i>" + EMO[k].label + "</span></label>";
    }).join("") + "</div>";
  }
  function lvSeg(cur) {
    return '<div class="seg lv">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) {
      return '<label><input type="radio" name="discomfort" value="' + n + '"' + (String(cur) === String(n) ? " checked" : "") + '><span class="lvc' + (n > 5 ? " pos" : "") + '"><b>' + n + "</b><small>" + LV[n] + "</small></span></label>";
    }).join("") + "</div>";
  }
  function photoPreview() {
    var d = state.draft, box = $("#photoPrev"); if (!box) return;
    box.innerHTML = d.photos.map(function (src, n) {
      return '<div class="pthumb"><img alt="선택한 사진 ' + (n + 1) + '" src="' + src + '"><button type="button" class="px" data-rmphoto="' + n + '" aria-label="사진 ' + (n + 1) + ' 삭제">✕</button></div>';
    }).join("");
    $("#photoCnt").textContent = d.photos.length + " / " + MAX_PHOTOS;
    $("#photoAdd").hidden = d.photos.length >= MAX_PHOTOS;
  }
  function openForm() {
    var d = state.draft;
    openModal('<h3>이 장소에서 느낀 감정 기록하기</h3><form class="form" id="issueForm" novalidate>' +
      '<p class="ro">📍 선택 위치 ' + d.lat + ", " + d.lng + "</p>" +
      '<div><strong>지금 감정은 어떤가요?</strong>' + emoGrid(d.emotion) + '<small class="err" data-for="emotion"></small></div>' +
      '<label>장소 이름 (선택)<input type="text" name="place" maxlength="100" value="' + esc(d.place) + '" placeholder="예: 정류장에서 골목 입구까지"></label>' +
      '<div><strong>문제 유형</strong>' + catSeg(d.category) + '<small class="err" data-for="category"></small></div>' +
      '<label id="otherWrap"' + (d.category === "other" ? "" : " hidden") + '>기타 유형 직접 입력<input type="text" name="categoryOther" maxlength="20" value="' + esc(d.categoryOther) + '" placeholder="예: 공사 먼지, 반려동물 배변"><small class="err" data-for="categoryOther"></small></label>' +
      '<div id="similar"></div>' +
      '<label>그 감정을 느낀 이유<textarea name="description" rows="3" maxlength="500" placeholder="예: 정류장에서 골목으로 들어서는 구간에 조명이 없어요">' + esc(d.description) + '</textarea><small class="err" data-for="description"></small></label>' +
      '<label>구체적인 상황 (선택)<input type="text" name="situation" maxlength="100" value="' + esc(d.situation) + '" placeholder="예: 밤 10시 이후 혼자 귀가할 때"></label>' +
      '<div><strong>불편·만족 정도 (선택)</strong>' + lvSeg(d.discomfort) + "</div>" +
      '<div><strong>사진 (선택, 최대 ' + MAX_PHOTOS + '장)</strong> <small id="photoCnt" class="ro"></small>' +
      '<div class="pgrid" id="photoPrev"></div>' +
      '<label class="btn sm ghost fileadd" id="photoAdd">＋ 사진 추가<input type="file" id="photoInput" accept="image/*" multiple hidden></label>' +
      '<p class="ro">사진은 자동으로 줄여 저장되며 위치 정보(EXIF)는 제거됩니다. 얼굴·차량번호가 드러나지 않았는지 확인해 주세요.</p></div>' +
      '<div><strong>공개 범위</strong><div class="seg"><label><input type="radio" name="visibility" value="private"' + (d.visibility === "private" ? " checked" : "") + "><span>🔒 나만 보기</span></label>" +
      '<label><input type="radio" name="visibility" value="public"' + (d.visibility === "public" ? " checked" : "") + "><span>🌐 공개</span></label></div>" +
      '<p class="ro">‘나만 보기’ 기록은 공개 지도·공유 링크·제안서 집계에 나타나지 않습니다. 공개 기록도 ‘내 서랍장’에서 타임라인 공개를 켜야 공유됩니다.</p></div>' +
      '<button class="btn primary block" type="submit">감정 기록 등록</button><p class="formmsg" id="issueMsg"></p></form>');
    photoPreview();
    updateSimilar();
  }
  function readDraft(f) {
    var d = state.draft, v = function (n) { var e = f.elements[n]; return e && e.value != null ? e.value : ""; };
    d.place = v("place").trim(); d.category = (f.querySelector("input[name=category]:checked") || {}).value || "";
    d.emotion = (f.querySelector("input[name=emotion]:checked") || {}).value || "";
    d.discomfort = (f.querySelector("input[name=discomfort]:checked") || {}).value || "";
    d.visibility = (f.querySelector("input[name=visibility]:checked") || {}).value || "private";
    d.categoryOther = v("categoryOther").trim();
    d.description = v("description").trim(); d.situation = v("situation").trim();
  }
  function updateSimilar() {
    var f = $("#issueForm"); if (!f) return; readDraft(f);
    var d = state.draft, box = $("#similar");
    $("#otherWrap").hidden = d.category !== "other";
    if (!d.category) { box.innerHTML = ""; return; }
    var near = visibleIssues().filter(function (i) { return i.category === d.category && dist(i.lat, i.lng, d.lat, d.lng) <= SIMILAR_M; });
    box.innerHTML = near.length ? '<div class="similar"><strong>100m 안에 같은 유형의 기록이 있어요</strong> 같은 문제라면 기존 글에 참여해 주세요.' +
      near.map(function (i) { return '<button type="button" data-goissue="' + i.id + '">' + emoOf(i.emotion).e + " " + esc(i.description.slice(0, 44)) + "… (공감 " + i.likes.length + ")</button>"; }).join("") +
      '<p class="ro" style="margin:8px 0 0">다른 문제라면 아래에서 계속 작성하세요.</p></div>' : "";
  }
  function resizePhoto(file) {
    return new Promise(function (res, rej) {
      if (file.size > 15 * 1024 * 1024) return rej(new Error("big"));
      var r = new FileReader();
      r.onerror = rej;
      r.onload = function () {
        var img = new Image();
        img.onerror = rej;
        img.onload = function () {
          var s = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement("canvas");
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", 0.6)); // 재인코딩으로 EXIF(위치 정보) 제거
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }
  function addPhotos(files) {
    var d = state.draft; if (!d) return;
    var list = Array.prototype.slice.call(files), room = MAX_PHOTOS - d.photos.length;
    if (list.length > room) toast("사진은 최대 " + MAX_PHOTOS + "장까지 첨부할 수 있어요. " + (room > 0 ? "앞의 " + room + "장만 추가합니다." : "추가하려면 기존 사진을 삭제해 주세요."));
    list = list.slice(0, Math.max(0, room));
    var bad = 0;
    list.reduce(function (p, f) {
      return p.then(function () {
        return resizePhoto(f).then(function (src) { if (d.photos.length < MAX_PHOTOS) d.photos.push(src); }, function () { bad++; });
      });
    }, Promise.resolve()).then(function () {
      photoPreview();
      if (bad) toast("사진 " + bad + "장은 불러오지 못했거나 너무 커서 제외했어요. (이미지 파일, 15MB 이하)");
    });
  }
  function submitIssue(f) {
    readDraft(f);
    var n = cleanFields(f, ["place", "categoryOther", "description", "situation"]);
    if (n) readDraft(f);
    var d = state.draft, ok = true;
    var errs = { category: "문제 유형을 선택해 주세요.", emotion: "감정을 선택해 주세요.", description: d.description.length < 5 ? "이유를 5자 이상 적어 주세요." : "", categoryOther: d.category === "other" && !d.categoryOther ? "기타 유형을 직접 입력해 주세요." : "" };
    f.querySelectorAll(".err").forEach(function (e) {
      var k = e.getAttribute("data-for"), bad = (k === "description" || k === "categoryOther") ? errs[k] : !d[k] ? errs[k] : "";
      e.textContent = bad || ""; if (bad) ok = false;
    });
    if (!ok) { var first = f.querySelector(".err:not(:empty)"); if (first) first.scrollIntoView({ block: "center" }); return; }
    var issue = { id: newId(), author: uid, category: d.category, categoryOther: d.category === "other" ? d.categoryOther : "", emotion: d.emotion, discomfort: d.discomfort ? +d.discomfort : null,
      place: d.place, lat: d.lat, lng: d.lng, description: d.description, situation: d.situation, photos: d.photos.slice(), visibility: d.visibility, likes: [], at: Date.now() };
    db.issues.push(issue);
    if (!save()) {
      db.issues.pop();
      $("#issueMsg").style.color = "#b91c1c";
      $("#issueMsg").textContent = "저장 공간이 부족합니다. 사진을 줄이거나 삭제한 뒤 다시 시도해 주세요. (입력 내용은 유지됩니다)";
      return;
    }
    state.draft = null; state.emo = []; renderAll(); openIssue(issue.id); toast("감정 기록이 등록되었습니다.");
    if (map) map.setView([issue.lat, issue.lng], Math.max(map.getZoom(), 15));
  }

  /* ---------- 장소·기록 상세 ---------- */
  function commentsHtml(id) {
    var cs = db.comments.filter(function (c) { return c.issueId === id; }).sort(function (a, b) { return a.at - b.at; });
    return cs.map(function (c) { return '<div class="comment"><span class="badge soft">' + (c.kind === "suggestion" ? "개선 의견" : "추가 경험") + "</span> " + esc(c.body) + "<br><small>" + fmt(c.at) + "</small></div>"; }).join("");
  }
  function visBadge(i) {
    return i.visibility === "private" ? '<span class="badge soft">🔒 나만 보기</span>' : '<span class="badge soft">🌐 공개</span>';
  }
  function openPlace(ids) {
    var items = ids.map(function (id) { return db.issues.find(function (x) { return x.id === id; }); }).filter(function (i) { return i && (i.author === uid || isPublic(i)); }).sort(function (a, b) { return b.at - a.at; });
    if (!items.length) return;
    var g = { items: items, by: countBy(items), top: topEmotion(items) };
    var names = items.map(function (x) { return x.place; }).filter(Boolean);
    openModal('<div class="phead">' + ringHtml(g) + '<div><h3 style="margin:0">' + esc(names[0] || "선택한 위치") + '</h3><p class="ro" style="margin:2px 0 0">이 장소의 감정 기록 ' + items.length + "건</p></div></div>" +
      distBar(g.by, items.length) +
      '<h3 style="font-size:16px;margin:18px 0 0">기록과 이유</h3>' +
      items.map(function (i) {
        var liked = i.likes.indexOf(uid) >= 0;
        return '<article class="rec">' + emoBadge(i.emotion) + " " + catBadge(i.category, i.categoryOther) + " " + lvBadge(i.discomfort) + (i.demo ? ' <span class="badge demo">예시</span>' : "") +
          '<p class="why"><strong>이유</strong> ' + esc(i.description) + "</p>" +
          (i.situation ? '<p class="why"><strong>상황</strong> ' + esc(i.situation) + "</p>" : "") +
          '<p class="ro">' + fmt(i.at) + "</p>" +
          photoGrid(photosOf(i)) + commentsHtml(i.id) +
          '<div class="row"><button class="btn sm ' + (liked ? "primary" : "ghost") + '" data-like="' + i.id + '" data-back="' + ids.join(",") + '" aria-pressed="' + liked + '">🤝 저도 겪었어요 · ' + i.likes.length + '</button><button class="btn sm ghost" data-goissue="' + i.id + '">의견 남기기·제안 만들기</button></div></article>';
      }).join(""));
  }
  function openIssue(id) {
    var i = db.issues.find(function (x) { return x.id === id; }); if (!i) return;
    var m = emoOf(i.emotion), liked = i.likes.indexOf(uid) >= 0, own = i.author === uid;
    var n = db.comments.filter(function (c) { return c.issueId === id; }).length;
    openModal(emoBadge(i.emotion) + " " + catBadge(i.category, i.categoryOther) + " " + lvBadge(i.discomfort) + (i.demo ? ' <span class="badge demo">예시</span>' : "") + (own ? " " + visBadge(i) : "") +
      '<div class="bigemo">' + m.e + "</div><h3>" + esc(i.place || "선택한 위치") + "</h3>" +
      '<p class="ro">📍 ' + m.label + " · " + fmt(i.at) + " · " + esc(catLabel(i.category, i.categoryOther)) + (i.discomfort ? " · " + LV[i.discomfort] : "") + "</p>" +
      '<div class="quote"><strong>이유</strong><br>' + esc(i.description) + "</div>" +
      (i.situation ? '<div class="quote"><strong>구체적인 상황</strong><br>' + esc(i.situation) + "</div>" : "") +
      photoGrid(photosOf(i)) +
      '<div class="row"><button class="btn ' + (liked ? "primary" : "ghost") + '" data-like="' + id + '" aria-pressed="' + liked + '">🤝 저도 겪었어요 · ' + i.likes.length + "</button>" +
      (m.pos ? "" : '<button class="btn primary" data-propose="' + id + '">제안 만들기</button>') +
      (own ? '<button class="btn danger sm" data-del="' + id + '">삭제</button>' : "") + "</div>" +
      (own ? '<div class="quote"><strong>공개 범위</strong> ' + visBadge(i) + '<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-vis="' + id + '">' + (i.visibility === "private" ? "🌐 공개로 바꾸기" : "🔒 나만 보기로 바꾸기") + "</button>" +
        (isPublic(i) ? '<button class="btn sm ghost" data-sharerec="' + id + '">🔗 기록 공유 링크</button>' : "") + "</div>" +
        '<p class="ro">' + (i.visibility === "private" ? "지도·공유 링크에 나타나지 않습니다." : db.settings.timelinePublic ? "공개 중입니다. 나만 보기로 바꾸면 앱 안에서 즉시 숨겨지지만, 이미 복사된 공유 링크는 회수할 수 없습니다(서버 기능 필요)." : "‘내 서랍장’에서 타임라인 공개를 켜기 전까지는 공유되지 않습니다.") + "</p></div>" : "") +
      (m.pos ? '<p class="ro">긍정 감정 기록은 지도에서 ‘좋은 장소’로 확인할 수 있어요. 제안서는 불편·부정 감정 기록에서 만들 수 있습니다.</p>' : "") +
      '<h3 style="margin:22px 0 4px;font-size:16px">다른 사람의 추가 의견 (' + n + ")</h3>" +
      (commentsHtml(id) || '<p class="ro">아직 의견이 없습니다.</p>') +
      '<form class="form" id="commentForm" data-issue="' + id + '" style="margin-top:12px">' +
      '<div class="seg"><label><input type="radio" name="kind" value="experience" checked><span>추가 경험</span></label><label><input type="radio" name="kind" value="suggestion"><span>개선 의견</span></label></div>' +
      '<textarea name="body" rows="3" maxlength="300" placeholder="예: 큰길 쪽은 밝지만 골목 첫 모퉁이부터 어두워요"></textarea>' +
      '<small class="err" id="cErr"></small><button class="btn primary" type="submit">의견 남기기</button></form>');
    if (map) map.panTo([i.lat, i.lng]);
  }

  /* ---------- 내 서랍장(개인 타임라인) ---------- */
  function placeGroups(items) {
    var gs = [];
    items.slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (i) {
      var g = gs.find(function (x) { return dist(x.items[0].lat, x.items[0].lng, i.lat, i.lng) <= PLACE_M; });
      if (!g) { g = { key: i.id, items: [] }; gs.push(g); }
      g.items.push(i);
    });
    gs.forEach(function (g) {
      var nm = g.items.map(function (x) { return x.place; }).filter(Boolean);
      g.name = nm[nm.length - 1] || "이름 없는 장소";
    });
    return gs;
  }
  function dayKey(t) { return fmt(t); }
  function trendHtml(items) {
    var flow = items.map(function (i) { return "<span>" + fmt(i.at).slice(5) + " " + emoOf(i.emotion).e + "</span>"; }).join('<em>→</em>');
    var pts = items.filter(function (i) { return i.discomfort; }), svg = "";
    if (pts.length >= 2) {
      var W = 300, H = 90, px = 24, step = (W - px * 2) / (pts.length - 1);
      var xy = pts.map(function (i, n) { return [px + n * step, 14 + (10 - i.discomfort) * (H - 28) / 9]; });
      svg = '<svg class="trend" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="불편·만족 정도 변화"><text x="2" y="12" class="tl">만족</text><text x="2" y="' + (H - 4) + '" class="tl">불편</text>' +
        '<polyline fill="none" stroke="#2563eb" stroke-width="2" points="' + xy.map(function (p) { return p.join(","); }).join(" ") + '"/>' +
        xy.map(function (p, n) { return '<text x="' + p[0] + '" y="' + (p[1] + 5) + '" text-anchor="middle" font-size="16">' + emoOf(pts[n].emotion).e + "</text>"; }).join("") + "</svg>" +
        '<p class="ro">위로 갈수록 만족, 아래로 갈수록 불편. 정도를 선택한 기록만 표시합니다.</p>';
    }
    return '<div class="flow">' + flow + "</div>" + svg;
  }
  function renderDrawer() {
    var box = $("#drawerBody"); if (!box) return;
    var all = mine(), gs = placeGroups(all), pub = !!db.settings.timelinePublic;
    var by = countBy(all);
    var h = '<div class="drawer-top"><label class="switch"><input type="checkbox" id="tlPublic"' + (pub ? " checked" : "") + "><span>내 타임라인 공개</span></label>" +
      '<p class="ro">' + (pub ? "공개로 설정한 기록만 공유됩니다. 나만 보기 기록은 절대 포함되지 않습니다." : "현재 전체 비공개입니다. 기록별 설정과 관계없이 공유 링크가 만들어지지 않습니다.") + "</p>" +
      (pub ? '<button class="btn sm ghost" id="shareProfile">🔗 공개 프로필 링크 복사</button>' : "") +
      '<p class="ro">이 브라우저(기기) 안에서만 저장·적용됩니다. 로그인·서버가 없어 다른 사용자가 내 프로필을 검색하거나, 이미 복사된 링크를 회수·차단하는 기능은 아직 없습니다.</p></div>';
    if (!all.length) { $("#drawerBody").innerHTML = h + '<div class="empty"><p>아직 내 감정 기록이 없어요. 지도에서 첫 기록을 남겨 보세요.</p><a class="btn primary" href="#app">지도에서 기록하기</a></div>'; return; }
    h += '<div class="dsum"><b>' + all.length + "건</b> " + Object.keys(by).map(function (k) { return emoOf(k).e + " " + by[k]; }).join(" · ") + "</div>";
    h += '<div class="dfilters"><select id="dPlace" aria-label="장소 필터"><option value="">모든 장소</option>' + gs.map(function (g) { return '<option value="' + g.key + '"' + (state.dPlace === g.key ? " selected" : "") + ">" + esc(g.name) + " (" + g.items.length + ")</option>"; }).join("") + "</select>" +
      '<select id="dEmo" aria-label="감정 필터"><option value="">모든 감정</option>' + Object.keys(EMO).map(function (k) { return '<option value="' + k + '"' + (state.dEmo === k ? " selected" : "") + ">" + EMO[k].e + " " + EMO[k].label + "</option>"; }).join("") + "</select>" +
      '<select id="dSort" aria-label="정렬"><option value="new"' + (state.dSort === "new" ? " selected" : "") + '>최신순</option><option value="old"' + (state.dSort === "old" ? " selected" : "") + ">오래된 순</option></select></div>";
    var grp = state.dPlace ? gs.find(function (g) { return g.key === state.dPlace; }) : null;
    var list = all.filter(function (i) { return (!grp || grp.items.indexOf(i) >= 0) && (!state.dEmo || i.emotion === state.dEmo); });
    list.sort(function (a, b) { return state.dSort === "old" ? a.at - b.at : b.at - a.at; });
    var days = [], seen = {};
    list.forEach(function (i) { var k = dayKey(i.at); if (!seen[k]) { seen[k] = []; days.push(k); } seen[k].push(i); });
    h += days.length ? days.map(function (k) {
      return '<details class="dday" open><summary>' + k + " <small>" + seen[k].length + "건</small></summary>" + seen[k].map(function (i) {
        var ph = photosOf(i), nc = db.comments.filter(function (c) { return c.issueId === i.id; }).length;
        return '<button class="drec" data-goissue="' + i.id + '"><span class="de">' + emoOf(i.emotion).e + '</span><span class="dc"><strong>' + esc(i.place || "이름 없는 장소") + "</strong> " + visBadge(i) +
          '<br><small>' + emoOf(i.emotion).label + " · " + esc(catLabel(i.category, i.categoryOther)) + (i.discomfort ? " · " + LV[i.discomfort] : "") + "</small>" +
          "<p>" + esc(i.description) + "</p>" +
          (ph.length ? '<span class="dph">' + ph.slice(0, 5).map(function (s) { return '<img alt="" src="' + s + '">'; }).join("") + "</span>" : "") +
          (nc ? "<small>💬 이웃 의견 " + nc + "건</small>" : "") + "</span></button>";
      }).join("") + "</details>";
    }).join("") : '<div class="empty"><p>이 조건에 맞는 기록이 없습니다.</p></div>';
    var multi = gs.filter(function (g) { return g.items.length >= 2; });
    h += '<h3 class="h4" style="margin-top:22px">장소별 감정 변화</h3>' + (multi.length ? multi.map(function (g) {
      return '<div class="trendcard"><strong>' + esc(g.name) + "</strong> <small>" + g.items.length + "번 기록</small>" + trendHtml(g.items) + "</div>";
    }).join("") : '<p class="ro">같은 장소(50m 이내)를 두 번 이상 기록하면 감정 변화가 표시됩니다. 기록된 데이터만 사용합니다.</p>');
    box.innerHTML = h;
  }
  function recSnap(i) {
    return { id: i.id, emotion: i.emotion, category: i.category, categoryOther: i.categoryOther || "", discomfort: i.discomfort || null,
      place: i.place || "", lat: +i.lat.toFixed(3), lng: +i.lng.toFixed(3), description: i.description, situation: i.situation || "", at: i.at };
  }
  function viewShared(recs, title) {
    openModal("<h3>" + esc(title) + '</h3><p class="ro">읽기 전용 · 공개된 기록만 포함 · 사진 제외 · 위치는 약 100m 단위로 표시됩니다.</p>' +
      recs.map(function (i) {
        return '<article class="rec">' + emoBadge(i.emotion) + " " + catBadge(i.category, i.categoryOther) + " " + lvBadge(i.discomfort) +
          "<h3 style=\"margin:8px 0 0;font-size:16px\">" + esc(i.place || "이름 없는 장소") + '</h3><p class="why">' + esc(i.description) + "</p>" +
          (i.situation ? '<p class="why"><strong>상황</strong> ' + esc(i.situation) + "</p>" : "") + '<p class="ro">' + fmt(i.at) + "</p></article>";
      }).join(""));
  }
  function toggleLike(id, back) {
    var i = db.issues.find(function (x) { return x.id === id; }), k = i.likes.indexOf(uid);
    if (k >= 0) i.likes.splice(k, 1); else i.likes.push(uid);
    save(); renderAll();
    if (back) openPlace(back.split(",")); else openIssue(id);
  }

  /* ---------- 제안서 작성·수정 ---------- */
  function statsFor(i) {
    var near = db.issues.filter(function (x) { return x.id === i.id || (isPublic(x) && dist(x.lat, x.lng, i.lat, i.lng) <= PLACE_M); });
    var lv = {}; near.forEach(function (x) { if (x.discomfort) lv[x.discomfort] = (lv[x.discomfort] || 0) + 1; });
    return {
      levels: lv, total: near.length, same: near.filter(function (x) { return x.emotion === i.emotion; }).length, byEmotion: countBy(near),
      reasons: near.slice().sort(function (a, b) { return b.at - a.at; }).slice(0, 8).map(function (x) { return { emotion: x.emotion, reason: x.description, situation: x.situation || "", at: x.at }; })
    };
  }
  function openPropose(id, propId) {
    var i = db.issues.find(function (x) { return x.id === id; });
    var ex = propId ? db.proposals.find(function (x) { return x.id === propId; }) : null;
    var cs = db.comments.filter(function (c) { return c.issueId === id; });
    var place = i.place || "선택한 위치", m = emoOf(i.emotion);
    var dflt = i.category === "safety_light" ? place + "의 야간 조도를 확인하고 조명 보강을 검토해 주세요." : place + " 구간의 현장 확인과 개선을 검토해 주세요.";
    openModal("<h3>" + (ex ? "제안서 수정" : "개선 제안서 작성") + '</h3><p class="ro">' + m.e + " " + m.label + " · " + esc(place) + " · 공감 " + i.likes.length + '건 (0건이어도 작성할 수 있어요). 저장 시점의 공감 수·감정 분포·선택한 의견이 고정됩니다.</p>' +
      '<form class="form" id="propForm" data-issue="' + id + '"' + (ex ? ' data-prop="' + ex.id + '"' : "") + " novalidate>" +
      '<label>제목<input type="text" name="title" maxlength="80" value="' + esc(ex ? ex.title : place + " " + catLabel(i.category, i.categoryOther) + " 개선 요청") + '"><small class="err" data-for="title"></small></label>' +
      '<label>개선이 필요한 사항<textarea name="improvements" rows="3" maxlength="500" placeholder="무엇이 문제인가요?">' + esc(ex ? ex.improvements : "") + '</textarea></label>' +
      '<label>원하는 개선 방향<textarea name="direction" rows="3" maxlength="500" placeholder="어떻게 바뀌면 좋을까요?">' + esc(ex ? ex.direction : dflt) + '</textarea><small class="err" data-for="direction"></small></label>' +
      '<label>우선 점검 사항 (한 줄에 하나, 선택)<textarea name="checks" rows="3" maxlength="500" placeholder="담당자가 가장 먼저 확인할 사항">' + esc(ex ? ex.checks.join("\n") : "") + '</textarea></label>' +
      '<button type="button" class="btn sm ghost" data-fillchecks="' + i.category + '">예시 점검 항목 불러오기</button>' +
      (ex ? '<p class="ro">이미 고정된 의견·분포는 수정되지 않습니다.</p>' : "<div><strong>제안서에 포함할 다른 사람의 의견</strong>" +
        (cs.map(function (c) { return '<label class="pickcomment"><input type="checkbox" name="cm" value="' + c.id + '"' + (c.kind === "suggestion" ? " checked" : "") + "><span>" + esc(c.body) + "</span></label>"; }).join("") || '<p class="ro">선택할 의견이 없습니다.</p>') + "</div>") +
      '<button class="btn primary block" type="submit">' + (ex ? "수정 저장" : "제안서 저장") + "</button></form>");
  }
  function submitProposal(f) {
    var i = db.issues.find(function (x) { return x.id === f.dataset.issue; });
    cleanFields(f, ["title", "improvements", "direction", "checks"]);
    var title = f.elements.title.value.trim(), dir = f.elements.direction.value.trim(), ok = true;
    f.querySelector("[data-for=title]").textContent = title.length < 2 ? (ok = false, "제목을 입력해 주세요.") : "";
    f.querySelector("[data-for=direction]").textContent = dir.length < 5 ? (ok = false, "개선 방향을 5자 이상 적어 주세요.") : "";
    if (!ok) return;
    var impr = f.elements.improvements.value.trim();
    var checks = f.elements.checks.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 8);
    if (f.dataset.prop) {
      var p = db.proposals.find(function (x) { return x.id === f.dataset.prop; });
      if (!p || p.author !== uid) return;
      p.title = title; p.improvements = impr; p.direction = dir; p.request = dir; p.checks = checks;
      p.log.push({ status: "edited", actor: "author", note: "작성자 수정", at: Date.now() });
      save(); renderAll(); openProposal(p.id); toast("제안서를 수정했습니다."); return;
    }
    var picked = Array.prototype.map.call(f.querySelectorAll("input[name=cm]:checked"), function (e) { return e.value; });
    var np = normalizeProposal({
      id: newId(), author: uid, issueId: i.id, title: title, improvements: impr, direction: dir, request: dir, checks: checks,
      place: i.place || "선택한 위치", lat: i.lat, lng: i.lng, category: i.category, categoryOther: i.categoryOther || "", level: i.discomfort || null, emotion: i.emotion, description: i.description, situation: i.situation || "",
      reactions: i.likes.length, stats: statsFor(i),
      comments: db.comments.filter(function (c) { return picked.indexOf(c.id) >= 0; }).map(function (c) { return { kind: c.kind, body: c.body, at: c.at }; }),
      status: "written", createdAt: Date.now(), log: [{ status: "written", actor: "author", note: "작성 완료", at: Date.now() }]
    });
    db.proposals.push(np); save(); renderAll(); openProposal(np.id); toast("제안서가 저장되었습니다.");
  }
  function shareLink(p) {
    var snap = Object.assign({}, p); delete snap.author;
    return location.origin + location.pathname + "#p=" + b64enc(snap);
  }
  function proposalText(p) {
    var m = emoOf(p.emotion), L2 = [];
    L2.push("[" + p.title + "]", "", "■ 장소: " + p.place + " (" + p.lat + ", " + p.lng + ")", "■ 감정: " + m.e + " " + m.label,
      "■ 문제 유형: " + catLabel(p.category, p.categoryOther) + (p.level ? " · 정도: " + LV[p.level] : ""),
      "■ 이유: " + p.description + (p.situation ? " (상황: " + p.situation + ")" : ""),
      "■ 같은 장소 기록 " + p.stats.total + "건 · 같은 감정 " + p.stats.same + "건 · 공감 " + p.reactions + "건");
    if (p.comments.length) L2.push("■ 다른 사람의 경험·의견:"), p.comments.forEach(function (c) { L2.push(" - " + c.body); });
    if (p.improvements) L2.push("■ 개선이 필요한 사항: " + p.improvements);
    L2.push("■ 원하는 개선 방향: " + p.direction);
    if (p.checks.length) L2.push("■ 우선 점검 사항:"), p.checks.forEach(function (c) { L2.push(" - " + c); });
    var ph = view && view.p === p && !view.ro ? photosOfIssue(p) : [];
    if (ph.length) L2.push("■ 첨부 사진: " + ph.length + "장 (무드맵 화면에서 확인)");
    L2.push("", "※ 무드맵 시민 제안서 (작성 완료 · 기관 접수 전)");
    return L2.join("\n");
  }
  function photosOfIssue(p) {
    var i = db.issues.find(function (x) { return x.id === p.issueId; });
    return i ? photosOf(i) : [];
  }
  function levelLine(st) {
    var k = Object.keys(st.levels || {}).sort(function (a, b) { return a - b; });
    return k.length ? k.map(function (n) { return LV[n] + " " + st.levels[n] + "건"; }).join(" · ") : "";
  }
  function stepIndex(p) {
    if (!p.demo) return 0;
    return Math.max.apply(null, [0].concat(p.log.map(function (l) { return STEP_IDX[l.status] || 0; })));
  }
  function stepper(p) {
    var idx = stepIndex(p);
    return '<ol class="stepper">' + STEPS.map(function (s, n) {
      return '<li class="' + (n < idx ? "done" : n === idx ? "cur" : "") + '"><i>' + (n < idx ? "✓" : n + 1) + "</i><span>" + s + "</span>" + (n > idx ? "<small>미진행</small>" : "") + "</li>";
    }).join("") + "</ol>";
  }
  function viewProposal(p, owner, readonlyLink, tab) {
    normalizeProposal(p);
    view = { p: p, owner: owner, ro: readonlyLink };
    tab = tab || "author";
    var m = emoOf(p.emotion), last = p.log[p.log.length - 1], st = p.stats;
    var head = '<span class="badge soft">' + (p.demo ? STEPS[stepIndex(p)] : "작성 완료 · 기관 접수 전") + "</span>" + (p.demo ? ' <span class="badge demo">시연용 예시</span>' : "") +
      '<h3 style="margin-top:8px">' + esc(p.title) + "</h3>" +
      '<p class="ro">' + m.e + " " + esc(p.place) + " · " + catBadge(p.category) + "</p>" +
      '<div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="' + (tab === "author") + '" data-ptab="author">제안자 관점</button><button class="tab" role="tab" aria-selected="' + (tab === "staff") + '" data-ptab="staff">담당자 관점</button></div>';
    var body;
    if (tab === "author") {
      body = '<div class="quote"><strong>' + m.e + " " + m.label + "</strong>" + (p.level ? " · " + LV[p.level] : "") + " — " + esc(p.description) + (p.situation ? '<br><small class="ro">상황: ' + esc(p.situation) + "</small>" : "") + "</div>" +
        (owner && photosOfIssue(p).length ? '<h3 class="h4">첨부 사진</h3>' + photoGrid(photosOfIssue(p)) : "") +
        (p.comments.length ? "<h3 class=\"h4\">다른 사람의 경험·의견</h3>" + p.comments.map(function (c) { return '<div class="comment"><span class="badge soft">' + (c.kind === "suggestion" ? "개선 의견" : "추가 경험") + "</span> " + esc(c.body) + "</div>"; }).join("") : "") +
        (p.improvements ? '<h3 class="h4">개선이 필요한 사항</h3><div class="quote">' + esc(p.improvements) + "</div>" : "") +
        '<h3 class="h4">제안자가 원하는 개선 방향</h3><div class="quote">' + esc(p.direction) + "</div>";
    } else {
      var checks = p.checks.length ? p.checks : DEFAULT_CHECKS[p.category] || [];
      var osm = "https://www.openstreetmap.org/?mlat=" + p.lat + "&mlon=" + p.lng + "#map=18/" + p.lat + "/" + p.lng;
      body = '<h3 class="h4">① 어디에서 문제가 발생했나요?</h3><div class="quote">' + esc(p.place) + " · " + esc(catLabel(p.category, p.categoryOther)) + (p.level ? " · " + LV[p.level] : "") + '<br><small class="ro">' + p.lat + ", " + p.lng + '</small> <a class="lnk" href="' + osm + '" target="_blank" rel="noopener">지도에서 위치 보기 ↗</a></div>' +
        '<h3 class="h4">② 시민들은 어떤 감정을 느끼나요? <span class="badge soft">시스템 집계</span></h3>' + distBar(st.byEmotion, Math.max(1, Object.keys(st.byEmotion).reduce(function (s, k) { return s + st.byEmotion[k]; }, 0))) +
        '<h3 class="h4">③ 같은 감정을 느낀 사람은 얼마나 있나요? <span class="badge soft">시스템 집계</span></h3><div class="quote">이 장소 기록 <b>' + st.total + "건</b> · 같은 감정(" + m.e + " " + m.label + ") <b>" + st.same + "건</b> · 공감 <b>" + p.reactions + "건</b> <small class=\"ro\">(작성 시점 기준 · 공개 기록만 집계)</small>" + (levelLine(st) ? "<br>정도: " + levelLine(st) : "") + "</div>" +
        '<h3 class="h4">④ 구체적인 이유는 무엇인가요? <span class="badge soft">시민 작성</span></h3>' + st.reasons.map(function (r) { return '<div class="comment">' + emoOf(r.emotion).e + " " + esc(r.reason) + (r.situation ? "<br><small>상황: " + esc(r.situation) + "</small>" : "") + "</div>"; }).join("") +
        '<h3 class="h4">⑤ 어떤 개선이 필요한가요? <span class="badge soft">시민 작성</span></h3><div class="quote">' + (p.improvements ? esc(p.improvements) + "<br>" : "") + "<strong>요청:</strong> " + esc(p.direction) + "</div>" +
        '<h3 class="h4">⑥ 가장 먼저 확인·점검할 사항</h3><ul class="checks">' + checks.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>" +
        (owner && photosOfIssue(p).length ? '<h3 class="h4">첨부 사진 <span class="badge soft">시민 첨부</span></h3>' + photoGrid(photosOfIssue(p)) : readonlyLink ? '<p class="ro">사진은 공유 링크에 포함되지 않습니다.</p>' : "") +
        (p.checks.length ? "" : '<p class="ro">제안자가 입력하지 않아 유형별 <b>예시 점검 항목</b>을 표시했습니다.</p>');
    }
    openModal(head + body +
      '<h3 class="h4">진행 상태</h3>' + stepper(p) +
      '<p class="ro">마지막 변경 ' + fmtT(last.at) + " · " + ACTOR[last.actor] + "</p>" +
      (p.demo ? "" : '<p class="ro">현재 <b>작성 완료 · 기관 접수 전</b> 단계입니다. 담당자 확인·개선 단계는 실제 기관 접수 기능이 생기기 전에는 변경되지 않습니다.</p>') +
      '<ul class="timeline">' + p.log.map(function (l) { return "<li><strong>" + esc(STATUS[l.status] || l.status) + "</strong>" + (l.actor === "demo_example" ? ' <span class="badge demo">시연용 예시</span>' : "") + "<br><small>" + fmtT(l.at) + " · " + ACTOR[l.actor] + (l.status === "delivered" && l.note ? " · " + esc(l.note) : "") + "</small></li>"; }).join("") + "</ul>" +
      (readonlyLink ? '<p class="ro">읽기 전용 링크로 열람 중입니다.</p>' : "") +
      '<div class="row"><button class="btn primary" data-copy="1">🔗 링크 복사</button><button class="btn ghost" data-copytext="1">📋 내용 복사</button><button class="btn ghost" onclick="window.print()">인쇄</button>' +
      (owner && !p.demo ? '<button class="btn ghost" data-editprop="' + p.id + '">✏️ 수정</button>' : "") + "</div>" +
      (owner && !p.demo ? '<form class="form" id="deliverForm" data-prop="' + p.id + '" style="margin-top:18px"><h3 style="font-size:16px">직접 전달 기록</h3><p class="ro">전달 사실만 기록하며 진행 단계는 바뀌지 않습니다.</p>' +
        '<label>전달 날짜<input type="text" name="date" value="' + new Date().toISOString().slice(0, 10) + '" placeholder="YYYY-MM-DD"></label>' +
        '<label>전달처<input type="text" name="to" maxlength="100" placeholder="예: 마산합포구청 도시과"></label>' +
        '<small class="err" id="dErr"></small><button class="btn primary" type="submit">전달 사실 저장</button></form>' : ""));
  }
  function openProposal(id, tab) {
    var p = db.proposals.find(function (x) { return x.id === id; });
    if (p) viewProposal(p, p.author === uid, false, tab);
  }
  function checkHash() {
    var mr = location.hash.match(/^#([ru])=(.+)$/);
    if (mr) {
      try {
        var sn = b64dec(mr[2]);
        if (mr[1] === "r" && sn && sn.emotion) viewShared([sn], "공유된 감정 기록");
        else if (mr[1] === "u" && Array.isArray(sn)) viewShared(sn, "공개 감정 타임라인");
        else throw 0;
      } catch (e) { toast("공유 링크를 읽을 수 없습니다."); }
      return;
    }
    var m = location.hash.match(/^#p=(.+)$/); if (!m) return;
    try {
      var p = b64dec(m[1]);
      if (!p || !p.title || !p.log) throw 0;
      var local = db.proposals.find(function (x) { return x.id === p.id; });
      if (local) viewProposal(local, local.author === uid, false, "staff"); else viewProposal(p, false, true, "staff");
    } catch (e) { toast("제안서 링크를 읽을 수 없습니다."); }
  }

  /* ---------- 상담 신청 ---------- */
  function initConsult() {
    var f = $("#consultForm");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = { name: f.name.value.trim(), phone: f.phone.value.trim(), message: f.message.value.trim() }, ok = true;
      var err = function (k, m) { f.querySelector("[data-for=" + k + "]").textContent = m; if (m) ok = false; };
      err("name", v.name ? "" : "이름을 입력해 주세요.");
      err("phone", /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(v.phone) ? "" : "올바른 전화번호를 입력해 주세요. (예: 010-1234-5678)");
      err("message", v.message.length >= 5 ? "" : "상담 내용을 5자 이상 입력해 주세요.");
      err("agree", f.agree.checked ? "" : "개인정보 수집·이용에 동의해 주세요.");
      var msg = $("#consultMsg"); msg.textContent = ""; msg.style.color = "";
      if (!ok) return;
      var rec = Object.assign({ id: newId(), at: Date.now() }, v), btn = f.querySelector("button[type=submit]");
      btn.disabled = true;
      var ep = (window.MOODMAP_CONFIG || {}).CONSULT_ENDPOINT;
      var done = function () {
        db.consults.push(rec); save(); f.reset(); btn.disabled = false;
        msg.textContent = "상담 신청이 접수되었습니다. 확인 후 연락드리겠습니다.";
      };
      if (!ep) return done();
      fetch(ep, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(v) })
        .then(function (r) { if (!r.ok) throw 0; done(); })
        .catch(function () { btn.disabled = false; msg.style.color = "#b91c1c"; msg.textContent = "전송에 실패했습니다. 입력하신 내용은 그대로 있으니 다시 시도해 주세요."; });
    });
  }

  /* ---------- 이벤트 ---------- */
  function copy(text, okMsg) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast(okMsg); },
      function () { prompt("아래 내용을 복사하세요", text); });
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button,a"); if (!t) return;
    var d = t.dataset;
    if (d.cat) { state.cat = d.cat; renderAll(); }
    else if (d.emoall) { state.emo = []; renderAll(); }
    else if (d.emo) { var k = state.emo.indexOf(d.emo); if (k >= 0) state.emo.splice(k, 1); else state.emo.push(d.emo); renderAll(); }
    else if (d.place) { var ids = d.place.split(","); ids.length > 1 ? openPlace(ids) : openIssue(ids[0]); }
    else if (d.goissue) { state.draft = null; openIssue(d.goissue); }
    else if (d.prop) { openProposal(d.prop); }
    else if (d.like) { toggleLike(d.like, d.back); }
    else if (d.propose) { openPropose(d.propose); }
    else if (d.editprop) { var pp = db.proposals.find(function (x) { return x.id === d.editprop; }); if (pp && pp.author === uid) openPropose(pp.issueId, pp.id); }
    else if (d.fillchecks) { var ta = $("#propForm").elements.checks; ta.value = (DEFAULT_CHECKS[d.fillchecks] || []).join("\n"); }
    else if (d.ptab && view) { viewProposal(view.p, view.owner, view.ro, d.ptab); }
    else if (d.copytext && view) { copy(proposalText(view.p), "제안서 내용을 복사했습니다."); }
    else if (d.rmphoto != null && d.rmphoto !== "" && state.draft) { state.draft.photos.splice(+d.rmphoto, 1); photoPreview(); }
    else if (d.vis) { var vi = db.issues.find(function (x) { return x.id === d.vis; }); if (vi && vi.author === uid) { vi.visibility = vi.visibility === "private" ? "public" : "private"; save(); renderAll(); openIssue(vi.id); toast(vi.visibility === "private" ? "나만 보기로 바꿨어요." : "공개로 바꿨어요."); } }
    else if (d.sharerec) { var sr = db.issues.find(function (x) { return x.id === d.sharerec; }); if (sr && sr.author === uid && isPublic(sr)) copy(location.origin + location.pathname + "#r=" + b64enc(recSnap(sr)), "공유 링크를 복사했어요. 사진은 제외되며, 이미 복사된 링크는 회수할 수 없어요."); else toast("공개 기록만 공유할 수 있어요."); }
    else if (t.id === "shareProfile") { var pr = mine().filter(isPublic).sort(function (a, b) { return b.at - a.at; }).slice(0, 15).map(recSnap); if (!pr.length) toast("공개로 설정한 기록이 없어요."); else copy(location.origin + location.pathname + "#u=" + b64enc(pr), "공개 프로필 링크를 복사했어요. (최신 공개 기록 " + pr.length + "건, 사진 제외)"); }
    else if (d.del) { if (confirm("이 기록을 삭제할까요?")) { db.issues = db.issues.filter(function (i) { return i.id !== d.del; }); db.comments = db.comments.filter(function (c) { return c.issueId !== d.del; }); save(); renderAll(); closeModal(); } }
    else if (d.copy && view) { copy(shareLink(view.p), "읽기 전용 링크를 복사했습니다. (상태는 바뀌지 않습니다)"); }
    else if (t.id === "startPick") { location.hash = "#app"; setPicking(true); }
    else if (t.id === "cancelPick") { setPicking(false); }
    else if (t.id === "confirmPick") { confirmPick(); }
    else if (t.id === "locate") {
      if (!navigator.geolocation) return toast("이 기기는 위치 확인을 지원하지 않습니다. 지도를 직접 움직여 주세요.");
      navigator.geolocation.getCurrentPosition(function (pos) { map.setView([pos.coords.latitude, pos.coords.longitude], 17); },
        function () { toast("위치 권한이 없어도 지도를 움직여 위치를 지정할 수 있습니다."); }, { timeout: 8000 });
    }
    else if (t.id === "clearFilter") { state.cat = "all"; state.emo = []; renderAll(); }
    else if (t.id === "modalClose") { closeModal(); if (/^#[pru]=/.test(location.hash)) history.replaceState(null, "", location.pathname); }
  });
  $("#modal").addEventListener("click", function (e) { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
  $("#sort").addEventListener("change", function (e) { state.sort = e.target.value; renderIssues(); });
  document.addEventListener("change", function (e) {
    var tg = e.target;
    if (tg.id === "photoInput") { addPhotos(tg.files); tg.value = ""; return; }
    if (tg.id === "tlPublic") { db.settings.timelinePublic = tg.checked; save(); renderAll(); toast(tg.checked ? "타임라인을 공개로 설정했어요. (공개 기록만 공유됩니다)" : "타임라인을 비공개로 설정했어요."); return; }
    if (tg.id === "dPlace") { state.dPlace = tg.value; renderDrawer(); return; }
    if (tg.id === "dEmo") { state.dEmo = tg.value; renderDrawer(); return; }
    if (tg.id === "dSort") { state.dSort = tg.value; renderDrawer(); return; }
    if (tg.form && tg.form.id === "issueForm" && (tg.name === "category" || tg.name === "emotion" || tg.name === "discomfort" || tg.name === "visibility")) updateSimilar();
    if (tg.form && (tg.type === "text" || tg.tagName === "TEXTAREA") && ["issueForm", "propForm", "commentForm"].indexOf(tg.form.id) >= 0) {
      var cr = window.CleanBot ? window.CleanBot.clean(tg.value) : { text: tg.value, count: 0 };
      if (cr.count) { tg.value = cr.text; toast("비속어 " + cr.count + "개를 ‘삭제된 표현’으로 바꿨어요."); }
    }
  });
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (f.id === "issueForm") { e.preventDefault(); submitIssue(f); }
    else if (f.id === "propForm") { e.preventDefault(); submitProposal(f); }
    else if (f.id === "commentForm") {
      e.preventDefault();
      cleanFields(f, ["body"]);
      var body = f.elements.body.value.trim();
      if (body.length < 2) { $("#cErr").textContent = "의견을 2자 이상 입력해 주세요."; return; }
      db.comments.push({ id: newId(), issueId: f.dataset.issue, author: uid, kind: f.querySelector("input[name=kind]:checked").value, body: body, at: Date.now() });
      save(); renderAll(); openIssue(f.dataset.issue); toast("의견이 등록되었습니다.");
    }
    else if (f.id === "deliverForm") {
      e.preventDefault();
      var date = f.elements.date.value.trim(), to = f.elements.to.value.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !to) { $("#dErr").textContent = "전달 날짜(YYYY-MM-DD)와 전달처를 입력해 주세요."; return; }
      var p = db.proposals.find(function (x) { return x.id === f.dataset.prop; });
      if (!p || p.author !== uid) return;
      p.status = "delivered"; p.deliveredAt = date; p.deliveredTo = to;
      p.log.push({ status: "delivered", actor: "author", note: date + " · " + to, at: Date.now() });
      save(); renderAll(); openProposal(p.id); toast("전달 사실을 기록했습니다. (진행 단계는 그대로입니다)");
    }
  });

  /* ---------- 시작 ---------- */
  initMap(); renderAll(); initConsult();
  $("#startPick").addEventListener("click", function () { if (map) setTimeout(function () { map.invalidateSize(); }, 50); });
  window.addEventListener("hashchange", checkHash);
  checkHash();
})();
