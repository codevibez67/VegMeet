(function () {
  const threadEl = document.getElementById('thread');
  const phoneLabelEl = document.getElementById('phoneLabel');
  const inputPreviewEl = document.getElementById('inputPreview');
  const newSessionBtn = document.getElementById('newSessionBtn');
  const keypad = document.getElementById('keypad');

  let currentPhone = null;
  let buffer = '';

  function renderPreview() {
    inputPreviewEl.textContent = buffer.length ? buffer : ' ';
  }

  function addBubble(text, direction) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + direction;
    bubble.textContent = text;
    threadEl.appendChild(bubble);
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  async function startNewSession() {
    threadEl.innerHTML = '';
    buffer = '';
    renderPreview();
    const res = await fetch('/api/session', { method: 'POST' });
    const data = await res.json();
    currentPhone = data.phone;
    phoneLabelEl.textContent = data.phone;
    addBubble(data.message, 'incoming');
  }

  async function sendInput() {
    if (!currentPhone || !buffer.length) return;
    const digitsSent = buffer;
    addBubble(digitsSent, 'outgoing');
    buffer = '';
    renderPreview();
    try {
      const res = await fetch('/api/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentPhone, digit: digitsSent }),
      });
      const data = await res.json();
      if (data.message) addBubble(data.message, 'incoming');
    } catch (err) {
      addBubble('Network error. Please try again.', 'incoming');
    }
  }

  keypad.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.action === 'clear') {
      buffer = '';
      renderPreview();
      return;
    }
    if (btn.dataset.action === 'send') {
      sendInput();
      return;
    }
    if (btn.dataset.key !== undefined) {
      buffer += btn.dataset.key;
      renderPreview();
    }
  });

  newSessionBtn.addEventListener('click', startNewSession);

  // Auto-start the first conversation on page load.
  startNewSession();
})();
