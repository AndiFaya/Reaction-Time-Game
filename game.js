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

//Sound Helpers (Just web audio API)

var audioCtx = null;

/**
 *  @returns {AudioContext}
 */
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

/**
 * Play a short tone at the given frequency and duration
 * @param {number} frequency
 * @param {number} durationMs 
 * @param {string} waveType (sine, square, etc.)
 */
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

//beep when the signal appears
function playSignalSound() {
    playTone(880, 200, "sine");
}

//buzz for a false start
function playFalseStartSound() {
    playTone(220, 400, "square");
}

//triple beep when the game finishes
function playGameOverSound() {
    playTone(660, 150, "sine");
    setTimeout(function () { playTone(880, 150, "sine"); }, 200);
    setTimeout(function () { playTone(1100, 300, "sine"); }, 400);
}


// Difficulty (min/max random delay in ms)

var difficultyConfig = {
    easy:   { minDelay: 2000, maxDelay: 5000 },
    medium: { minDelay: 1000, maxDelay: 4000 },
    hard:   { minDelay: 500,  maxDelay: 3000 }
};

// Game State Object (updated every round)

var gameState = {
    playerName: "",
    difficulty: "medium",
    roundCount: 8,
    signalType: "click",
    soundEnabled: true,
    falseStartPenalty: true,
    showAverage: true,
    currentRound: 0,
    totalScore: 0,
    falseStarts: 0,
    reactionTimes: [],       // Array
    bestTime: Infinity,
    phase: "idle",           // idle, waiting etc.
    signalTimestamp: 0,      // performance.now() when the signal appears
    waitTimeoutId: null,     // setTimeout reference for the current delay
    currentRoundSignalType: "click"  // Resolved per-round when signalType is "mixed"
};

//Game Log Array (stores event objects with timestamp, round, message)

var gameLog = [];

/**
 * @param {string} message
 */
function addLogEntry(message) {
    var entry = {
        time: new Date().toLocaleTimeString(),
        round: gameState.currentRound,
        message: message
    };
    gameLog.push(entry);
    renderLog();
}

// Rendering the game log into the log area
function renderLog() {
    var html = "";
    for (var i = gameLog.length - 1; i >= 0; i--) {
        var e = gameLog[i];
        html += "<div class=\"log-entry\">[" + e.time + "] R" + e.round + ": " + e.message + "</div>";
    }
    dom.logArea.innerHTML = html;
}

//Cached DOM Element References

var dom = {};

function cacheDomElements() {
    dom.startBtn = document.getElementById("startBtn");
    dom.nextRoundBtn = document.getElementById("nextRoundBtn");
    dom.saveBtn = document.getElementById("saveBtn");
    dom.loadBtn = document.getElementById("loadBtn");
    dom.resetBtn = document.getElementById("resetBtn");
    dom.backBtn = document.getElementById("backBtn");
    dom.displayPlayer = document.getElementById("displayPlayer");
    dom.displayRound = document.getElementById("displayRound");
    dom.displayScore = document.getElementById("displayScore");
    dom.displayBestTime = document.getElementById("displayBestTime");
    dom.displayAverageTime = document.getElementById("displayAverageTime");
    dom.displayFalseStarts = document.getElementById("displayFalseStarts");
    dom.ruleArea = document.getElementById("ruleArea");
    dom.messageArea = document.getElementById("messageArea");
    dom.signalArea = document.getElementById("signalArea");
    dom.resultsArea = document.getElementById("resultsArea");
    dom.logArea = document.getElementById("logArea");
}


//UI Update Functions

//Refreshing all six stat boxes from gameState
function updateStatsDisplay() {
    dom.displayPlayer.textContent = gameState.playerName;
    dom.displayRound.textContent = gameState.currentRound + " / " + gameState.roundCount;
    dom.displayScore.textContent = gameState.totalScore;
    dom.displayFalseStarts.textContent = gameState.falseStarts;

    dom.displayBestTime.textContent = gameState.bestTime < Infinity
        ? gameState.bestTime + " ms"
        : "-";

    if (gameState.showAverage && gameState.reactionTimes.length > 0) {
        var sum = 0;
        for (var i = 0; i < gameState.reactionTimes.length; i++) {
            sum += gameState.reactionTimes[i];
        }
        dom.displayAverageTime.textContent = Math.round(sum / gameState.reactionTimes.length) + " ms";
    } else {
        dom.displayAverageTime.textContent = "-";
    }
}

// To render the per-round results list
function updateResultsDisplay() {
    if (gameState.reactionTimes.length === 0) {
        dom.resultsArea.textContent = "No results yet.";
        return;
    }
    var lines = [];
    for (var i = 0; i < gameState.reactionTimes.length; i++) {
        lines.push("Round " + (i + 1) + ": " + gameState.reactionTimes[i] + " ms");
    }
    if (gameState.falseStarts > 0) {
        lines.push("\nFalse starts: " + gameState.falseStarts);
    }
    dom.resultsArea.textContent = lines.join("\n");
}

// To set the signal area's CSS class and text
function setSignalArea(className, text) {
    dom.signalArea.className = "signal-area " + className;
    dom.signalArea.textContent = text;
}

// Enable or disable buttons based on the current game phase
function updateButtonStates() {
    var p = gameState.phase;
    dom.startBtn.disabled = (p !== "idle" && p !== "finished");
    dom.nextRoundBtn.disabled = (p !== "reacted" && p !== "falsestart");
    dom.saveBtn.disabled = (p === "idle");
    dom.loadBtn.disabled = (p === "waiting" || p === "ready");
    dom.resetBtn.disabled = false;
    dom.backBtn.disabled = false;
}

function setMessage(text) {
    dom.messageArea.textContent = text;
}

function setRule(text) {
    dom.ruleArea.textContent = text;
}

//Scoring

/**
 * Convert a reaction time in ms to a round score.
 * Faster reactions get a higher score
 * @param {number} reactionTimeMs
 * @returns {number}
 */
function calculateRoundScore(reactionTimeMs) {
    return Math.max(0, Math.round(500 - reactionTimeMs * 0.5));
}

// Signal Type Resolution

/**
 *randomly pick click or spacebar for this round for the mixed mode
 * @returns {string}
 */
function determineRoundSignalType() {
    if (gameState.signalType === "mixed") {
        var types = ["click", "spacebar"];
        return types[Math.floor(Math.random() * types.length)];
    }
    return gameState.signalType;
}

/**
 * Return an instruction for the given signal type
 * @param {string} signalType
 * @returns {string}
 */
function getSignalInstruction(signalType) {
    if (signalType === "click") {
        return "CLICK the signal area as fast as you can!";
    }
    return "Press the SPACEBAR as fast as you can!";
}



//Game Flow Functions

// Begining a new test to reset all counters and start round 1
function startTest() {
    gameState.currentRound = 0;
    gameState.totalScore = 0;
    gameState.falseStarts = 0;
    gameState.reactionTimes = [];
    gameState.bestTime = Infinity;
    gameLog = [];

    addLogEntry("Test started. Player: " + gameState.playerName);
    updateStatsDisplay();
    updateResultsDisplay();
    startRound();
}

//Begin the next round
function startRound() {
    gameState.currentRound++;
    gameState.phase = "waiting";
    gameState.currentRoundSignalType = determineRoundSignalType();

    // Random delay within the difficulty range
    var config = difficultyConfig[gameState.difficulty];
    var delay = Math.floor(Math.random() * (config.maxDelay - config.minDelay + 1)) + config.minDelay;

    setRule(
        "Round " + gameState.currentRound + " of " + gameState.roundCount +
        "  .  " + getSignalInstruction(gameState.currentRoundSignalType)
    );
    setSignalArea("waiting", "WAIT...");
    setMessage("Wait for the signal and Do NOT react yet!");

    addLogEntry("Round " + gameState.currentRound + " waiting (" + delay + " ms). Signal: " + gameState.currentRoundSignalType);
    updateStatsDisplay();
    updateButtonStates();

    // After the random delay, the green "go" signal is shown
    gameState.waitTimeoutId = setTimeout(showSignal, delay);
}

//Transition from "waiting" to "ready" 

function showSignal() {
    gameState.phase = "ready";
    gameState.signalTimestamp = performance.now();

    setSignalArea("ready", "GO!");
    setMessage("React NOW!");

    if (gameState.soundEnabled) {
        playSignalSound();
    }

    addLogEntry("React now!");
    updateButtonStates();
}

//Handling of correct reactions (recording time, calculateing scores, checking for when the game end)

function handleReaction() {
    if (gameState.phase !== "ready") return;

    var reactionTime = Math.round(performance.now() - gameState.signalTimestamp);
    gameState.phase = "reacted";

    var score = calculateRoundScore(reactionTime);
    gameState.totalScore += score;
    gameState.reactionTimes.push(reactionTime);

    if (reactionTime < gameState.bestTime) {
        gameState.bestTime = reactionTime;
    }

    setSignalArea("result", reactionTime + " ms");
    setMessage("Reaction time: " + reactionTime + " ms\nScore this round: +" + score);

    addLogEntry("Reacted in " + reactionTime + " ms (+" + score + " pts)");
    updateStatsDisplay();
    updateResultsDisplay();
    updateButtonStates();

    if (gameState.currentRound >= gameState.roundCount) {
        finishGame();
    }
}

//Handling false starts 

function handleFalseStart() {
    if (gameState.phase !== "waiting") return;

    gameState.phase = "falsestart";
    clearTimeout(gameState.waitTimeoutId);
    gameState.falseStarts++;

    var penalty = 0;
    if (gameState.falseStartPenalty) {
        penalty = 50;
        gameState.totalScore -= penalty;
    }

    setSignalArea("false-start", "TOO EARLY!");
    setMessage("False start!" + (gameState.falseStartPenalty ? " Penalty: -" + penalty + " pts" : ""));

    if (gameState.soundEnabled) {
        playFalseStartSound();
    }

    addLogEntry("False start!" + (gameState.falseStartPenalty ? " -" + penalty + " pts" : ""));
    updateStatsDisplay();
    updateButtonStates();
}

/**
 * @returns {string}
 */
function buildSummary() {
    var lines = [];
    lines.push(" GAME OVER");
    lines.push("Player: " + gameState.playerName);
    lines.push("Total Score: " + gameState.totalScore);

    if (gameState.reactionTimes.length > 0) {
        var sum = 0;
        var min = Infinity;
        var max = -Infinity;
        for (var i = 0; i < gameState.reactionTimes.length; i++) {
            var t = gameState.reactionTimes[i];
            sum += t;
            if (t < min) min = t;
            if (t > max) max = t;
        }
        var avg = Math.round(sum / gameState.reactionTimes.length);
        lines.push("Best Time: " + min + " ms");
        lines.push("Worst Time: " + max + " ms");
        lines.push("Average Time: " + avg + " ms");
    } else {
        lines.push("No valid reaction times recorded.");
    }

    lines.push("False Starts: " + gameState.falseStarts);
    return lines.join("\n");
}

// Showing summary, playing sound and updating best-score cookie
function finishGame() {
    gameState.phase = "finished";

    var summary = buildSummary();
    setMessage(summary);

    if (gameState.soundEnabled) {
        playGameOverSound();
    }

    addLogEntry("Game finished! Total score: " + gameState.totalScore);

    // Persist best score in a cookie
    var prevBest = getCookie("reactionTester_bestScore");
    var prevBestNum = prevBest ? parseInt(prevBest, 10) : 0;
    if (gameState.totalScore > prevBestNum) {
        setCookie("reactionTester_bestScore", String(gameState.totalScore), 30);
        addLogEntry("New personal best score!");
    }

    alert("Game Over!\n\n" + summary);
    updateButtonStates();
}

// Move to the next round 
function nextRound() {
    if (gameState.phase !== "reacted" && gameState.phase !== "falsestart") return;

    if (gameState.currentRound >= gameState.roundCount) {
        setMessage("All rounds completed. Click Start Test to play again.");
        return;
    }

    startRound();
}

//Confirm and then reset the entire test to "Waitimg"
function resetTest() {
    var confirmed = confirm("Are you sure you want to reset the test? All progress will be lost.");
    if (!confirmed) return;

    clearTimeout(gameState.waitTimeoutId);

    gameState.currentRound = 0;
    gameState.totalScore = 0;
    gameState.falseStarts = 0;
    gameState.reactionTimes = [];
    gameState.bestTime = Infinity;
    gameState.phase = "idle";

    setRule("Current round instruction will appear here.");
    setSignalArea("waiting", "WAIT...");
    setMessage("Test reset. Click Start Test when ready.");
    dom.resultsArea.textContent = "No results yet.";

    addLogEntry("Test reset by player.");
    updateStatsDisplay();
    updateButtonStates();
}

// Confirm and close the game window
function backToSettings() {
    var confirmed = confirm("Return to settings? Current game progress will not be saved...");
    if (!confirmed) return;

    clearTimeout(gameState.waitTimeoutId);
    window.close();

    // Fallback for browsers that block window.close()
    setTimeout(function () {
        window.location.href = "index.html";
    }, 500);
}


//Session Save / Load (sessionStorage)

function saveSession() {
    var sessionData = {
        playerName: gameState.playerName,
        difficulty: gameState.difficulty,
        roundCount: gameState.roundCount,
        signalType: gameState.signalType,
        soundEnabled: gameState.soundEnabled,
        falseStartPenalty: gameState.falseStartPenalty,
        showAverage: gameState.showAverage,
        currentRound: gameState.currentRound,
        totalScore: gameState.totalScore,
        falseStarts: gameState.falseStarts,
        reactionTimes: gameState.reactionTimes.slice(),
        bestTime: gameState.bestTime,
        // If the game is mid-wait or mid-ready it must save as idle to avoid stale timers
        phase: (gameState.phase === "waiting" || gameState.phase === "ready") ? "idle" : gameState.phase,
        gameLog: gameLog.slice()
    };
    sessionStorage.setItem("reactionTester_sessionState", JSON.stringify(sessionData));
    addLogEntry("Session saved.");
    alert("Session saved successfully!");
}

//To restore a previously saved session from sessionStorage
function loadSession() {
    var stored = sessionStorage.getItem("reactionTester_sessionState");
    if (!stored) {
        alert("No saved session found.");
        return;
    }

    var confirmed = confirm("Load saved session? Current progress will be replaced.");
    if (!confirmed) return;

    clearTimeout(gameState.waitTimeoutId);

    var data = JSON.parse(stored);
    gameState.playerName = data.playerName;
    gameState.difficulty = data.difficulty;
    gameState.roundCount = data.roundCount;
    gameState.signalType = data.signalType;
    gameState.soundEnabled = data.soundEnabled;
    gameState.falseStartPenalty = data.falseStartPenalty;
    gameState.showAverage = data.showAverage;
    gameState.currentRound = data.currentRound;
    gameState.totalScore = data.totalScore;
    gameState.falseStarts = data.falseStarts;
    gameState.reactionTimes = data.reactionTimes;
    gameState.bestTime = data.bestTime;
    gameState.phase = data.phase;
    gameLog = data.gameLog || [];

    // Setting messages depending on restored phase
    if (gameState.phase === "finished") {
        setMessage(buildSummary());
    } else {
        setMessage("Session loaded. Click " + (gameState.currentRound === 0 ? "Start Test" : "Next Round") + " to continue.");
    }

    setRule("Session restored — Round " + gameState.currentRound + " of " + gameState.roundCount);
    setSignalArea("waiting", "WAIT...");
    updateStatsDisplay();
    updateResultsDisplay();
    renderLog();
    updateButtonStates();

    addLogEntry("Session loaded.");
    alert("Session loaded successfully!");
}

//Event Handlers

//If the user clicks the handler for the signal area:
// During "waiting" then "false start"
//During "ready" then it's a valid reaction
function onSignalAreaClick() {
    if (gameState.phase === "waiting") {
        handleFalseStart();
        return;
    }
    if (gameState.phase === "ready") {
        if (gameState.currentRoundSignalType === "click") {
            handleReaction();
        } else {
            setMessage("Use the SPACEBAR, not the mouse!");
        }
    }
}

//Visa Versa

function onKeyDown(event) {
    if (event.code === "Space") {
        event.preventDefault();
        if (gameState.phase === "waiting") {
            handleFalseStart();
            return;
        }
        if (gameState.phase === "ready") {
            if (gameState.currentRoundSignalType === "spacebar") {
                handleReaction();
            } else {
                setMessage("CLICK the signal area, don't press spacebar!");
            }
        }
    }
}

//nitialisation

//Load settings from sessionStorage (written by the launcher),
 //fall back to cookie for player name, wire up all listeners

function init() {
    cacheDomElements();

    // To read settings the launcher stored in sessionStorage
    var settingsStr = sessionStorage.getItem("reactionTester_gameSettings");
    if (settingsStr) {
        var settings = JSON.parse(settingsStr);
        gameState.playerName = settings.playerName;
        gameState.difficulty = settings.difficulty;
        gameState.roundCount = settings.roundCount;
        gameState.signalType = settings.signalType;
        gameState.soundEnabled = settings.soundEnabled;
        gameState.falseStartPenalty = settings.falseStartPenalty;
        gameState.showAverage = settings.showAverage;
    } else {
        // Fallback: try to recover the player name from a cookie
        var savedName = getCookie("reactionTester_playerName");
        if (savedName) {
            gameState.playerName = savedName;
        }
        setMessage("No game settings detected.\nPlease open this window from the launcher page.");
    }

    // Button click events
    dom.startBtn.addEventListener("click", startTest);
    dom.nextRoundBtn.addEventListener("click", nextRound);
    dom.saveBtn.addEventListener("click", saveSession);
    dom.loadBtn.addEventListener("click", loadSession);
    dom.resetBtn.addEventListener("click", resetTest);
    dom.backBtn.addEventListener("click", backToSettings);

    // Signal area click event
    dom.signalArea.addEventListener("click", onSignalAreaClick);

    // Keyboard event for spacebar
    document.addEventListener("keydown", onKeyDown);

    // Initial render
    updateStatsDisplay();
    updateButtonStates();
    addLogEntry("Game initialised. Player: " + gameState.playerName);
}

document.addEventListener("DOMContentLoaded", init);