/**
 * 계약서 텍스트 매칭 엔진
 *
 * OCR 결과는 깨끗하지 않다. 정확도를 끌어올리는 장치는 네 가지다.
 *  1) 공백/전각문자 제거 정규화 — 한글 OCR이 임의로 넣는 띄어쓰기를 무력화
 *  2) 조건군(AND/OR) 매칭     — 단일 키워드보다 오탐이 적다
 *  3) bigram 유사도 보조 매칭 — '계약'을 '게약'으로 읽는 오류를 흡수
 *  4) 근거 문장 역추적        — 사람이 눈으로 검증할 수 있게 원문을 보여준다
 */
window.Matcher = (function () {
  'use strict';

  var FUZZY_MIN_LEN = 4;
  var EVIDENCE_RADIUS = 60;

  /**
   * 원문을 매칭용 문자열로 정규화한다.
   * map[i] = norm의 i번째 글자가 원문(src)에서 있던 위치
   */
  function normalize(rawText) {
    var src = rawText.normalize('NFC');
    var norm = '';
    var map = [];

    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      if (/\s/.test(ch)) continue;

      var code = ch.charCodeAt(0);
      if (code >= 0xff01 && code <= 0xff5e) {
        ch = String.fromCharCode(code - 0xfee0); // 전각 → 반각
      }

      norm += ch.toLowerCase();
      map.push(i);
    }

    return { src: src, norm: norm, map: map };
  }

  /**
   * 허용 오차 개수. 짧은 단어를 느슨하게 보면 오탐이 급증하므로 길이에 따라 다르게 준다.
   * 3글자 이하는 아예 유사매칭하지 않는다.
   */
  function allowedEdits(length) {
    if (length < FUZZY_MIN_LEN) return 0;
    if (length <= 7) return 1;
    return 2;
  }

  /**
   * 편집거리를 max까지만 계산한다. max를 넘으면 -1을 반환하고 즉시 포기한다.
   * 한글 단어는 글자 수가 적어 bigram 유사도로는 한 글자 오류도 걸러지므로 편집거리를 쓴다.
   */
  function editDistanceWithin(a, b, max) {
    var la = a.length;
    var lb = b.length;
    if (Math.abs(la - lb) > max) return -1;

    var prev = new Array(lb + 1);
    var cur = new Array(lb + 1);
    var i, j;

    for (j = 0; j <= lb; j++) prev[j] = j;

    for (i = 1; i <= la; i++) {
      cur[0] = i;
      var rowBest = cur[0];

      for (j = 1; j <= lb; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        cur[j] = v;
        if (v < rowBest) rowBest = v;
      }

      if (rowBest > max) return -1;

      var swap = prev; prev = cur; cur = swap;
    }

    return prev[lb] <= max ? prev[lb] : -1;
  }

  /** 정확히 못 찾았을 때 슬라이딩 윈도로 가장 비슷한 구간을 찾는다. */
  function fuzzyFind(norm, needle) {
    var len = needle.length;
    var max = allowedEdits(len);
    if (max === 0) return null;

    var first = needle[0];
    var last = needle[len - 1];
    var best = null;
    var limit = norm.length - len;

    for (var i = 0; i <= limit; i++) {
      // 첫 글자도 끝 글자도 안 맞는 구간은 볼 필요가 없다. 탐색 비용을 크게 줄인다.
      if (norm[i] !== first && norm[i + len - 1] !== last) continue;

      var dist = editDistanceWithin(norm.slice(i, i + len), needle, max);
      if (dist === -1) continue;

      var score = 1 - dist / len;
      if (!best || score > best.score) {
        best = { index: i, length: len, score: score, fuzzy: true };
        if (dist === 0) break;
      }
    }
    return best;
  }

  /** term은 '가|나|다' 형태의 후보 목록. 하나라도 찾으면 성공. */
  function findTerm(norm, term) {
    var candidates = term.split('|');
    var i;

    for (i = 0; i < candidates.length; i++) {
      var exact = norm.indexOf(candidates[i]);
      if (exact !== -1) {
        return { index: exact, length: candidates[i].length, score: 1, fuzzy: false };
      }
    }

    var best = null;
    for (i = 0; i < candidates.length; i++) {
      var hit = fuzzyFind(norm, candidates[i]);
      if (hit && (!best || hit.score > best.score)) best = hit;
    }
    return best;
  }

  /** norm 상의 위치를 원문 문장으로 되돌린다. */
  function extractEvidence(ctx, normIndex, normLength) {
    var startNorm = Math.max(0, normIndex - EVIDENCE_RADIUS);
    var endNorm = Math.min(ctx.map.length - 1, normIndex + normLength + EVIDENCE_RADIUS);

    var srcStart = ctx.map[startNorm];
    var srcEnd = ctx.map[endNorm];
    if (srcStart === undefined || srcEnd === undefined) return null;

    var slice = ctx.src.slice(srcStart, srcEnd + 1).replace(/\s+/g, ' ').trim();

    var hitStart = ctx.map[normIndex];
    var hitEnd = ctx.map[normIndex + normLength - 1];
    var highlight = (hitStart !== undefined && hitEnd !== undefined)
      ? ctx.src.slice(hitStart, hitEnd + 1).replace(/\s+/g, ' ').trim()
      : '';

    return {
      text: (srcStart > 0 ? '… ' : '') + slice + (srcEnd < ctx.src.length - 1 ? ' …' : ''),
      highlight: highlight,
    };
  }

  /** 조건군 하나를 평가한다. all의 모든 term이 잡혀야 성립. */
  function evaluateGroup(ctx, group) {
    var hits = [];

    for (var i = 0; i < group.all.length; i++) {
      var hit = findTerm(ctx.norm, group.all[i]);
      if (!hit) return null;
      hits.push(hit);
    }

    hits.sort(function (a, b) { return a.index - b.index; });

    var anyFuzzy = hits.some(function (h) { return h.fuzzy; });
    var minScore = hits.reduce(function (m, h) { return Math.min(m, h.score); }, 1);

    return {
      anchor: hits[0],
      fuzzy: anyFuzzy,
      score: minScore,
      terms: group.all,
    };
  }

  /**
   * 항목 하나를 판정한다.
   * 반환: { status, evidence, fuzzy, matchedTerms }
   *   status — ok / missing / danger / review / manual
   */
  function evaluateItem(item, ctx) {
    if (item.manualOnly || !item.rules) {
      return { status: 'manual', evidence: null, fuzzy: false };
    }

    var found = null;
    for (var i = 0; i < item.rules.any.length; i++) {
      var result = evaluateGroup(ctx, item.rules.any[i]);
      if (result && (!found || result.score > found.score)) found = result;
    }

    var status;
    if (item.polarity === 'forbidden') {
      status = found ? 'danger' : 'ok';
    } else if (item.polarity === 'review') {
      status = found ? 'review' : 'ok';
    } else {
      status = found ? 'ok' : 'missing';
    }

    return {
      status: status,
      fuzzy: found ? found.fuzzy : false,
      matchedTerms: found ? found.terms : null,
      evidence: found ? extractEvidence(ctx, found.anchor.index, found.anchor.length) : null,
    };
  }

  /** 계약 유형 전체를 판정한다. */
  function analyze(type, rawText) {
    var ctx = normalize(rawText);
    var results = {};

    type.sections.forEach(function (section) {
      section.items.forEach(function (item) {
        results[item.id] = evaluateItem(item, ctx);
      });
    });

    return { results: results, charCount: ctx.norm.length };
  }

  /**
   * 어떤 계약 유형인지 추정한다. 사용자가 유형을 잘못 고르면 판정이 통째로 틀어지므로,
   * 유형 특징어의 등장 횟수를 세어 가장 유력한 유형을 제안한다.
   */
  var TYPE_HINTS = {
    employment: ['근로계약', '사용자', '근로자', '소정근로', '임금', '취업규칙', '연차'],
    lease: ['임대인', '임차인', '보증금', '임대차', '차임', '전세', '중개대상물'],
    freelance: ['용역', '수급인', '도급', '산출물', '납품', '검수', '과업'],
  };

  function guessType(rawText) {
    var ctx = normalize(rawText);
    var scores = [];

    Object.keys(TYPE_HINTS).forEach(function (typeId) {
      var score = TYPE_HINTS[typeId].reduce(function (sum, word) {
        var count = 0;
        var from = 0;
        while (true) {
          var at = ctx.norm.indexOf(word, from);
          if (at === -1) break;
          count++;
          from = at + word.length;
          if (count >= 5) break;
        }
        return sum + count;
      }, 0);
      scores.push({ typeId: typeId, score: score });
    });

    scores.sort(function (a, b) { return b.score - a.score; });
    if (scores[0].score < 3) return null;
    if (scores[0].score < scores[1].score * 1.5) return null; // 판단이 애매하면 제안하지 않는다
    return scores[0].typeId;
  }

  return {
    normalize: normalize,
    analyze: analyze,
    guessType: guessType,
    evaluateItem: evaluateItem,
  };
})();
