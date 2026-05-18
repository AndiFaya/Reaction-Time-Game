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

//Sound Helpers

var audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function playTone(frequency, durationMs, waveType) {
    var ctx = getAudioContext();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = waveType || "sine";
    osc.frequency.value = frequency;
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.stop(ctx.currentTime + durationMs / 1000);
}

function playSignalSound()    { playTone(880, 200, "sine"); }
function playFalseStartSound(){ playTone(220, 400, "square"); }
function playGameOverSound() {
    playTone(660, 150, "sine");
    setTimeout(function () { playTone(880, 150, "sine"); }, 200);
    setTimeout(function () { playTone(1100, 300, "sine"); }, 400);
}


// Difficulty config

var difficultyConfig = {
    easy:   { minDelay: 2000, maxDelay: 5000 },
    medium: { minDelay: 1000, maxDelay: 4000 },
    hard:   { minDelay: 500,  maxDelay: 3000 }
};

// Game State

var gameState = {
    playerName: "", difficulty: "medium", roundCount: 8,
    signalType: "click", soundEnabled: true,
    falseStartPenalty: true, showAverage: true,
    currentRound: 0, totalScore: 0, falseStarts: 0,
    reactionTimes: [], bestTime: Infinity,
    phase: "idle",
    signalTimestamp: 0,
    waitTimeoutId: null,
    currentRoundSignalType: "click",
    //Change 2: track the auto-advance timer
    autoAdvanceTimeoutId: null
};

var gameLog = [];

function addLogEntry(message) {
    gameLog.push({ time: new Date().toLocaleTimeString(), round: gameState.currentRound, message: message });
    renderLog();
}

function renderLog() {
    var html = "";
    for (var i = gameLog.length - 1; i >= 0; i--) {
        var e = gameLog[i];
        html += "<div class=\"log-entry\">[" + e.time + "] R" + e.round + ": " + e.message + "</div>";
    }
    dom.logArea.innerHTML = html;
}

// DOM cache

var dom = {};

function cacheDomElements() {
    dom.startBtn        = document.getElementById("startBtn");
    dom.nextRoundBtn    = document.getElementById("nextRoundBtn");
    dom.saveBtn         = document.getElementById("saveBtn");
    dom.loadBtn         = document.getElementById("loadBtn");
    dom.resetBtn        = document.getElementById("resetBtn");
    dom.backBtn         = document.getElementById("backBtn");
    dom.displayPlayer   = document.getElementById("displayPlayer");
    dom.displayRound    = document.getElementById("displayRound");
    dom.displayScore    = document.getElementById("displayScore");
    dom.displayBestTime = document.getElementById("displayBestTime");
    dom.displayAverageTime  = document.getElementById("displayAverageTime");
    dom.displayFalseStarts  = document.getElementById("displayFalseStarts");
    dom.ruleArea        = document.getElementById("ruleArea");
    dom.messageArea     = document.getElementById("messageArea");
    dom.signalArea      = document.getElementById("signalArea");
    dom.resultsArea     = document.getElementById("resultsArea");
    dom.logArea         = document.getElementById("logArea");
    //Change 3: game-over banner elements
    dom.gameOverBanner  = document.getElementById("gameOverBanner");
    dom.gameOverSummary = document.getElementById("gameOverSummary");
    dom.gameOverCloseBtn= document.getElementById("gameOverCloseBtn");
    //End Change 3
}


// UI helpers

function updateStatsDisplay() {
    dom.displayPlayer.textContent = gameState.playerName;
    dom.displayRound.textContent  = gameState.currentRound + " / " + gameState.roundCount;
    dom.displayScore.textContent  = gameState.totalScore;
    dom.displayFalseStarts.textContent = gameState.falseStarts;
    dom.displayBestTime.textContent = gameState.bestTime < Infinity
        ? gameState.bestTime + " ms" : "-";
    if (gameState.showAverage && gameState.reactionTimes.length > 0) {
        var sum = 0;
        for (var i = 0; i < gameState.reactionTimes.length; i++) sum += gameState.reactionTimes[i];
        dom.displayAverageTime.textContent = Math.round(sum / gameState.reactionTimes.length) + " ms";
    } else {
        dom.displayAverageTime.textContent = "-";
    }
}

function updateResultsDisplay() {
    if (gameState.reactionTimes.length === 0) { dom.resultsArea.textContent = "No results yet."; return; }
    var lines = [];
    for (var i = 0; i < gameState.reactionTimes.length; i++) {
        lines.push("Round " + (i + 1) + ": " + gameState.reactionTimes[i] + " ms");
    }
    if (gameState.falseStarts > 0) lines.push("\nFalse starts: " + gameState.falseStarts);
    dom.resultsArea.textContent = lines.join("\n");
}

function setSignalArea(className, text) {
    dom.signalArea.className = "signal-area " + className;
    dom.signalArea.textContent = text;
}

function updateButtonStates() {
    var p = gameState.phase;
    dom.startBtn.disabled     = (p !== "idle" && p !== "finished");
    dom.nextRoundBtn.disabled = (p !== "reacted" && p !== "falsestart");
    dom.saveBtn.disabled      = (p === "idle");
    dom.loadBtn.disabled      = (p === "waiting" || p === "ready");
    dom.resetBtn.disabled     = false;
    dom.backBtn.disabled      = false;
}

function setMessage(text) { dom.messageArea.innerHTML = text; }
function setRule(text)    { dom.ruleArea.textContent = text; }


// Scoring & signal type

function calculateRoundScore(ms) { return Math.max(0, Math.round(500 - ms * 0.5)); }

function determineRoundSignalType() {
    if (gameState.signalType === "mixed") {
        return ["click", "spacebar"][Math.floor(Math.random() * 2)];
    }
    return gameState.signalType;
}

function getSignalInstruction(type) {
    return type === "click"
        ? "CLICK the signal area as fast as you can!"
        : "Press the SPACEBAR as fast as you can!";
}


// Game flow

function startTest() {
    gameState.currentRound  = 0; gameState.totalScore   = 0;
    gameState.falseStarts   = 0; gameState.reactionTimes = [];
    gameState.bestTime      = Infinity; gameLog = [];
    addLogEntry("Test started. Player: " + gameState.playerName);
    updateStatsDisplay(); updateResultsDisplay();
    startRound();
}

function startRound() {
    gameState.currentRound++;
    gameState.phase = "waiting";
    gameState.currentRoundSignalType = determineRoundSignalType();
    var config = difficultyConfig[gameState.difficulty];
    var delay = Math.floor(Math.random() * (config.maxDelay - config.minDelay + 1)) + config.minDelay;
    setRule("Round " + gameState.currentRound + " of " + gameState.roundCount +
            "  \u00b7  " + getSignalInstruction(gameState.currentRoundSignalType));
    setSignalArea("waiting", "WAIT...");
    setMessage("Wait for the signal. Do <strong>NOT</strong> react yet!");
    addLogEntry("Round " + gameState.currentRound + " waiting (" + delay + " ms). Signal: " + gameState.currentRoundSignalType);
    updateStatsDisplay(); updateButtonStates();
    gameState.waitTimeoutId = setTimeout(showSignal, delay);
}

function showSignal() {
    gameState.phase = "ready";
    gameState.signalTimestamp = performance.now();
    setSignalArea("ready", "GO!");
    setMessage("React <strong>NOW!</strong>");
    if (gameState.soundEnabled) playSignalSound();
    addLogEntry("Signal shown. React now!");
    updateButtonStates();
}

function handleReaction() {
    if (gameState.phase !== "ready") return;
    var reactionTime = Math.round(performance.now() - gameState.signalTimestamp);
    gameState.phase = "reacted";
    var score = calculateRoundScore(reactionTime);
    gameState.totalScore += score;
    gameState.reactionTimes.push(reactionTime);
    if (reactionTime < gameState.bestTime) gameState.bestTime = reactionTime;

    setSignalArea("result", reactionTime + " ms");
    setMessage("Reaction time: <strong>" + reactionTime + " ms</strong>  Round score: <strong>+" + score + "</strong>");
    addLogEntry("Reacted in " + reactionTime + " ms (+" + score + " pts)");
    updateStatsDisplay(); updateResultsDisplay(); updateButtonStates();

    if (gameState.currentRound >= gameState.roundCount) {
        finishGame();
        return;
    }

    //Change 2: auto-advance to the next round after a countdown
    scheduleAutoAdvance(reactionTime, score);
    //End Change 2
}

//Change 2: auto-advance functions
var AUTO_ADVANCE_DELAY = 2000;

function scheduleAutoAdvance(reactionTime, score) {
    var remaining = AUTO_ADVANCE_DELAY / 1000;
    function tick() {
        if (gameState.phase !== "reacted") return;
        setMessage(
            "Reaction time: <strong>" + reactionTime + " ms</strong>  \u00b7  " +
            "Round score: <strong>+" + score + "</strong>" +
            "<br><small style='color:white'>Next round in " + remaining + "s\u2026 or click Next Round now</small>"
        );
        if (remaining <= 0) { nextRound(); return; }
        remaining--;
        gameState.autoAdvanceTimeoutId = setTimeout(tick, 1000);
    }
    gameState.autoAdvanceTimeoutId = setTimeout(tick, 0);
}

function scheduleAutoAdvanceFalseStart() {
    var remaining = AUTO_ADVANCE_DELAY / 1000;
    function tick() {
        if (gameState.phase !== "falsestart") return;
        setMessage(
            "False start!" +
            (gameState.falseStartPenalty ? "  Penalty: <strong>\u221250 pts</strong>" : "") +
            "<br><small style='color:white'>Retrying in " + remaining + "s\u2026 or click Next Round now</small>"
        );
        if (remaining <= 0) { nextRound(); return; }
        remaining--;
        gameState.autoAdvanceTimeoutId = setTimeout(tick, 1000);
    }
    gameState.autoAdvanceTimeoutId = setTimeout(tick, 0);
}
//End Change 2

function handleFalseStart() {
    if (gameState.phase !== "waiting") return;
    gameState.phase = "falsestart";
    clearTimeout(gameState.waitTimeoutId);
    clearTimeout(gameState.autoAdvanceTimeoutId); //Change 2
    gameState.falseStarts++;
    var penalty = 0;
    if (gameState.falseStartPenalty) { penalty = 50; gameState.totalScore -= penalty; }
    setSignalArea("false-start", "TOO EARLY!");
    setMessage("False start!" + (gameState.falseStartPenalty ? " Penalty: <strong>-" + penalty + " pts</strong>" : ""));
    if (gameState.soundEnabled) playFalseStartSound();
    addLogEntry("False start!" + (gameState.falseStartPenalty ? " -" + penalty + " pts" : ""));
    updateStatsDisplay(); updateButtonStates();
    scheduleAutoAdvanceFalseStart(); //Change 2
}

function buildSummary() {
    var lines = [];
    lines.push("Player: " + gameState.playerName);
    lines.push("Total Score: " + gameState.totalScore);
    if (gameState.reactionTimes.length > 0) {
        var sum = 0, min = Infinity, max = -Infinity;
        for (var i = 0; i < gameState.reactionTimes.length; i++) {
            var t = gameState.reactionTimes[i]; sum += t;
            if (t < min) min = t; if (t > max) max = t;
        }
        lines.push("Best Time: " + min + " ms");
        lines.push("Worst Time: " + max + " ms");
        lines.push("Average Time: " + Math.round(sum / gameState.reactionTimes.length) + " ms");
    } else { lines.push("No valid reaction times recorded."); }
    lines.push("False Starts: " + gameState.falseStarts);
    return lines.join("\n");
}

function finishGame() {
    gameState.phase = "finished";
    var summary = buildSummary();
    setMessage(summary);
    if (gameState.soundEnabled) playGameOverSound();
    addLogEntry("Game finished! Total score: " + gameState.totalScore);
    var prevBest = getCookie("reactionTester_bestScore");
    var prevBestNum = prevBest ? parseInt(prevBest, 10) : 0;
    if (gameState.totalScore > prevBestNum) {
        setCookie("reactionTester_bestScore", String(gameState.totalScore), 30);
        addLogEntry("New personal best score!");
    }

    //Change 3: Show the in-page game-over banner instead of alert()
    /*  Old code removed:
        alert("Game Over!\n\n" + summary);
    */
    showGameOverBanner(summary);
    //End Change 3

    updateButtonStates();
}

//Change 3: banner helpers
function showGameOverBanner(summaryText) {
    dom.gameOverSummary.textContent = summaryText;
    dom.gameOverBanner.classList.remove("hidden");
}
function hideGameOverBanner() {
    dom.gameOverBanner.classList.add("hidden");
}
//End Change 3

function nextRound() {
    if (gameState.phase !== "reacted" && gameState.phase !== "falsestart") return;
    clearTimeout(gameState.autoAdvanceTimeoutId); //Change 2
    if (gameState.currentRound >= gameState.roundCount) {
        setMessage("All rounds completed. Click Start Test to play again.");
        return;
    }
    startRound();
}

function resetTest() {
    var confirmed = confirm("Are you sure you want to reset the test? All progress will be lost.");
    if (!confirmed) return;
    clearTimeout(gameState.waitTimeoutId);
    clearTimeout(gameState.autoAdvanceTimeoutId); //Change 2
    gameState.currentRound = 0; gameState.totalScore = 0;
    gameState.falseStarts  = 0; gameState.reactionTimes = [];
    gameState.bestTime = Infinity; gameState.phase = "idle";
    setRule("Current round instruction will appear here.");
    setSignalArea("waiting", "WAIT...");
    setMessage("Test reset. Click Start Test when ready.");
    dom.resultsArea.textContent = "No results yet.";
    addLogEntry("Test reset by player.");
    updateStatsDisplay(); updateButtonStates();
}

function backToSettings() {
    var confirmed = confirm("Return to settings? Current game progress will not be saved.");
    if (!confirmed) return;
    clearTimeout(gameState.waitTimeoutId);
    clearTimeout(gameState.autoAdvanceTimeoutId); //Change 2
    window.close();
    setTimeout(function () { window.location.href = "index.html"; }, 500);
}


// Session save / load

function saveSession() {
    var data = {
        playerName: gameState.playerName, difficulty: gameState.difficulty,
        roundCount: gameState.roundCount, signalType: gameState.signalType,
        soundEnabled: gameState.soundEnabled, falseStartPenalty: gameState.falseStartPenalty,
        showAverage: gameState.showAverage, currentRound: gameState.currentRound,
        totalScore: gameState.totalScore, falseStarts: gameState.falseStarts,
        reactionTimes: gameState.reactionTimes.slice(), bestTime: gameState.bestTime,
        phase: (gameState.phase === "waiting" || gameState.phase === "ready") ? "idle" : gameState.phase,
        gameLog: gameLog.slice()
    };
    sessionStorage.setItem("reactionTester_sessionState", JSON.stringify(data));
    addLogEntry("Session saved.");
    alert("Session saved successfully!");
}

function loadSession() {
    var stored = sessionStorage.getItem("reactionTester_sessionState");
    if (!stored) { alert("No saved session found."); return; }
    var confirmed = confirm("Load saved session? Current progress will be replaced.");
    if (!confirmed) return;
    clearTimeout(gameState.waitTimeoutId);
    clearTimeout(gameState.autoAdvanceTimeoutId); //Change 2
    var d = JSON.parse(stored);
    gameState.playerName = d.playerName; gameState.difficulty = d.difficulty;
    gameState.roundCount = d.roundCount; gameState.signalType = d.signalType;
    gameState.soundEnabled = d.soundEnabled; gameState.falseStartPenalty = d.falseStartPenalty;
    gameState.showAverage = d.showAverage; gameState.currentRound = d.currentRound;
    gameState.totalScore = d.totalScore; gameState.falseStarts = d.falseStarts;
    gameState.reactionTimes = d.reactionTimes; gameState.bestTime = d.bestTime;
    gameState.phase = d.phase; gameLog = d.gameLog || [];
    if (gameState.phase === "finished") { setMessage(buildSummary()); }
    else { setMessage("Session loaded. Click " + (gameState.currentRound === 0 ? "Start Test" : "Next Round") + " to continue."); }
    setRule("Session restored \u2014 Round " + gameState.currentRound + " of " + gameState.roundCount);
    setSignalArea("waiting", "WAIT...");
    updateStatsDisplay(); updateResultsDisplay(); renderLog(); updateButtonStates();
    addLogEntry("Session loaded."); alert("Session loaded successfully!");
}


// Event handlers

function onSignalAreaClick() {
    if (gameState.phase === "waiting") { handleFalseStart(); return; }
    if (gameState.phase === "ready") {
        if (gameState.currentRoundSignalType === "click") { handleReaction(); }
        else { setMessage("Use the <strong>SPACEBAR</strong>, not the mouse!"); }
    }
}

function onKeyDown(event) {
    if (event.code === "Space") {
        event.preventDefault();
        if (gameState.phase === "waiting") { handleFalseStart(); return; }
        if (gameState.phase === "ready") {
            if (gameState.currentRoundSignalType === "spacebar") { handleReaction(); }
            else { setMessage("<strong>CLICK</strong> the signal area \u2014 don't press spacebar!"); }
        }
    }
}


// Init

function init() {
    cacheDomElements();

    var settingsStr = sessionStorage.getItem("reactionTester_gameSettings");
    if (settingsStr) {
        var s = JSON.parse(settingsStr);
        gameState.playerName = s.playerName; gameState.difficulty = s.difficulty;
        gameState.roundCount = s.roundCount; gameState.signalType = s.signalType;
        gameState.soundEnabled = s.soundEnabled; gameState.falseStartPenalty = s.falseStartPenalty;
        gameState.showAverage = s.showAverage;
    } else {
        var savedName = getCookie("reactionTester_playerName");
        if (savedName) gameState.playerName = savedName;
        setMessage("No game settings detected. Please open this window from the launcher page.");
    }

    dom.startBtn.addEventListener("click", startTest);
    dom.nextRoundBtn.addEventListener("click", nextRound);
    dom.saveBtn.addEventListener("click", saveSession);
    dom.loadBtn.addEventListener("click", loadSession);
    dom.resetBtn.addEventListener("click", resetTest);
    dom.backBtn.addEventListener("click", backToSettings);
    dom.signalArea.addEventListener("click", onSignalAreaClick);
    document.addEventListener("keydown", onKeyDown);

    //Change 3: Play Again button on the game-over banner
    dom.gameOverCloseBtn.addEventListener("click", function () {
        hideGameOverBanner();
        resetTest();
    });
    //End Change 3

    //Change 4 (updated): The How-to-Play overlay has been REMOVED from game.js. It's now entirely in launcher.js / index.html so players see it before configuring their session, not after opening the game.
    //No overlay code here
    //End Change 4

    updateStatsDisplay();
    updateButtonStates();
    addLogEntry("Game initialised. Player: " + gameState.playerName);
}

document.addEventListener("DOMContentLoaded", init);
