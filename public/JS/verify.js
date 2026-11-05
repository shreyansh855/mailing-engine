/**
 * verify.js
 * ─────────
 * Drop this script (via <script src="JS/verify.js" defer></script>) at the top
 * of EVERY page that requires a valid login session (e.g. sendGmail.html).
 *
 * It checks sessionStorage for a well-formed UUID sessionId and immediately
 * redirects back to login.html if the check fails.
 */
(function (e) {
  function checkSession() {
    var sessionId = e.sessionStorage.getItem("sessionId");
    var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!sessionId || !uuidRegex.test(sessionId)) {
      window.location.href = "login.html";
      return; // Guard: stop further execution after redirect
    }
  }

  e.onload = checkSession;
})(this);

