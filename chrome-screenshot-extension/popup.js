const warningEl = document.getElementById('warning');
const btnFullPage = document.getElementById('btn-full-page');
const btnSelection = document.getElementById('btn-selection');
const btnVisible = document.getElementById('btn-visible');
const btnLast = document.getElementById('btn-last');
const versionEl = document.getElementById('version');

versionEl.textContent = `Wersja ${chrome.runtime.getManifest().version}`;

function sendMessage(type) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, (res) => resolve(res));
  });
}

async function init() {
  const check = await sendMessage('check-active-tab');
  if (check && check.ok && !check.capturable) {
    warningEl.textContent = 'Ta strona jest chroniona przez przeglądarkę i nie można jej zrzucić.';
    warningEl.hidden = false;
    [btnFullPage, btnSelection, btnVisible].forEach((b) => (b.disabled = true));
  }

  const last = await sendMessage('get-last-capture');
  if (last && last.ok && last.data) {
    btnLast.hidden = false;
  }
}

btnFullPage.addEventListener('click', async () => {
  const res = await sendMessage('popup-capture-full-page');
  if (!res || !res.ok) return alert(res && res.error ? res.error : 'Nie udało się rozpocząć zrzutu.');
  window.close();
});

btnSelection.addEventListener('click', async () => {
  const res = await sendMessage('popup-capture-selection');
  if (!res || !res.ok) return alert(res && res.error ? res.error : 'Nie udało się rozpocząć zrzutu.');
  window.close();
});

btnVisible.addEventListener('click', async () => {
  const res = await sendMessage('popup-capture-visible');
  if (!res || !res.ok) return alert(res && res.error ? res.error : 'Nie udało się wykonać zrzutu.');
  window.close();
});

btnLast.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('result.html') });
  window.close();
});

init();
