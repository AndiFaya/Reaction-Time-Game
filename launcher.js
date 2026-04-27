//Cookie Helpers

/**
 * Store cookie with a given name, value, and the days until it expires
 * @param {string} name
 * @param {string} value
 * @param {number} days
 */
function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
}

/**
 * Retrieve a cookie value by name
 * @param {string} name  identifier
 * @returns {string|null} The cookie value, or null if not found
 */
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

/**
 * @returns {Object} Current form settings
 */
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

/**
 * @param {Object} settings  Settings to apply
 */
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

/**
 * Validate settings and return an error, or empty string if valid
 * String methods for name validation
 * @param {Object} settings 
 * @returns {string}
 */
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

/** 
 * formatted preview string from the current settings
 * @param {Object} settings
 * @returns {string}
 */
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

//Liv Preview

function updatePreview() {
    var settings = gatherSettings();
    var previewEl = document.getElementById("previewText");
    previewEl.textContent = buildPreviewText(settings);
    previewEl.style.whiteSpace = "pre-line";
}


//Save/ load / reset settings (localStorage)
function saveSettings() {
    var settings = gatherSettings();
    var error = validateSettings(settings);
    if (error) {
        alert(error);
        return;
    }
    localStorage.setItem("reactionTester_settings", JSON.stringify(settings));
    setCookie("reactionTester_playerName", settings.playerName, 30);
    alert("Settings saved successfully!");
}

//return settings from localStorage into the form
function loadSettings() {
    var stored = localStorage.getItem("reactionTester_settings");
    if (!stored) {
        alert("No saved settings found.");
        return;
    }
    var settings = JSON.parse(stored);
    applySettings(settings);
    updatePreview();
    alert("Settings loaded successfully!");
}

//Reset all form fields to their defaults after user confirmation
function resetSettings() {
    var confirmed = confirm("Are you sure you want to reset all settings to their defaults?");
    if (!confirmed) return;

    applySettings({
        playerName: "",
        difficulty: "medium",
        roundCount: 8,
        signalType: "click",
        soundEnabled: true,
        falseStartPenalty: true,
        showAverage: true
    });
    updatePreview();
    alert("Settings have been reset.");
}


//Open Game Window

function openGameWindow() {
    var settings = gatherSettings();

    // if the player name field is empty
    if (!settings.playerName) {
        var name = prompt("Please enter your player name to start the game:");
        if (!name || name.trim().length < 2) {
            alert("A valid player name (at least 2 characters) is required.");
            return;
        }
        settings.playerName = name.trim().substring(0, 20);
        document.getElementById("playerName").value = settings.playerName;
    }

    var error = validateSettings(settings);
    if (error) {
        alert(error);
        return;
    }

    //Passing settings to the game window via sessionStorage
    sessionStorage.setItem("reactionTester_gameSettings", JSON.stringify(settings));

    // Storeing player name and best score in cookies
    setCookie("reactionTester_playerName", settings.playerName, 30);
    var existingBest = getCookie("reactionTester_bestScore");
    if (!existingBest) {
        setCookie("reactionTester_bestScore", "0", 30);
    }

    // Open game in a separate window
    var gameWindow = window.open(
        "game.html",
        "ReactionTimeGame",
        "width=1050,height=920,scrollbars=yes,resizable=yes"
    );

    if (!gameWindow || gameWindow.closed) {
        alert("The game window could not be opened. Please allow pop-ups for this site.");
    }
}


//Link to Instructions Page

function openInstructions() {
    window.location.href = "instructions.html";
}

//Initialization

//Restore the previously saved player name
function init() {
    var savedName = getCookie("reactionTester_playerName");
    if (savedName) {
        document.getElementById("playerName").value = savedName;
    }

    // live preview as user types their name
    document.getElementById("playerName").addEventListener("input", updatePreview);

    // live preview when dropdowns or radios change
    document.getElementById("difficulty").addEventListener("change", updatePreview);
    document.getElementById("roundCount").addEventListener("change", updatePreview);

    var signalRadios = document.querySelectorAll('input[name="signalType"]');
    for (var i = 0; i < signalRadios.length; i++) {
        signalRadios[i].addEventListener("change", updatePreview);
    }

    // change events on checkboxes for live preview
    document.getElementById("soundEnabled").addEventListener("change", updatePreview);
    document.getElementById("falseStartPenalty").addEventListener("change", updatePreview);
    document.getElementById("showAverage").addEventListener("change", updatePreview);

    //Prevent default reload, open game instead
    document.getElementById("setupForm").addEventListener("submit", function(event) {
        event.preventDefault();
        openGameWindow();
    });

    // click events on all action buttons
    document.getElementById("openGameBtn").addEventListener("click", openGameWindow);
    document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
    document.getElementById("loadSettingsBtn").addEventListener("click", loadSettings);
    document.getElementById("resetSettingsBtn").addEventListener("click", resetSettings);
    document.getElementById("instructionsBtn").addEventListener("click", openInstructions);

    // Render initial preview
    updatePreview();
}

document.addEventListener("DOMContentLoaded", init);