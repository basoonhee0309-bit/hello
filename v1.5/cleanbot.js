/* 클린봇: 브라우저 안에서 동작하는 사전 기반 비속어 필터.
   서버 검증이 없어 완벽하지 않으며, 변형·신조어는 놓칠 수 있습니다. */
(function () {
  "use strict";
  var REPLACE = "삭제된 표현";
  // [단어, 뒤에 오면 정상 단어로 보는 접미(부정 선행 검사)]
  var WORDS = [
    ["시발", "점|역|지|버스|택시"], ["씨발", ""], ["씨팔", ""], ["시팔", ""], ["씨바", ""], ["ㅅㅂ", ""], ["ㅆㅂ", ""],
    ["병신", ""], ["븅신", ""], ["지랄", ""], ["개새끼", ""], ["개색기", ""], ["새끼야", ""], ["좆", ""], ["존나", ""], ["졸라", ""],
    ["씹새", ""], ["씹할", ""], ["썅", ""], ["엿먹", ""], ["닥쳐", ""], ["미친놈", ""], ["미친년", ""], ["개년", ""],
    ["느금", ""], ["애미", ""], ["걸레같", ""], ["또라이", ""], ["fuck", ""], ["shit", ""], ["bitch", ""]
  ];
  var SEP = "[\\s.\\-_*~!@#0-9]{0,2}";
  function build(w) {
    var chars = Array.from(w[0]).map(function (c) { return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
    var src = chars.join(SEP) + (w[1] ? "(?!" + w[1] + ")" : "");
    return new RegExp(src, "gi");
  }
  var RULES = WORDS.map(build);
  function clean(text) {
    var out = String(text == null ? "" : text), count = 0;
    RULES.forEach(function (re) {
      out = out.replace(re, function () { count++; return REPLACE; });
    });
    out = out.replace(/(삭제된 표현[\s,]*){2,}/g, function () { count += 0; return REPLACE + " "; }).replace(/ {2,}/g, " ");
    return { text: out, count: count };
  }
  window.CleanBot = { clean: clean };
})();
