(function () {
  "use strict";

  var STORAGE_PACKAGE_KEY = "gridgraderCanvasPackage";
  var STORAGE_RECEIVED_AT_KEY = "gridgraderCanvasPackageReceivedAt";
  var STORAGE_DEBUG_KEY = "gridgraderDebugMode";

  var packageStatusEl = document.getElementById("package-status");
  var studentSectionEl = document.getElementById("student-section");
  var studentSelectEl = document.getElementById("student-select");
  var scorePreviewEl = document.getElementById("score-preview");
  var matchStatusEl = document.getElementById("match-status");
  var actionsEl = document.getElementById("actions");
  var sendGradesBtn = document.getElementById("send-grades-btn");
  var clearDataBtn = document.getElementById("clear-data-btn");
  var debugToggleEl = document.getElementById("debug-toggle");
  var resultEl = document.getElementById("result");
  var debugOutputEl = document.getElementById("debug-output");

  var state = {
    pkg: null,
    receivedAt: null,
    selectedStudent: null,
    canvasStatus: null, // { compatible, displayedStudentName }
    debug: false,
  };

  function questionHeaderByIndex(pkg, index) {
    var q = pkg.questions.find(function (q) {
      return q.index === index;
    });
    return q ? q.header : "Question " + index;
  }

  function renderPackageStatus() {
    if (!state.pkg) {
      packageStatusEl.textContent = "No package received. Export from GridGrader first.";
      studentSectionEl.hidden = true;
      actionsEl.hidden = true;
      return;
    }
    var when = state.receivedAt ? new Date(state.receivedAt).toLocaleString() : "unknown time";
    packageStatusEl.textContent =
      state.pkg.assignment.name +
      " — exported " +
      new Date(state.pkg.exportedAt).toLocaleString() +
      " (received " +
      when +
      ")";
    studentSectionEl.hidden = false;
    actionsEl.hidden = false;
  }

  function renderStudentOptions() {
    studentSelectEl.innerHTML = "";
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a student…";
    studentSelectEl.appendChild(placeholder);

    state.pkg.students.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      studentSelectEl.appendChild(opt);
    });
  }

  function renderScorePreview() {
    scorePreviewEl.innerHTML = "";
    if (!state.selectedStudent) return;

    var headerRow = document.createElement("tr");
    ["Question", "Score", "Max"].forEach(function (label) {
      var th = document.createElement("th");
      th.textContent = label;
      headerRow.appendChild(th);
    });
    scorePreviewEl.appendChild(headerRow);

    state.selectedStudent.answers
      .slice()
      .sort(function (a, b) {
        return a.questionIndex - b.questionIndex;
      })
      .forEach(function (a) {
        var row = document.createElement("tr");
        var qCell = document.createElement("td");
        qCell.textContent = questionHeaderByIndex(state.pkg, a.questionIndex);
        var scoreCell = document.createElement("td");
        scoreCell.textContent = a.score === null ? "—" : String(a.score);
        var maxCell = document.createElement("td");
        maxCell.textContent = String(a.maxScore);
        row.appendChild(qCell);
        row.appendChild(scoreCell);
        row.appendChild(maxCell);
        scorePreviewEl.appendChild(row);
      });
  }

  function matchLabel() {
    if (!state.canvasStatus || !state.canvasStatus.compatible) return "Not on a compatible Canvas page";
    if (!state.canvasStatus.displayedStudentName) return "UNDETECTED";
    if (!state.selectedStudent) return "";
    return window.GridGraderNormalize.namesMatch(
      state.canvasStatus.displayedStudentName,
      state.selectedStudent.name
    )
      ? "MATCH"
      : "MISMATCH";
  }

  function renderMatchStatus() {
    var label = matchLabel();
    matchStatusEl.textContent = state.canvasStatus && state.canvasStatus.displayedStudentName
      ? "Canvas shows: " + state.canvasStatus.displayedStudentName + " — " + label
      : label;
  }

  function updateSendButtonEnabled() {
    var ready =
      !!state.pkg &&
      !!state.selectedStudent &&
      !!state.canvasStatus &&
      state.canvasStatus.compatible &&
      matchLabel() === "MATCH";
    sendGradesBtn.disabled = !ready;
  }

  function refreshCanvasStatus(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab) {
        state.canvasStatus = { compatible: false, displayedStudentName: null };
        if (callback) callback();
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "PING_CANVAS_PAGE" }, function (response) {
        // No response (wrong page / no content script there) reads as
        // "not compatible" rather than throwing. No frame having a
        // listener (wrong page entirely) sets chrome.runtime.lastError —
        // reading it here just acknowledges it so Chrome doesn't log an
        // "unchecked lastError" warning for an expected case.
        void chrome.runtime.lastError;
        state.canvasStatus = response || { compatible: false, displayedStudentName: null };
        if (callback) callback();
      });
    });
  }

  function render() {
    renderPackageStatus();
    if (state.pkg) {
      renderScorePreview();
      renderMatchStatus();
      updateSendButtonEnabled();
    }
  }

  function loadFromStorage() {
    chrome.storage.local.get(
      [STORAGE_PACKAGE_KEY, STORAGE_RECEIVED_AT_KEY, STORAGE_DEBUG_KEY],
      function (data) {
        state.pkg = data[STORAGE_PACKAGE_KEY] || null;
        state.receivedAt = data[STORAGE_RECEIVED_AT_KEY] || null;
        state.debug = !!data[STORAGE_DEBUG_KEY];
        debugToggleEl.checked = state.debug;

        if (state.pkg) renderStudentOptions();
        render();

        if (state.pkg) {
          refreshCanvasStatus(render);
        }
      }
    );
  }

  studentSelectEl.addEventListener("change", function () {
    var id = studentSelectEl.value;
    state.selectedStudent = state.pkg.students.find(function (s) {
      return s.id === id;
    }) || null;
    render();
  });

  debugToggleEl.addEventListener("change", function () {
    state.debug = debugToggleEl.checked;
    var toSet = {};
    toSet[STORAGE_DEBUG_KEY] = state.debug;
    chrome.storage.local.set(toSet);
  });

  clearDataBtn.addEventListener("click", function () {
    chrome.storage.local.remove([STORAGE_PACKAGE_KEY, STORAGE_RECEIVED_AT_KEY], function () {
      state.pkg = null;
      state.receivedAt = null;
      state.selectedStudent = null;
      state.canvasStatus = null;
      resultEl.textContent = "";
      debugOutputEl.hidden = true;
      render();
    });
  });

  sendGradesBtn.addEventListener("click", function () {
    resultEl.textContent = "Sending…";
    debugOutputEl.hidden = true;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab) {
        resultEl.textContent = "No active tab.";
        return;
      }
      chrome.tabs.sendMessage(
        tab.id,
        {
          type: "SEND_GRADES",
          payload: { selectedStudent: state.selectedStudent, debug: state.debug },
        },
        function (response) {
          void chrome.runtime.lastError;
          if (!response) {
            resultEl.textContent = "No response from the Canvas page. Reload the page and try again.";
            return;
          }
          if (response.ok) {
            resultEl.textContent =
              "Fields filled (" + response.filled + "). Canvas confirmed saved status is not verified automatically — check Canvas.";
          } else {
            resultEl.textContent =
              "Blocked: " + response.message + (response.filled ? " (" + response.filled + " field(s) were already filled before this)" : "");
          }
          if (state.debug && response.debug) {
            debugOutputEl.hidden = false;
            debugOutputEl.textContent = JSON.stringify(response.debug, null, 2);
          }
        }
      );
    });
  });

  loadFromStorage();
})();
