/**
 * 계약사항 체크 — 화면 로직
 *
 * 계약서 원문은 메모리에만 둔다. 민감 문서이므로 localStorage에 남기지 않는다.
 * localStorage에는 화면 테마만 저장한다.
 */
(function () {
  'use strict';

  var THEME_KEY = 'contract-check:theme';

  var state = {
    typeId: CONTRACT_TYPES[0].id,
    extraction: null,   // { text, source, pages, confidence, fileCount }
    analysis: null,     // { results, charCount }
    overrides: {},      // { itemId: true } 사용자가 직접 확인 완료 처리한 항목
    problemsOnly: false,
    busy: false,
    cancelled: false,
  };

  var el = {};
  ['uploadView', 'progressView', 'resultView', 'dropzone', 'fileInput', 'cameraInput',
   'pickBtn', 'cameraBtn', 'typeTabs', 'resultTypeTabs', 'progressMessage', 'progressHint',
   'workBar', 'workFill', 'cancelBtn', 'resultTitle', 'resultMeta', 'restartBtn',
   'qualityWarning', 'typeSuggestion', 'countDanger', 'countMissing', 'countReview', 'countOk',
   'resultSummary', 'filterToggle', 'printBtn', 'checklist', 'rawText', 'rawCount',
   'errorBox', 'themeToggle', 'themeIcon',
   'previewList', 'previewTypeName', 'previewCount'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  /* ---------- 유틸 ---------- */

  function currentType() {
    for (var i = 0; i < CONTRACT_TYPES.length; i++) {
      if (CONTRACT_TYPES[i].id === state.typeId) return CONTRACT_TYPES[i];
    }
    return CONTRACT_TYPES[0];
  }

  function allItems(type) {
    return type.sections.reduce(function (acc, s) { return acc.concat(s.items); }, []);
  }

  /** 사용자가 직접 확인 처리했으면 그 판단이 자동 판정보다 우선한다. */
  function effectiveStatus(item) {
    if (state.overrides[item.id]) return 'ok';
    if (!state.analysis) return 'manual';
    var res = state.analysis.results[item.id];
    return res ? res.status : 'manual';
  }

  function isProblem(status) {
    return status === 'danger' || status === 'missing' || status === 'review' || status === 'manual';
  }

  function showView(name) {
    el.uploadView.hidden = name !== 'upload';
    el.progressView.hidden = name !== 'progress';
    el.resultView.hidden = name !== 'result';
  }

  function showError(message) {
    el.errorBox.hidden = false;
    el.errorBox.textContent = message;
  }

  function clearError() {
    el.errorBox.hidden = true;
    el.errorBox.textContent = '';
  }

  /* ---------- 유형 탭 ---------- */

  function buildTabs(container) {
    container.textContent = '';
    CONTRACT_TYPES.forEach(function (type) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'type-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(type.id === state.typeId));
      tab.textContent = type.icon + ' ' + type.name;
      tab.addEventListener('click', function () { selectType(type.id); });
      container.appendChild(tab);
    });
  }

  function selectType(typeId) {
    if (typeId === state.typeId) return;
    state.typeId = typeId;
    state.overrides = {};

    if (state.extraction) {
      state.analysis = Matcher.analyze(currentType(), state.extraction.text);
      renderResult();
    }
    buildTabs(el.typeTabs);
    buildTabs(el.resultTypeTabs);
    renderPreview();
  }

  /* ---------- 업로드 전 미리보기 (SEO/콘텐츠용 정적 목록) ---------- */

  function renderPreview() {
    var type = currentType();
    var items = allItems(type);

    el.previewTypeName.textContent = type.name;
    el.previewCount.textContent = '(' + items.length + '개 항목)';
    el.previewList.textContent = '';

    type.sections.forEach(function (section) {
      var wrapper = document.createElement('section');
      wrapper.className = 'section';

      var heading = document.createElement('h3');
      heading.className = 'section-title';
      heading.textContent = section.name;
      wrapper.appendChild(heading);

      var list = document.createElement('ul');
      list.className = 'item-list';

      section.items.forEach(function (item) {
        var li = document.createElement('li');
        li.className = 'item';

        var head = document.createElement('div');
        head.className = 'item-head';

        var title = document.createElement('span');
        title.className = 'item-title';
        title.textContent = item.title;
        head.appendChild(title);

        var levelMeta = LEVEL_META[item.level];
        if (levelMeta) {
          var lv = document.createElement('span');
          lv.className = 'badge ' + levelMeta.className;
          lv.textContent = levelMeta.label;
          head.appendChild(lv);
        }

        li.appendChild(head);

        var desc = document.createElement('p');
        desc.className = 'item-desc';
        desc.textContent = item.desc;
        li.appendChild(desc);

        list.appendChild(li);
      });

      wrapper.appendChild(list);
      el.previewList.appendChild(wrapper);
    });
  }

  /* ---------- 파일 처리 ---------- */

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    if (state.busy) return;

    clearError();
    state.busy = true;
    state.cancelled = false;
    showView('progress');
    setProgress('파일을 읽는 중…', null);

    Extractor.extractAll(files, onProgress)
      .then(function (extraction) {
        if (state.cancelled) return;

        var stripped = extraction.text.replace(/\s/g, '');
        if (stripped.length < 30) {
          throw new Error('문서에서 글자를 거의 찾지 못했습니다. 더 밝은 곳에서 계약서 정면이 가득 차도록 다시 촬영해보세요.');
        }

        state.extraction = extraction;

        var guess = Matcher.guessType(extraction.text);
        if (guess && guess !== state.typeId) {
          state.typeId = guess;
          state.suggestedType = guess;
        } else {
          state.suggestedType = null;
        }

        state.overrides = {};
        state.analysis = Matcher.analyze(currentType(), extraction.text);

        buildTabs(el.typeTabs);
        buildTabs(el.resultTypeTabs);
        renderResult();
        showView('result');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function (err) {
        if (state.cancelled) return;
        showView('upload');
        showError(err && err.message ? err.message : '파일을 처리하지 못했습니다.');
      })
      .then(function () {
        state.busy = false;
      });
  }

  function onProgress(info) {
    if (state.cancelled) return;
    if (info.message) setProgress(info.message, info.ratio);
    else if (typeof info.ratio === 'number') setProgress(null, info.ratio);

    if (info.phase === 'ocr-init') {
      el.progressHint.textContent = '처음 한 번만 받아두면 다음부터는 바로 시작합니다.';
    } else if (info.phase === 'pdf') {
      el.progressHint.textContent = 'PDF에 글자 정보가 들어 있으면 문자 인식 없이 정확하게 읽습니다.';
    } else {
      el.progressHint.textContent = '문자 인식은 사진 한 장에 10~30초 정도 걸립니다.';
    }
  }

  function setProgress(message, ratio) {
    if (message) el.progressMessage.textContent = message;
    if (typeof ratio === 'number') {
      var percent = Math.round(ratio * 100);
      el.workFill.style.width = percent + '%';
      el.workBar.setAttribute('aria-valuenow', String(percent));
      el.workFill.classList.remove('indeterminate');
    } else {
      el.workFill.classList.add('indeterminate');
    }
  }

  /* ---------- 결과 렌더링 ---------- */

  function renderResult() {
    var type = currentType();
    var items = allItems(type);

    el.resultTitle.textContent = type.icon + ' ' + type.name;

    var sourceLabel = {
      'pdf-text': 'PDF 텍스트 직접 추출 (정확도 높음)',
      'ocr': '이미지 문자 인식',
      'mixed': 'PDF 텍스트 + 문자 인식',
    }[state.extraction.source] || '문자 인식';

    var metaParts = [
      state.extraction.fileCount + '개 파일',
      state.extraction.pages + '페이지',
      sourceLabel,
    ];
    el.resultMeta.textContent = metaParts.join(' · ');

    renderQualityWarning();
    renderTypeSuggestion();

    var counts = { ok: 0, missing: 0, danger: 0, review: 0, manual: 0 };
    items.forEach(function (item) { counts[effectiveStatus(item)]++; });

    el.countDanger.textContent = String(counts.danger);
    el.countMissing.textContent = String(counts.missing);
    el.countReview.textContent = String(counts.review + counts.manual);
    el.countOk.textContent = String(counts.ok);

    renderSummaryText(counts);
    renderChecklist();

    el.rawText.textContent = state.extraction.text.trim() || '(인식된 글자가 없습니다)';
    el.rawCount.textContent = '(' + state.analysis.charCount.toLocaleString('ko-KR') + '자)';
  }

  function renderQualityWarning() {
    var conf = state.extraction.confidence;
    if (state.extraction.source === 'pdf-text' || conf === null || conf === undefined) {
      el.qualityWarning.hidden = true;
      return;
    }
    if (conf >= 75) {
      el.qualityWarning.hidden = true;
      return;
    }
    el.qualityWarning.hidden = false;
    el.qualityWarning.textContent = conf < 55
      ? '문자 인식 정확도가 낮습니다(' + Math.round(conf) + '점). 판정 결과를 그대로 믿지 마시고, 아래 "인식된 원문 보기"로 글자가 제대로 읽혔는지 꼭 확인해주세요. 더 밝은 곳에서 정면으로 다시 촬영하면 크게 좋아집니다.'
      : '문자 인식 정확도가 보통입니다(' + Math.round(conf) + '점). 못 찾음으로 나온 항목은 실제로는 있는데 못 읽었을 수 있으니 원문을 함께 확인해주세요.';
  }

  function renderTypeSuggestion() {
    if (!state.suggestedType) {
      el.typeSuggestion.hidden = true;
      return;
    }
    var name = CONTRACT_TYPES.filter(function (t) { return t.id === state.suggestedType; })[0].name;
    el.typeSuggestion.hidden = false;
    el.typeSuggestion.textContent = '문서 내용을 보고 계약 유형을 "' + name + '"으로 판단했습니다. 다르면 아래에서 바꿔주세요.';
  }

  function renderSummaryText(counts) {
    el.resultSummary.textContent = '';

    if (counts.danger > 0) {
      var strong = document.createElement('strong');
      strong.textContent = '주의가 필요한 조항이 ' + counts.danger + '건 발견되었습니다.';
      el.resultSummary.appendChild(strong);
      el.resultSummary.appendChild(document.createTextNode(
        ' 근거 문장을 읽어보고 실제로 불리한 내용인지 판단하세요.'));
    } else if (counts.missing > 0) {
      el.resultSummary.textContent =
        '문서에서 찾지 못한 항목이 ' + counts.missing + '건 있습니다. 실제로 빠졌는지, 다른 표현으로 적혀 있는지 확인해보세요.';
    } else {
      el.resultSummary.textContent =
        '문서에서 확인해야 할 조항은 대체로 발견되었습니다. 남은 항목은 직접 확인해주세요.';
    }
  }

  function renderChecklist() {
    var type = currentType();
    el.checklist.textContent = '';

    type.sections.forEach(function (section) {
      var items = section.items.filter(function (item) {
        return !state.problemsOnly || isProblem(effectiveStatus(item));
      });
      if (items.length === 0) return;

      var wrapper = document.createElement('section');
      wrapper.className = 'section';

      var heading = document.createElement('h3');
      heading.className = 'section-title';
      heading.textContent = section.name;
      wrapper.appendChild(heading);

      var list = document.createElement('ul');
      list.className = 'item-list';
      items.forEach(function (item) { list.appendChild(renderItem(item)); });

      wrapper.appendChild(list);
      el.checklist.appendChild(wrapper);
    });

    if (!el.checklist.children.length) {
      var done = document.createElement('p');
      done.className = 'empty-state';
      done.textContent = '문제로 표시된 항목이 없습니다 👏';
      el.checklist.appendChild(done);
    }
  }

  function renderItem(item) {
    var status = effectiveStatus(item);
    var result = state.analysis.results[item.id] || {};
    var meta = STATUS_META[status];

    var li = document.createElement('li');
    li.className = 'item item-' + status;

    var head = document.createElement('div');
    head.className = 'item-head';

    var badge = document.createElement('span');
    badge.className = 'status-badge ' + meta.className;
    badge.textContent = meta.label;
    head.appendChild(badge);

    var title = document.createElement('span');
    title.className = 'item-title';
    title.textContent = item.title;
    head.appendChild(title);

    var levelMeta = LEVEL_META[item.level];
    if (levelMeta) {
      var lv = document.createElement('span');
      lv.className = 'badge ' + levelMeta.className;
      lv.textContent = levelMeta.label;
      head.appendChild(lv);
    }

    li.appendChild(head);

    var desc = document.createElement('p');
    desc.className = 'item-desc';
    desc.textContent = item.desc;
    li.appendChild(desc);

    if (result.evidence) {
      li.appendChild(renderEvidence(result));
    } else if (item.manualOnly) {
      var note = document.createElement('p');
      note.className = 'item-note';
      note.textContent = '계약서 본문으로는 알 수 없는 항목입니다. 직접 확인한 뒤 체크하세요.';
      li.appendChild(note);
    } else if (status === 'missing') {
      var miss = document.createElement('p');
      miss.className = 'item-note';
      miss.textContent = '관련 문구를 찾지 못했습니다. 다른 표현으로 적혀 있을 수 있으니 원문을 확인해보세요.';
      li.appendChild(miss);
    }

    li.appendChild(renderOverride(item, status));
    return li;
  }

  function renderEvidence(result) {
    var box = document.createElement('div');
    box.className = 'evidence';

    var label = document.createElement('span');
    label.className = 'evidence-label';
    label.textContent = result.fuzzy ? '근거 (유사 문구로 찾음)' : '근거';
    box.appendChild(label);

    var quote = document.createElement('p');
    quote.className = 'evidence-text';

    var text = result.evidence.text;
    var mark = result.evidence.highlight;
    var at = mark ? text.indexOf(mark) : -1;

    if (at !== -1) {
      quote.appendChild(document.createTextNode(text.slice(0, at)));
      var em = document.createElement('mark');
      em.textContent = mark;
      quote.appendChild(em);
      quote.appendChild(document.createTextNode(text.slice(at + mark.length)));
    } else {
      quote.textContent = text;
    }

    box.appendChild(quote);
    return box;
  }

  function renderOverride(item, status) {
    var label = document.createElement('label');
    label.className = 'override';

    var box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!state.overrides[item.id];
    box.addEventListener('change', function () {
      if (box.checked) state.overrides[item.id] = true;
      else delete state.overrides[item.id];
      renderResult();
    });

    var text = document.createElement('span');
    text.textContent = status === 'ok' && !state.overrides[item.id]
      ? '직접 확인함'
      : '직접 확인했고 문제없음';

    label.appendChild(box);
    label.appendChild(text);
    return label;
  }

  /* ---------- 테마 ---------- */

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* 시크릿 모드 */ }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    el.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    safeSet(THEME_KEY, theme);
  }

  /* ---------- 초기화 ---------- */

  function initDropzone() {
    ['dragenter', 'dragover'].forEach(function (type) {
      el.dropzone.addEventListener(type, function (e) {
        e.preventDefault();
        el.dropzone.classList.add('is-over');
      });
    });

    ['dragleave', 'drop'].forEach(function (type) {
      el.dropzone.addEventListener(type, function (e) {
        e.preventDefault();
        el.dropzone.classList.remove('is-over');
      });
    });

    el.dropzone.addEventListener('drop', function (e) {
      handleFiles(e.dataTransfer.files);
    });

    el.dropzone.addEventListener('click', function () { el.fileInput.click(); });
    el.dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.fileInput.click();
      }
    });
  }

  function init() {
    var savedTheme = safeGet(THEME_KEY);
    if (savedTheme !== 'dark' && savedTheme !== 'light') {
      savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(savedTheme);

    buildTabs(el.typeTabs);
    buildTabs(el.resultTypeTabs);
    renderPreview();
    initDropzone();

    el.pickBtn.addEventListener('click', function () { el.fileInput.click(); });
    el.cameraBtn.addEventListener('click', function () { el.cameraInput.click(); });

    [el.fileInput, el.cameraInput].forEach(function (input) {
      input.addEventListener('change', function () {
        handleFiles(input.files);
        input.value = '';
      });
    });

    el.cancelBtn.addEventListener('click', function () {
      state.cancelled = true;
      state.busy = false;
      showView('upload');
    });

    el.restartBtn.addEventListener('click', function () {
      state.extraction = null;
      state.analysis = null;
      state.overrides = {};
      state.suggestedType = null;
      clearError();
      showView('upload');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    el.filterToggle.addEventListener('change', function () {
      state.problemsOnly = el.filterToggle.checked;
      renderChecklist();
    });

    el.printBtn.addEventListener('click', function () { window.print(); });

    el.themeToggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });

    showView('upload');
  }

  init();
})();
