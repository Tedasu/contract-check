/**
 * 파일 → 텍스트 추출
 *
 * 정확도 우선순위
 *   1순위: PDF 텍스트 레이어 (오차 거의 없음)
 *   2순위: 이미지 전처리 후 OCR (오차 있음)
 * 스캔 PDF는 페이지를 캔버스로 렌더한 뒤 2순위로 넘긴다.
 */
window.Extractor = (function () {
  'use strict';

  var PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs';
  var PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs';
  var TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

  // 페이지당 이만큼도 안 나오면 텍스트 레이어가 없는 스캔본으로 본다.
  var TEXT_LAYER_MIN_CHARS = 40;
  var OCR_TARGET_WIDTH = 1800;
  var OCR_MAX_WIDTH = 2600;

  var pdfjsLib = null;
  var ocrWorker = null;

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var tag = document.createElement('script');
      tag.src = url;
      tag.onload = resolve;
      tag.onerror = function () { reject(new Error('스크립트를 불러오지 못했습니다: ' + url)); };
      document.head.appendChild(tag);
    });
  }

  function getPdfjs() {
    if (pdfjsLib) return Promise.resolve(pdfjsLib);
    return import(/* @vite-ignore */ PDFJS_URL).then(function (mod) {
      mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      pdfjsLib = mod;
      return mod;
    });
  }

  function getOcrWorker(onProgress) {
    if (ocrWorker) return Promise.resolve(ocrWorker);

    var ready = window.Tesseract ? Promise.resolve() : loadScript(TESSERACT_URL);

    return ready.then(function () {
      onProgress({ phase: 'ocr-init', message: '한국어 인식 데이터를 준비하는 중… (최초 1회, 약 7MB)' });
      return window.Tesseract.createWorker('kor+eng', 1, {
        logger: function (m) {
          if (m.status === 'recognizing text') {
            onProgress({ phase: 'ocr', message: '문자를 인식하는 중…', ratio: m.progress });
          }
        },
      });
    }).then(function (worker) {
      ocrWorker = worker;
      return worker;
    });
  }

  /* ---------- 이미지 전처리 ---------- */

  /**
   * 회색조 → Otsu 이진화. 사진으로 찍은 계약서의 인식률을 끌어올리는 핵심 단계.
   */
  function preprocess(canvas) {
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var px = image.data;
    var histogram = new Array(256).fill(0);
    var i;

    for (i = 0; i < px.length; i += 4) {
      var gray = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
      px[i] = px[i + 1] = px[i + 2] = gray;
      histogram[gray]++;
    }

    var total = canvas.width * canvas.height;
    var sum = 0;
    for (i = 0; i < 256; i++) sum += i * histogram[i];

    var sumB = 0, weightB = 0, maxVariance = 0, threshold = 128;
    for (i = 0; i < 256; i++) {
      weightB += histogram[i];
      if (weightB === 0) continue;
      var weightF = total - weightB;
      if (weightF === 0) break;

      sumB += i * histogram[i];
      var meanB = sumB / weightB;
      var meanF = (sum - sumB) / weightF;
      var variance = weightB * weightF * (meanB - meanF) * (meanB - meanF);
      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = i;
      }
    }

    // 살짝 관대하게 잡아야 얇은 획이 날아가지 않는다.
    var cut = threshold + 10;
    for (i = 0; i < px.length; i += 4) {
      var v = px[i] > cut ? 255 : 0;
      px[i] = px[i + 1] = px[i + 2] = v;
    }

    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  function drawScaled(source, sourceWidth, sourceHeight) {
    var scale = 1;
    if (sourceWidth < OCR_TARGET_WIDTH) scale = OCR_TARGET_WIDTH / sourceWidth;
    if (sourceWidth * scale > OCR_MAX_WIDTH) scale = OCR_MAX_WIDTH / sourceWidth;

    var canvas = document.createElement('canvas');
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);

    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('이미지를 열 수 없습니다: ' + file.name));
      };
      img.src = url;
    });
  }

  function runOcr(canvas, onProgress) {
    return getOcrWorker(onProgress).then(function (worker) {
      return worker.recognize(canvas);
    }).then(function (result) {
      return {
        text: result.data.text || '',
        confidence: typeof result.data.confidence === 'number' ? result.data.confidence : null,
      };
    });
  }

  /* ---------- PDF ---------- */

  function extractPdf(file, onProgress) {
    return getPdfjs()
      .then(function (lib) {
        onProgress({ phase: 'pdf', message: 'PDF를 여는 중…' });
        return file.arrayBuffer().then(function (buffer) {
          return lib.getDocument({ data: buffer }).promise;
        });
      })
      .then(function (doc) {
        var pageTexts = [];
        var chain = Promise.resolve();

        for (var p = 1; p <= doc.numPages; p++) {
          (function (pageNum) {
            chain = chain.then(function () {
              onProgress({
                phase: 'pdf',
                message: 'PDF 텍스트를 읽는 중… (' + pageNum + '/' + doc.numPages + ')',
                ratio: pageNum / doc.numPages,
              });
              return doc.getPage(pageNum).then(function (page) {
                return page.getTextContent().then(function (content) {
                  pageTexts.push(content.items.map(function (it) { return it.str; }).join(' '));
                });
              });
            });
          })(p);
        }

        return chain.then(function () {
          var joined = pageTexts.join('\n');
          var perPage = joined.replace(/\s/g, '').length / doc.numPages;

          if (perPage >= TEXT_LAYER_MIN_CHARS) {
            return { text: joined, source: 'pdf-text', pages: doc.numPages, confidence: null };
          }
          return ocrPdfPages(doc, onProgress);
        });
      });
  }

  /** 텍스트 레이어가 없는 스캔 PDF: 페이지를 그림으로 렌더해 OCR */
  function ocrPdfPages(doc, onProgress) {
    var texts = [];
    var confidences = [];
    var chain = Promise.resolve();
    var pageCount = doc.numPages;

    for (var p = 1; p <= pageCount; p++) {
      (function (pageNum) {
        chain = chain.then(function () {
          onProgress({
            phase: 'ocr-page',
            message: '스캔본으로 판단해 문자 인식 중… (' + pageNum + '/' + pageCount + ')',
          });
          return doc.getPage(pageNum).then(function (page) {
            var viewport = page.getViewport({ scale: 1 });
            var scale = Math.min(OCR_MAX_WIDTH, OCR_TARGET_WIDTH) / viewport.width;
            var scaled = page.getViewport({ scale: scale });

            var canvas = document.createElement('canvas');
            canvas.width = Math.round(scaled.width);
            canvas.height = Math.round(scaled.height);

            return page.render({
              canvasContext: canvas.getContext('2d', { willReadFrequently: true }),
              viewport: scaled,
            }).promise.then(function () {
              preprocess(canvas);
              return runOcr(canvas, onProgress);
            }).then(function (res) {
              texts.push(res.text);
              if (res.confidence !== null) confidences.push(res.confidence);
            });
          });
        });
      })(p);
    }

    return chain.then(function () {
      return {
        text: texts.join('\n'),
        source: 'ocr',
        pages: pageCount,
        confidence: average(confidences),
      };
    });
  }

  function average(list) {
    if (!list.length) return null;
    return list.reduce(function (a, b) { return a + b; }, 0) / list.length;
  }

  /* ---------- 공개 API ---------- */

  function extractFile(file, onProgress) {
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

    if (isPdf) return extractPdf(file, onProgress);

    if (!/^image\//.test(file.type)) {
      return Promise.reject(new Error(file.name + ' 은(는) 지원하지 않는 형식입니다. PDF 또는 이미지를 올려주세요.'));
    }

    onProgress({ phase: 'image', message: '이미지를 다듬는 중…' });
    return loadImage(file).then(function (img) {
      var canvas = drawScaled(img, img.naturalWidth, img.naturalHeight);
      preprocess(canvas);
      onProgress({ phase: 'ocr', message: '문자를 인식하는 중…', ratio: 0 });
      return runOcr(canvas, onProgress).then(function (res) {
        return { text: res.text, source: 'ocr', pages: 1, confidence: res.confidence };
      });
    });
  }

  /** 여러 파일을 순서대로 처리해 하나의 텍스트로 합친다. */
  function extractAll(files, onProgress) {
    var list = Array.prototype.slice.call(files);
    var parts = [];
    var sources = [];
    var confidences = [];
    var pages = 0;
    var chain = Promise.resolve();

    list.forEach(function (file, index) {
      chain = chain.then(function () {
        onProgress({
          phase: 'file',
          message: '(' + (index + 1) + '/' + list.length + ') ' + file.name,
          fileIndex: index,
          fileCount: list.length,
        });
        return extractFile(file, onProgress).then(function (res) {
          parts.push(res.text);
          sources.push(res.source);
          pages += res.pages;
          if (res.confidence !== null && res.confidence !== undefined) confidences.push(res.confidence);
        });
      });
    });

    return chain.then(function () {
      return {
        text: parts.join('\n\n'),
        source: sources.indexOf('ocr') === -1 ? 'pdf-text' : (sources.indexOf('pdf-text') === -1 ? 'ocr' : 'mixed'),
        pages: pages,
        confidence: average(confidences),
        fileCount: list.length,
      };
    });
  }

  function dispose() {
    if (ocrWorker) {
      ocrWorker.terminate();
      ocrWorker = null;
    }
  }

  return { extractAll: extractAll, dispose: dispose };
})();
