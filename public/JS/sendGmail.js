const emailRegex = /^(?!.*\.\.)(?!\.)[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/* ── Greet on load ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) return;
});

/* ── Theme toggle ───────────────────────────────────────── */
const toggleThemeBtn = document.getElementById('toggleTheme');
const body = document.body;

// Restore saved theme
if (localStorage.getItem('theme') === 'dark') {
  body.classList.replace('light', 'dark');
  toggleThemeBtn.textContent = '☀️ Light';
} else {
  body.classList.add('light');
  toggleThemeBtn.textContent = '🌙 Dark';
}

toggleThemeBtn.addEventListener('click', () => {
  if (body.classList.contains('light')) {
    body.classList.replace('light', 'dark');
    localStorage.setItem('theme', 'dark');
    toggleThemeBtn.textContent = '☀️ Light';
  } else {
    body.classList.replace('dark', 'light');
    localStorage.setItem('theme', 'light');
    toggleThemeBtn.textContent = '🌙 Dark';
  }
});

/* ── Mail counter ───────────────────────────────────────── */
function updateMailCount() {
  const textarea  = document.getElementById('eMails');
  const cntSpan   = document.getElementById('mailCnt');
  const warnSpan  = document.getElementById('mailWarn');

  const validEmails = textarea.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l !== '')
    .filter(e => emailRegex.test(e));

  cntSpan.textContent = validEmails.length;

  if (validEmails.length > 30) {
    cntSpan.style.color = 'red';
    warnSpan.textContent = ' (max 30)';
  } else {
    cntSpan.style.color = '';
    warnSpan.textContent = '';
  }
}

/* ── Form submission ────────────────────────────────────── */
document.getElementById('emailForm').addEventListener('submit', function (event) {
  event.preventDefault();
  validate();
});

function validate() {
  const submitBtn    = document.getElementById('submitButton');
  const sentFromVal  = document.getElementById('sentFrom').value;
  const appPassInput = document.getElementById('appPass');
  const emailTA      = document.getElementById('eMails');
  const isEditor     = document.getElementById('editor').checked;

  /* ── Read iframe body ── */
  let bodyText = '';
  let bodyHTML = '';

  try {
    const iframe     = document.getElementById('bodyFrame');
    const iframeDoc  = iframe.contentDocument || iframe.contentWindow.document;
    const bodyEl     = iframeDoc.getElementById('editedText');

    if (bodyEl) {
      bodyText = bodyEl.innerText || bodyEl.textContent;
      bodyHTML = bodyEl.innerHTML;
    } else {
      console.error("Element #editedText not found inside iframe.");
    }
  } catch (err) {
    console.error('Error accessing iframe content:', err);
  }

  /* ── Valid emails ── */
  const validEmails = emailTA.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l !== '')
    .filter(e => emailRegex.test(e));

  /* ── App password normalisation ── */
  let trimmedAppPass = appPassInput.value.trim().replace(/\s/g, '');
  const formattedAppPass = trimmedAppPass.match(/.{1,4}/g)
    ? trimmedAppPass.match(/.{1,4}/g).join(' ')
    : '';

  const wordCount = bodyHTML.split(/\s+/).length;

  /* ── Validations ── */
  if (validEmails.length > 30) {
    alert('Please enter less than 31 recipients.');
    return;
  }
  if (!emailRegex.test(sentFromVal)) {
    alert('Invalid "Sent From" email format.');
    return;
  }
  if (wordCount > 10000) {
    alert('Body cannot contain more than 10 000 words.');
    return;
  }
  if (trimmedAppPass.length !== 16 || !/^[a-z]+$/.test(trimmedAppPass)) {
    alert('Invalid app password: must be 16 lowercase letters.');
    return;
  }
  if (validEmails.length === 0) {
    alert('Enter at least 1 valid recipient.');
    return;
  }

  /* ── Submit ── */
  submitBtn.disabled = true;
  submitBtn.value = 'Sending.';
  submitBtn.style.backgroundColor = '#0400ff';

  // Update UI fields with normalised values
  appPassInput.value = formattedAppPass;
  emailTA.value = validEmails.join('\n');

  const payload = {
    sentFrom:       document.getElementById('sentFrom').value,
    appPass:        formattedAppPass,
    subject:        document.getElementById('subject').value,
    htmlBody:       isEditor ? bodyHTML : undefined,   // only when editor enabled
    realBody:       bodyText,
    eMails:         validEmails,
    firstName:      document.getElementById('firstName').value,
    sessionId:      sessionStorage.getItem('sessionId'),
    isPort587:      document.getElementById('port').checked,
    isHTML:         isEditor,
    isEditor:       isEditor,
    addGreetings:   document.getElementById('addGreetings').checked,
    addClosing:     document.getElementById('addClosing').checked,
    addSuggestions: document.getElementById('addSuggestions').checked,
    shouldDelay:    document.getElementById('shouldDelay').checked
  };

  // Remove htmlBody key entirely if not needed (cleaner payload)
  if (!isEditor) delete payload.htmlBody;

  // Step 1: kick off the job — server responds instantly with a jobId
  fetch('/sendGmail', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  })
    .then(r => r.json())
    .then(data => {
      if (!data.jobId) {
        // Server returned an immediate error (auth, limit, etc.) — show it
        const msg = data.message || JSON.stringify(data);
        alert('Error: ' + msg);
        resetButton();
        return;
      }
      // Step 2: server accepted the job, start polling
      pollJobStatus(data.jobId, submitBtn);
    })
    .catch(err => {
      console.error('Error submitting job:', err);
      alert('Error: ' + (err.message || 'Could not reach the server.'));
      resetButton();
    });
}

// ── Polls /jobStatus/:jobId every 10 s until done ────────────────────────────
function pollJobStatus(jobId, submitBtn) {
  const MAX_WAIT_MS  = 8 * 60 * 1000; // 8 minutes hard ceiling
  const INTERVAL_MS  = 10 * 1000;     // poll every 10 s
  const startedAt    = Date.now();
  let   dots         = 0;

  const timerId = setInterval(async () => {
    // Hard timeout guard
    if (Date.now() - startedAt > MAX_WAIT_MS) {
      clearInterval(timerId);
      alert('Timed out waiting for a result after 8 minutes.\nEmails may still have been sent — check your inbox before retrying.');
      resetButton();
      return;
    }

    // Animate the button so the user knows it's still working
    dots = (dots + 1) % 4;
    submitBtn.value = 'Sending' + '.'.repeat(dots + 1);

    try {
      const r    = await fetch('/jobStatus/' + jobId);
      const data = await r.json();

      if (data.status === 'pending') return; // still running — wait for next tick

      // Job finished (done or error from server)
      clearInterval(timerId);

      if (data.message && (data.sent !== undefined || data.failed !== undefined)) {
        const detail = `Sent: ${data.sent ?? '-'} | Failed: ${data.failed ?? '-'} | Total: ${data.totalRequested ?? '-'}`;
        alert(data.message + '\n' + detail);
      } else {
        alert(data.message || JSON.stringify(data));
      }

      resetButton();

    } catch (err) {
      // Network blip — don't stop polling, just log
      console.warn('Poll error (will retry):', err.message);
    }
  }, INTERVAL_MS);

  function resetButton() {
    submitBtn.disabled = false;
    submitBtn.value = 'Send Emails';
    submitBtn.style.backgroundColor = '';
  }
}
