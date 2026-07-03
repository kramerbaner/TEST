if (!window.__zrzutStronyLoaded) {
  window.__zrzutStronyLoaded = true;

  (function () {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }

    function requestVisibleCapture() {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'capture-visible-tab-for-content' }, (res) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!res || !res.ok) return reject(new Error(res && res.error));
          resolve(res.dataUrl);
        });
      });
    }

    // ---------- Status toast (progress feedback) ----------
    let toastEl = null;
    function showToast(text) {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'zrzut-toast';
        document.documentElement.appendChild(toastEl);
      }
      toastEl.textContent = text;
      toastEl.style.display = 'block';
    }
    function hideToast() {
      if (toastEl) {
        toastEl.remove();
        toastEl = null;
      }
    }

    // ---------- Full page (scroll & stitch) capture ----------
    async function captureFullPage() {
      const dpr = window.devicePixelRatio || 1;
      const originalScrollX = window.scrollX;
      const originalScrollY = window.scrollY;
      const de = document.documentElement;
      const originalHtmlOverflow = de.style.overflow;
      const originalBodyOverflow = document.body ? document.body.style.overflow : '';

      const hiddenEls = [];
      document.querySelectorAll('body *').forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky') {
          hiddenEls.push([el, el.style.visibility]);
          el.style.visibility = 'hidden';
        }
      });
      de.style.overflow = 'hidden';

      showToast('Przygotowywanie zrzutu całej strony…');
      await sleep(150);

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const totalHeight = Math.max(
        de.scrollHeight,
        de.offsetHeight,
        document.body ? document.body.scrollHeight : 0,
        document.body ? document.body.offsetHeight : 0,
        viewportHeight
      );

      const positions = [];
      let y = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        positions.push(y);
        if (y + viewportHeight >= totalHeight) break;
        y = Math.min(y + viewportHeight, totalHeight - viewportHeight);
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewportWidth * dpr);
      canvas.height = Math.round(totalHeight * dpr);
      const ctx = canvas.getContext('2d');

      try {
        for (let i = 0; i < positions.length; i++) {
          const posY = positions[i];
          window.scrollTo(0, posY);
          showToast(`Robienie zrzutu strony… (${i + 1}/${positions.length})`);
          await sleep(420);
          const dataUrl = await requestVisibleCapture();
          const img = await loadImage(dataUrl);
          ctx.drawImage(img, 0, Math.round(posY * dpr));
        }
      } finally {
        window.scrollTo(originalScrollX, originalScrollY);
        de.style.overflow = originalHtmlOverflow;
        if (document.body) document.body.style.overflow = originalBodyOverflow;
        hiddenEls.forEach(([el, vis]) => {
          el.style.visibility = vis;
        });
      }

      showToast('Zapisywanie…');
      const finalDataUrl = canvas.toDataURL('image/png');
      hideToast();
      chrome.runtime.sendMessage({ type: 'full-page-captured', dataUrl: finalDataUrl });
    }

    // ---------- Area selection capture ----------
    function startSelection() {
      const overlay = document.createElement('div');
      overlay.className = 'zrzut-overlay';

      const hint = document.createElement('div');
      hint.className = 'zrzut-hint';
      hint.textContent = 'Przeciągnij, aby zaznaczyć fragment strony. Esc, aby anulować.';
      overlay.appendChild(hint);

      const box = document.createElement('div');
      box.className = 'zrzut-selection-box';
      box.style.display = 'none';
      overlay.appendChild(box);

      document.documentElement.appendChild(overlay);

      let startX = 0;
      let startY = 0;
      let dragging = false;

      function cleanup() {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown, true);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          cleanup();
        }
      }

      function updateBox(x1, y1, x2, y2) {
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
        box.style.display = 'block';
      }

      overlay.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        hint.style.display = 'none';
        updateBox(startX, startY, startX, startY);
        e.preventDefault();
      });

      overlay.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        updateBox(startX, startY, e.clientX, e.clientY);
      });

      overlay.addEventListener('mouseup', async (e) => {
        if (!dragging) return;
        dragging = false;
        const endX = e.clientX;
        const endY = e.clientY;
        const rect = {
          x: Math.max(0, Math.min(startX, endX)),
          y: Math.max(0, Math.min(startY, endY)),
          width: Math.abs(endX - startX),
          height: Math.abs(endY - startY),
        };

        if (rect.width < 6 || rect.height < 6) {
          cleanup();
          return;
        }

        overlay.style.visibility = 'hidden';
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        try {
          const dataUrl = await requestVisibleCapture();
          const img = await loadImage(dataUrl);
          const scaleX = img.naturalWidth / window.innerWidth;
          const scaleY = img.naturalHeight / window.innerHeight;

          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = Math.round(rect.width * scaleX);
          cropCanvas.height = Math.round(rect.height * scaleY);
          const ctx = cropCanvas.getContext('2d');
          ctx.drawImage(
            img,
            rect.x * scaleX,
            rect.y * scaleY,
            rect.width * scaleX,
            rect.height * scaleY,
            0,
            0,
            cropCanvas.width,
            cropCanvas.height
          );
          const croppedDataUrl = cropCanvas.toDataURL('image/png');
          chrome.runtime.sendMessage({ type: 'selection-captured', dataUrl: croppedDataUrl });
        } finally {
          cleanup();
        }
      });

      document.addEventListener('keydown', onKeyDown, true);
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'start-full-page-capture') {
        captureFullPage().catch((err) => {
          hideToast();
          console.error('Zrzut strony: błąd podczas robienia zrzutu całej strony', err);
        });
        sendResponse({ ok: true });
      } else if (message.type === 'start-selection') {
        startSelection();
        sendResponse({ ok: true });
      }
      return false;
    });
  })();
}
