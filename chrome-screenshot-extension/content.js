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

    function getPageHeight() {
      const de = document.documentElement;
      return Math.max(
        de.scrollHeight,
        de.offsetHeight,
        document.body ? document.body.scrollHeight : 0,
        document.body ? document.body.offsetHeight : 0,
        window.innerHeight
      );
    }

    // Sticky/fixed elements (e.g. sticky headers) would otherwise appear
    // repeated at every scroll step of a stitched capture, so they're
    // hidden for the duration of the capture and restored afterwards.
    function hideFixedStickyElements() {
      const hidden = [];
      document.querySelectorAll('body *').forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky') {
          hidden.push([el, el.style.visibility]);
          el.style.visibility = 'hidden';
        }
      });
      return hidden;
    }
    function restoreElements(hidden) {
      hidden.forEach(([el, vis]) => {
        el.style.visibility = vis;
      });
    }

    // ---------- Full page (scroll & stitch) capture ----------
    async function captureFullPage() {
      const dpr = window.devicePixelRatio || 1;
      const originalScrollX = window.scrollX;
      const originalScrollY = window.scrollY;
      const de = document.documentElement;
      const originalHtmlOverflow = de.style.overflow;
      const originalBodyOverflow = document.body ? document.body.style.overflow : '';

      const hiddenEls = hideFixedStickyElements();
      de.style.overflow = 'hidden';

      showToast('Przygotowywanie zrzutu całej strony…');
      await sleep(150);

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const totalHeight = getPageHeight();

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
        restoreElements(hiddenEls);
      }

      showToast('Zapisywanie…');
      const finalDataUrl = canvas.toDataURL('image/png');
      hideToast();
      chrome.runtime.sendMessage({ type: 'full-page-captured', dataUrl: finalDataUrl });
    }

    // Captures a page-absolute rectangle {left, top, right, bottom} that may be
    // taller than one viewport, scrolling and stitching frames as needed.
    async function captureSelectionRect(pageRect) {
      const dpr = window.devicePixelRatio || 1;
      const width = pageRect.right - pageRect.left;
      const height = pageRect.bottom - pageRect.top;
      const viewportHeight = window.innerHeight;
      const originalScrollX = window.scrollX;
      const originalScrollY = window.scrollY;
      const maxScrollY = Math.max(0, getPageHeight() - viewportHeight);

      if (height <= viewportHeight) {
        const targetScrollY = Math.min(Math.max(0, pageRect.top), maxScrollY);
        window.scrollTo(0, targetScrollY);
        await sleep(200);
        try {
          const dataUrl = await requestVisibleCapture();
          const img = await loadImage(dataUrl);
          const scaleX = img.naturalWidth / window.innerWidth;
          const scaleY = img.naturalHeight / window.innerHeight;
          const cropX = (pageRect.left - window.scrollX) * scaleX;
          const cropY = (pageRect.top - window.scrollY) * scaleY;
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = Math.round(width * scaleX);
          cropCanvas.height = Math.round(height * scaleY);
          const ctx = cropCanvas.getContext('2d');
          ctx.drawImage(img, cropX, cropY, width * scaleX, height * scaleY, 0, 0, cropCanvas.width, cropCanvas.height);
          return cropCanvas.toDataURL('image/png');
        } finally {
          window.scrollTo(originalScrollX, originalScrollY);
        }
      }

      // Selection taller than one viewport: scroll & stitch, limited to the
      // selected vertical range (same technique as the full-page capture).
      const hiddenEls = hideFixedStickyElements();
      try {
        const positions = [];
        let y = Math.min(pageRect.top, maxScrollY);
        // eslint-disable-next-line no-constant-condition
        while (true) {
          positions.push(y);
          if (y + viewportHeight >= pageRect.bottom) break;
          const next = Math.min(y + viewportHeight, maxScrollY);
          if (next === y) break;
          y = next;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        const ctx = canvas.getContext('2d');

        for (let i = 0; i < positions.length; i++) {
          const scrollY = positions[i];
          window.scrollTo(0, scrollY);
          showToast(`Robienie zrzutu zaznaczenia… (${i + 1}/${positions.length})`);
          await sleep(420);
          const dataUrl = await requestVisibleCapture();
          const img = await loadImage(dataUrl);
          const scaleX = img.naturalWidth / window.innerWidth;
          const scaleY = img.naturalHeight / window.innerHeight;

          const frameTop = window.scrollY;
          const frameBottom = frameTop + window.innerHeight;
          const visTop = Math.max(frameTop, pageRect.top);
          const visBottom = Math.min(frameBottom, pageRect.bottom);
          if (visBottom <= visTop) continue;

          const srcX = pageRect.left * scaleX;
          const srcY = (visTop - frameTop) * scaleY;
          const srcW = width * scaleX;
          const srcH = (visBottom - visTop) * scaleY;
          const destY = Math.round((visTop - pageRect.top) * dpr);
          const destH = Math.round((visBottom - visTop) * dpr);
          ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, destY, canvas.width, destH);
        }

        hideToast();
        return canvas.toDataURL('image/png');
      } finally {
        window.scrollTo(originalScrollX, originalScrollY);
        restoreElements(hiddenEls);
      }
    }

    // ---------- Area selection capture ----------
    function startSelection() {
      const overlay = document.createElement('div');
      overlay.className = 'zrzut-overlay';

      const hint = document.createElement('div');
      hint.className = 'zrzut-hint';
      hint.textContent = 'Przeciągnij, aby zaznaczyć fragment strony (podjedź do krawędzi, aby przewinąć). Esc, aby anulować.';
      overlay.appendChild(hint);

      const box = document.createElement('div');
      box.className = 'zrzut-selection-box';
      box.style.display = 'none';
      overlay.appendChild(box);

      document.documentElement.appendChild(overlay);

      const EDGE_MARGIN = 56; // px from top/bottom edge that triggers auto-scroll
      const MAX_SPEED = 22; // px per animation frame at the very edge

      let startPageX = 0;
      let startPageY = 0;
      let lastClientX = 0;
      let lastClientY = 0;
      let dragging = false;
      let autoScrollHandle = null;

      function cleanup() {
        if (autoScrollHandle) cancelAnimationFrame(autoScrollHandle);
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown, true);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          cleanup();
        }
      }

      function currentPageRect() {
        const curX = lastClientX + window.scrollX;
        const curY = lastClientY + window.scrollY;
        return {
          left: Math.min(startPageX, curX),
          top: Math.min(startPageY, curY),
          right: Math.max(startPageX, curX),
          bottom: Math.max(startPageY, curY),
        };
      }

      // The box is drawn using the *current* scroll position each time, so
      // it visually stays anchored to the page content while the page
      // scrolls underneath it (rather than to the viewport).
      function renderBox() {
        const r = currentPageRect();
        box.style.left = `${r.left - window.scrollX}px`;
        box.style.top = `${r.top - window.scrollY}px`;
        box.style.width = `${r.right - r.left}px`;
        box.style.height = `${r.bottom - r.top}px`;
        box.style.display = 'block';
      }

      function autoScrollTick() {
        if (!dragging) {
          autoScrollHandle = null;
          return;
        }
        let dy = 0;
        if (lastClientY < EDGE_MARGIN) {
          dy = -MAX_SPEED * (1 - lastClientY / EDGE_MARGIN);
        } else if (lastClientY > window.innerHeight - EDGE_MARGIN) {
          dy = MAX_SPEED * (1 - (window.innerHeight - lastClientY) / EDGE_MARGIN);
        }
        if (dy !== 0) window.scrollBy(0, dy);
        renderBox();
        autoScrollHandle = requestAnimationFrame(autoScrollTick);
      }

      // Scrolling the page (wheel, keyboard, etc.) while a selection is in
      // progress is never blocked — this listener only keeps the box in
      // sync with the new scroll position.
      window.addEventListener(
        'scroll',
        () => {
          if (dragging) renderBox();
        },
        { passive: true }
      );

      overlay.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        dragging = true;
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        startPageX = e.clientX + window.scrollX;
        startPageY = e.clientY + window.scrollY;
        hint.style.display = 'none';
        renderBox();
        autoScrollHandle = requestAnimationFrame(autoScrollTick);
        e.preventDefault();
      });

      overlay.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        renderBox();
      });

      overlay.addEventListener('mouseup', async (e) => {
        if (!dragging) return;
        dragging = false;
        if (autoScrollHandle) {
          cancelAnimationFrame(autoScrollHandle);
          autoScrollHandle = null;
        }
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        const pageRect = currentPageRect();
        const width = pageRect.right - pageRect.left;
        const height = pageRect.bottom - pageRect.top;

        if (width < 6 || height < 6) {
          cleanup();
          return;
        }

        overlay.style.visibility = 'hidden';
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        try {
          const croppedDataUrl = await captureSelectionRect(pageRect);
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
