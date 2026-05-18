//Cookie Helpers

function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
}

function getCookie(name) {
    var nameEq = name + "=";
    var decoded = decodeURIComponent(document.cookie);
    var pairs = decoded.split("; ");
    for (var i = 0; i < pairs.length; i++) {
        if (pairs[i].indexOf(nameEq) === 0) {
            return pairs[i].substring(nameEq.length);
        }
    }
    return null;
}


// Settings Object Construction

function gatherSettings() {
    return {
        playerName: document.getElementById("playerName").value.trim(),
        difficulty: document.getElementById("difficulty").value,
        roundCount: parseInt(document.getElementById("roundCount").value, 10),
        signalType: document.querySelector('input[name="signalType"]:checked').value,
        soundEnabled: document.getElementById("soundEnabled").checked,
        falseStartPenalty: document.getElementById("falseStartPenalty").checked,
        showAverage: document.getElementById("showAverage").checked
    };
}

function applySettings(settings) {
    document.getElementById("playerName").value = settings.playerName || "";
    document.getElementById("difficulty").value = settings.difficulty || "medium";
    document.getElementById("roundCount").value = String(settings.roundCount || 8);

    var radio = document.querySelector(
        'input[name="signalType"][value="' + (settings.signalType || "click") + '"]'
    );
    if (radio) radio.checked = true;

    document.getElementById("soundEnabled").checked = settings.soundEnabled !== false;
    document.getElementById("falseStartPenalty").checked = settings.falseStartPenalty !== false;
    document.getElementById("showAverage").checked = settings.showAverage !== false;
}

function validateSettings(settings) {
    var name = settings.playerName;
    if (!name) {
        return "Player name is required.";
    }
    if (name.length < 2) {
        return "Player name must be at least 2 characters long.";
    }
    if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
        return "Player name may only contain letters, numbers, spaces, hyphens, and underscores.";
    }
    return "";
}

function buildPreviewText(settings) {
    var lines = [];
    lines.push("Player: " + (settings.playerName || "(not set)"));
    lines.push("Difficulty: " + settings.difficulty.charAt(0).toUpperCase() + settings.difficulty.slice(1));
    lines.push("Rounds: " + settings.roundCount);
    lines.push("Signal: " + settings.signalType.charAt(0).toUpperCase() + settings.signalType.slice(1));

    var options = [];
    if (settings.soundEnabled) options.push("Sound");
    if (settings.falseStartPenalty) options.push("False-start penalty");
    if (settings.showAverage) options.push("Show average");
    lines.push("Options: " + (options.length > 0 ? options.join(", ") : "None"));
    return lines.join("\n");
}

// Live Preview
function updatePreview() {
    var settings = gatherSettings();
    var previewEl = document.getElementById("previewText");
    previewEl.textContent = buildPreviewText(settings);
    previewEl.style.whiteSpace = "pre-line";
}


// Save / Load / Reset (localStorage)
function saveSettings() {
    var settings = gatherSettings();
    var error = validateSettings(settings);
    if (error) { alert(error); return; }
    localStorage.setItem("reactionTester_settings", JSON.stringify(settings));
    setCookie("reactionTester_playerName", settings.playerName, 30);
    alert("Settings saved successfully!");
}

function loadSettings() {
    var stored = localStorage.getItem("reactionTester_settings");
    if (!stored) { alert("No saved settings found."); return; }
    var settings = JSON.parse(stored);
    applySettings(settings);
    updatePreview();
    alert("Settings loaded successfully!");
}

function resetSettings() {
    var confirmed = confirm("Are you sure you want to reset all settings to their defaults?");
    if (!confirmed) return;
    applySettings({
        playerName: "", difficulty: "medium", roundCount: 8,
        signalType: "click", soundEnabled: true,
        falseStartPenalty: true, showAverage: true
    });
    updatePreview();
    alert("Settings have been reset.");
}


// Open Game Window
function openGameWindow() {
    var settings = gatherSettings();

    if (!settings.playerName) {
        var nameField = document.getElementById("playerName");
        nameField.focus();
        nameField.style.borderColor = "#e74c3c";
        nameField.style.boxShadow  = "0 0 0 3px rgba(231,76,60,0.25)";
        setTimeout(function () {
            nameField.style.borderColor = "";
            nameField.style.boxShadow  = "";
        }, 2000);
        alert("Please enter your Player Name before starting the game.");
        return;
    }

    var error = validateSettings(settings);
    if (error) { alert(error); return; }

    sessionStorage.setItem("reactionTester_gameSettings", JSON.stringify(settings));
    setCookie("reactionTester_playerName", settings.playerName, 30);
    var existingBest = getCookie("reactionTester_bestScore");
    if (!existingBest) { setCookie("reactionTester_bestScore", "0", 30); }

    var gameWindow = window.open(
        "game.html", "ReactionTimeGame",
        "width=1050,height=920,scrollbars=yes,resizable=yes"
    );

    if (!gameWindow || gameWindow.closed) {
        alert("The game window could not be opened. Please allow pop-ups for this site.");
    }
}

function openInstructions() {
    window.location.href = "instructions.html";
}


// Initialization
function init() {

    //Change 4 (relocated): Show the How-to-Play overlay automatically when the launcher page (index.html) first loads.
    //Previously this overlay appeared inside game.html, meaning players saw it only after the game window had already opened so they had no chance to set up their session first.

    //It now appears on index.html as follows:
    //   1. Overlay shown on launcher page
    //   2. Player will dismiss overlayand lands on settings form
    //   3. Player enters name & configures settings
    //   4. Player clicks Start Game which opens the game window (no overlay there)

    //The overlay is only shown once per browser session (sessionStorage).
    var overlayEl       = document.getElementById("howToPlayOverlay");
    var overlayBtn      = document.getElementById("overlayStartBtn");
    var alreadySeen     = sessionStorage.getItem("reactionTester_overlayDismissed");

    if (!alreadySeen && overlayEl) {
        overlayEl.classList.remove("hidden");

        overlayBtn.addEventListener("click", function dismissOverlay() {
            overlayEl.classList.add("hidden");
            sessionStorage.setItem("reactionTester_overlayDismissed", "1");
            document.getElementById("playerName").focus();
            overlayBtn.removeEventListener("click", dismissOverlay);
        });
    } else if (overlayEl) {
        overlayEl.classList.add("hidden");
    }
    //End Change 4

    // Restore previously saved player name from cookie
    var savedName = getCookie("reactionTester_playerName");
    if (savedName) {
        document.getElementById("playerName").value = savedName;
    }

    // Live preview listeners
    document.getElementById("playerName").addEventListener("input", updatePreview);
    document.getElementById("difficulty").addEventListener("change", updatePreview);
    document.getElementById("roundCount").addEventListener("change", updatePreview);

    var signalRadios = document.querySelectorAll('input[name="signalType"]');
    for (var i = 0; i < signalRadios.length; i++) {
        signalRadios[i].addEventListener("change", updatePreview);
    }
    document.getElementById("soundEnabled").addEventListener("change", updatePreview);
    document.getElementById("falseStartPenalty").addEventListener("change", updatePreview);
    document.getElementById("showAverage").addEventListener("change", updatePreview);

    //Change 1: Prevent Enter key in the player name field from submitting the form and launching the game window too early.
    //Now, Enter moves focus to the next field (difficulty).
    document.getElementById("playerName").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            document.getElementById("difficulty").focus();
        }
    });

    document.getElementById("setupForm").addEventListener("submit", function (event) {
        event.preventDefault();
        // Only launch if the real Start Game button triggered the submit
        if (event.submitter && event.submitter.id === "openGameBtn") {
            openGameWindow();
        }
    });
    //End Change 1

    document.getElementById("openGameBtn").addEventListener("click", openGameWindow);
    document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
    document.getElementById("loadSettingsBtn").addEventListener("click", loadSettings);
    document.getElementById("resetSettingsBtn").addEventListener("click", resetSettings);
    document.getElementById("instructionsBtn").addEventListener("click", openInstructions);

    updatePreview();
}

document.addEventListener("DOMContentLoaded", init);
