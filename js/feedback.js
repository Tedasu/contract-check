/**
 * 익명 문의함
 *
 * 서버에는 문의 내용과 bcrypt 처리된 비밀번호만 남는다.
 * 이메일·IP·기기 정보 등 신원을 알 수 있는 값은 보내지 않는다.
 */
(function () {
  'use strict';

  var CATEGORY_LABEL = {
    bug: '오류 신고',
    accuracy: '판정이 틀렸어요',
    idea: '개선 제안',
    etc: '기타',
  };

  var STATUS_LABEL = {
    received: '접수됨',
    reviewing: '확인 중',
    done: '반영 완료',
    rejected: '반영 어려움',
  };

  var LAST_TICKET_KEY = 'contract-check:last-ticket';

  var el = {};
  var state = { tab: 'write', busy: false };

  /* ---------- 설정 ---------- */

  function config() {
    return window.APP_CONFIG || {};
  }

  function isConfigured() {
    var c = config();
    return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY);
  }

  /* ---------- 서버 호출 ---------- */

  function callRpc(fnName, payload) {
    var c = config();
    var url = c.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/' + fnName;

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: c.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + c.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }

        if (!res.ok) {
          var message = (data && (data.message || data.hint)) || '서버 오류가 발생했습니다. (' + res.status + ')';
          throw new Error(message);
        }
        return data;
      });
    }, function () {
      throw new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.');
    });
  }

  /** 비밀번호는 기기 밖으로 나가지 않는다. 해시만 전송한다. */
  function hashPassword(password) {
    var bytes = new TextEncoder().encode('contract-check:' + password);
    return crypto.subtle.digest('SHA-256', bytes).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  /* ---------- 화면 ---------- */

  function openDialog(tab) {
    setTab(tab || 'write');
    clearMessages();
    if (typeof el.dialog.showModal === 'function') el.dialog.showModal();
    else el.dialog.setAttribute('open', '');
  }

  function closeDialog() {
    if (typeof el.dialog.close === 'function') el.dialog.close();
    else el.dialog.removeAttribute('open');
  }

  function setTab(tab) {
    state.tab = tab;
    el.tabWrite.setAttribute('aria-selected', String(tab === 'write'));
    el.tabLookup.setAttribute('aria-selected', String(tab === 'lookup'));
    el.panelWrite.hidden = tab !== 'write';
    el.panelLookup.hidden = tab !== 'lookup';
    el.panelResult.hidden = true;
  }

  function clearMessages() {
    el.writeError.hidden = true;
    el.lookupError.hidden = true;
    el.panelResult.hidden = true;
  }

  function showError(node, message) {
    node.hidden = false;
    node.textContent = message;
  }

  function setBusy(busy, button, labelWhenIdle) {
    state.busy = busy;
    button.disabled = busy;
    button.textContent = busy ? '처리 중…' : labelWhenIdle;
  }

  /* ---------- 문의 접수 ---------- */

  function submit() {
    if (state.busy) return;
    clearMessages();

    var body = el.bodyInput.value.trim();
    var password = el.passwordInput.value;
    var category = el.categoryInput.value;

    if (body.length < 5) {
      showError(el.writeError, '문의 내용을 5자 이상 적어주세요.');
      el.bodyInput.focus();
      return;
    }
    if (body.length > 2000) {
      showError(el.writeError, '문의 내용은 2000자까지 입력할 수 있습니다.');
      return;
    }
    if (password.length < 4) {
      showError(el.writeError, '비밀번호를 4자 이상 정해주세요. 나중에 이 글을 다시 볼 때 필요합니다.');
      el.passwordInput.focus();
      return;
    }

    setBusy(true, el.submitBtn, '문의 보내기');

    hashPassword(password)
      .then(function (hash) {
        return callRpc('submit_feedback', {
          p_category: category,
          p_body: body,
          p_password_hash: hash,
        });
      })
      .then(function (ticket) {
        el.bodyInput.value = '';
        el.passwordInput.value = '';
        try { localStorage.setItem(LAST_TICKET_KEY, ticket); } catch (e) { /* 무시 */ }
        showTicket(ticket);
      })
      .catch(function (err) {
        showError(el.writeError, err.message);
      })
      .then(function () {
        setBusy(false, el.submitBtn, '문의 보내기');
      });
  }

  function showTicket(ticket) {
    el.panelWrite.hidden = true;
    el.panelLookup.hidden = true;
    el.panelResult.hidden = false;

    el.panelResult.textContent = '';

    var title = document.createElement('p');
    title.className = 'fb-result-title';
    title.textContent = '문의가 접수되었습니다.';
    el.panelResult.appendChild(title);

    var codeBox = document.createElement('div');
    codeBox.className = 'fb-ticket';

    var code = document.createElement('strong');
    code.textContent = ticket;
    codeBox.appendChild(code);

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn';
    copyBtn.textContent = '복사';
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(ticket).then(function () {
        copyBtn.textContent = '복사됨';
        setTimeout(function () { copyBtn.textContent = '복사'; }, 1500);
      }).catch(function () {
        copyBtn.textContent = '복사 실패';
      });
    });
    codeBox.appendChild(copyBtn);
    el.panelResult.appendChild(codeBox);

    var note = document.createElement('p');
    note.className = 'fb-note';
    note.textContent = '이 문의번호와 방금 정한 비밀번호가 있어야 답변을 확인할 수 있습니다. '
      + '익명으로 접수되어 따로 연락드릴 방법이 없으니 번호를 꼭 저장해두세요.';
    el.panelResult.appendChild(note);

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn';
    back.textContent = '닫기';
    back.addEventListener('click', closeDialog);
    el.panelResult.appendChild(back);
  }

  /* ---------- 내 문의 조회 ---------- */

  function lookup() {
    if (state.busy) return;
    clearMessages();

    var ticket = el.ticketInput.value.trim().toUpperCase();
    var password = el.lookupPasswordInput.value;

    if (!ticket) {
      showError(el.lookupError, '문의번호를 입력해주세요.');
      return;
    }
    if (!password) {
      showError(el.lookupError, '비밀번호를 입력해주세요.');
      return;
    }

    setBusy(true, el.lookupBtn, '조회하기');

    hashPassword(password)
      .then(function (hash) {
        return callRpc('get_feedback', { p_ticket: ticket, p_password_hash: hash });
      })
      .then(function (rows) {
        if (!rows || rows.length === 0) {
          showError(el.lookupError, '문의번호나 비밀번호가 맞지 않습니다. 대소문자와 숫자를 다시 확인해주세요.');
          return;
        }
        showFeedback(rows[0]);
      })
      .catch(function (err) {
        showError(el.lookupError, err.message);
      })
      .then(function () {
        setBusy(false, el.lookupBtn, '조회하기');
      });
  }

  function showFeedback(row) {
    el.panelWrite.hidden = true;
    el.panelLookup.hidden = true;
    el.panelResult.hidden = false;
    el.panelResult.textContent = '';

    var head = document.createElement('div');
    head.className = 'fb-view-head';

    var badge = document.createElement('span');
    badge.className = 'fb-status fb-status-' + row.status;
    badge.textContent = STATUS_LABEL[row.status] || row.status;
    head.appendChild(badge);

    var meta = document.createElement('span');
    meta.className = 'fb-view-meta';
    meta.textContent = (CATEGORY_LABEL[row.category] || row.category)
      + ' · ' + formatDate(row.created_at);
    head.appendChild(meta);

    el.panelResult.appendChild(head);

    var body = document.createElement('p');
    body.className = 'fb-view-body';
    body.textContent = row.body;
    el.panelResult.appendChild(body);

    if (row.reply) {
      var replyBox = document.createElement('div');
      replyBox.className = 'fb-reply';

      var label = document.createElement('span');
      label.className = 'fb-reply-label';
      label.textContent = '답변' + (row.replied_at ? ' · ' + formatDate(row.replied_at) : '');
      replyBox.appendChild(label);

      var replyText = document.createElement('p');
      replyText.className = 'fb-reply-text';
      replyText.textContent = row.reply;
      replyBox.appendChild(replyText);

      el.panelResult.appendChild(replyBox);
    } else {
      var waiting = document.createElement('p');
      waiting.className = 'fb-note';
      waiting.textContent = '아직 답변이 등록되지 않았습니다. 나중에 같은 문의번호로 다시 확인해주세요.';
      el.panelResult.appendChild(waiting);
    }

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn';
    back.textContent = '닫기';
    back.addEventListener('click', closeDialog);
    el.panelResult.appendChild(back);
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* ---------- 초기화 ---------- */

  function init() {
    ['feedbackBtn', 'feedbackDialog', 'fbClose', 'fbTabWrite', 'fbTabLookup',
     'fbPanelWrite', 'fbPanelLookup', 'fbPanelResult', 'fbCategory', 'fbBody',
     'fbPassword', 'fbSubmit', 'fbWriteError', 'fbTicket', 'fbLookupPassword',
     'fbLookup', 'fbLookupError', 'fbOffline', 'fbCharCount'].forEach(function (id) {
      el[id] = document.getElementById(id);
    });

    el.dialog = el.feedbackDialog;
    el.tabWrite = el.fbTabWrite;
    el.tabLookup = el.fbTabLookup;
    el.panelWrite = el.fbPanelWrite;
    el.panelLookup = el.fbPanelLookup;
    el.panelResult = el.fbPanelResult;
    el.categoryInput = el.fbCategory;
    el.bodyInput = el.fbBody;
    el.passwordInput = el.fbPassword;
    el.submitBtn = el.fbSubmit;
    el.writeError = el.fbWriteError;
    el.ticketInput = el.fbTicket;
    el.lookupPasswordInput = el.fbLookupPassword;
    el.lookupBtn = el.fbLookup;
    el.lookupError = el.fbLookupError;

    el.feedbackBtn.addEventListener('click', function () { openDialog('write'); });
    el.fbClose.addEventListener('click', closeDialog);
    el.tabWrite.addEventListener('click', function () { setTab('write'); });
    el.tabLookup.addEventListener('click', function () { setTab('lookup'); });
    el.submitBtn.addEventListener('click', submit);
    el.lookupBtn.addEventListener('click', lookup);

    el.bodyInput.addEventListener('input', function () {
      el.fbCharCount.textContent = el.bodyInput.value.length + ' / 2000';
    });

    // 배경 클릭으로 닫기
    el.dialog.addEventListener('click', function (e) {
      if (e.target === el.dialog) closeDialog();
    });

    // 직전에 남긴 문의번호를 조회 칸에 채워준다. 비밀번호는 저장하지 않는다.
    try {
      var last = localStorage.getItem(LAST_TICKET_KEY);
      if (last) el.ticketInput.value = last;
    } catch (e) { /* 무시 */ }

    if (!isConfigured()) {
      el.fbOffline.hidden = false;
      el.submitBtn.disabled = true;
      el.lookupBtn.disabled = true;
      el.bodyInput.disabled = true;
      el.passwordInput.disabled = true;
      el.categoryInput.disabled = true;
      el.ticketInput.disabled = true;
      el.lookupPasswordInput.disabled = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
