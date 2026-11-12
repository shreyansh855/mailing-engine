(function (e) {
  e.onload = function () {

    e.sessionStorage.removeItem("sessionId");

    var usernameInput = document.getElementById("username");
    var passwordInput = document.getElementById("password");

    var usernameError = document.getElementById("usernameError");
    var passwordError = document.getElementById("passwordError");

    var usernameCount = document.getElementById("usernameCount");
    var passwordCount = document.getElementById("passwordCount");

    var togglePassword = document.getElementById("togglePassword");

    var submitButton = document.getElementById("submitButton");
    var alertBanner = document.getElementById("alertBanner");

    function showAlert(message, type) {
      if (!alertBanner) return;
      alertBanner.textContent = message;
      alertBanner.className = type;
    }

    function clearAlert() {
      alertBanner.textContent = "";
      alertBanner.className = "";
    }

    function resetButton() {
      submitButton.disabled = false;
      submitButton.value = "Sign In";
    }

    // ✅ Live character count (TRIMMED)
    function updateCounts() {
      const u = usernameInput.value.trim();
      const p = passwordInput.value.trim();

      usernameCount.textContent = `Length: ${u.length}/10`;
      passwordCount.textContent = `Length: ${p.length}/16`;
    }

    usernameInput.addEventListener("input", updateCounts);
    passwordInput.addEventListener("input", updateCounts);

    // ✅ Toggle password visibility
    togglePassword.addEventListener("click", function () {
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        togglePassword.textContent = "Hide";
      } else {
        passwordInput.type = "password";
        togglePassword.textContent = "Show";
      }
    });

    submitButton.addEventListener("click", function (event) {
      event.preventDefault();

      var username = usernameInput.value.trim();
      var password = passwordInput.value.trim();

      usernameError.textContent = "";
      passwordError.textContent = "";
      clearAlert();

      if (username.length !== 10) {
        usernameError.textContent = "Username must be exactly 10 characters.";
        return;
      }

      if (password.length !== 16) {
        passwordError.textContent = "Password must be exactly 16 characters.";
        return;
      }

      submitButton.disabled = true;
      submitButton.value = "Signing in…";

      fetch("/loginForm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: username, password: password })
      })
        .then(res => res.json())
        .then(function (data) {
          if (data.sessionId) {
            e.sessionStorage.setItem("sessionId", data.sessionId);
            if (data.name) e.sessionStorage.setItem("name", data.name);

            showAlert(data.message || "Login successful!", "success");

            setTimeout(() => {
              window.location.href = "sendGmail.html";
            }, 600);
          } else {
            showAlert(data.message || "Login failed", "error");
            resetButton();
          }
        })
        .catch(function (err) {
          console.error(err);
          showAlert("Something went wrong", "error");
          resetButton();
        });
    });

    updateCounts(); // initial
  };
})(this);
