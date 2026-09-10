(function () {
  "use strict";

  var STORAGE_PACKAGE_KEY = "gridgraderCanvasPackage";
  var STORAGE_RECEIVED_AT_KEY = "gridgraderCanvasPackageReceivedAt";
  var STORAGE_DEBUG_KEY = "gridgraderDebugMode";
  var STORAGE_COMPLETED_IDS_KEY = "gridgraderCompletedStudentIds";

  var packageStatusEl = document.getElementById("package-status");
  var studentSectionEl = document.getElementById("student-section");
  var studentSelectEl = document.getElementById("student-select");
  var remainingCountEl = document.getElementById("remaining-count");
  var scorePreviewEl = document.getElementById("score-preview");
  var matchStatusEl = document.getElementById("match-status");
  var canvasNavRowEl = document.getElementById("canvas-nav-row");
  var prevStudentBtn = document.getElementById("prev-student-btn");
  var nextStudentBtn = document.getElementById("next-student-btn");
  var navStatusEl = document.getElementById("nav-status");
  var actionsEl = document.getElementById("actions");
  var updateGradesBtn = document.getElementById("update-grades-btn");
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
    completedStudentIds: [], // students already sent — hidden from the dropdown
  };

  function questionHeaderByIndex(pkg, index) {
    var q = pkg.questions.find(function (q) {
      return q.index === index;
    });
    return q ? q.header : "Question " + index;
  }

  function remainingStudents() {
    if (!state.pkg) return [];
    return state.pkg.students.filter(function (s) {
      return state.completedStudentIds.indexOf(s.id) === -1;
    });
  }

  function renderPackageStatus() {
    if (!state.pkg) {
      packageStatusEl.textContent = "No package received. Export from GridGrader first.";
      studentSectionEl.hidden = true;
      canvasNavRowEl.hidden = true;
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
    canvasNavRowEl.hidden = false;
    actionsEl.hidden = false;
  }

  function renderStudentOptions() {
    var previouslySelectedId = studentSelectEl.value;
    studentSelectEl.innerHTML = "";
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a student…";
    studentSelectEl.appendChild(placeholder);

    remainingStudents().forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      studentSelectEl.appendChild(opt);
    });

    // Keep the current selection if it's still in the list (e.g. after a
    // debug-mode toggle re-render); a completed student is gone from the
    // list entirely, so re-selecting it isn't possible.
    studentSelectEl.value = previouslySelectedId;

    var remaining = remainingStudents().length;
    var total = state.pkg.students.length;
    remainingCountEl.textContent = remaining + " of " + total + " students remaining";
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

  function updateActionButtonsEnabled() {
    var ready =
      !!state.pkg &&
      !!state.selectedStudent &&
      !!state.canvasStatus &&
      state.canvasStatus.compatible &&
      matchLabel() === "MATCH";
    updateGradesBtn.disabled = !ready;
  }

  // Only an exact (post-normalization) name match ever auto-selects a
  // student — this is a UI convenience for paging through a roster, not
  // a grading decision, but it still never guesses.
  function autoSelectStudentMatchingCanvas() {
    if (!state.pkg || !state.canvasStatus || !state.canvasStatus.displayedStudentName) return;
    var candidates = remainingStudents().filter(function (s) {
      return window.GridGraderNormalize.namesMatch(s.name, state.canvasStatus.displayedStudentName);
    });
    if (candidates.length === 1) {
      state.selectedStudent = candidates[0];
      studentSelectEl.value = candidates[0].id;
    }
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

  function withActiveTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      callback(tab || null);
    });
  }

  function render() {
    renderPackageStatus();
    if (state.pkg) {
      renderStudentOptions();
      renderScorePreview();
      renderMatchStatus();
      updateActionButtonsEnabled();
    }
  }

  function persistCompletedIds() {
    var toSet = {};
    toSet[STORAGE_COMPLETED_IDS_KEY] = state.completedStudentIds;
    chrome.storage.local.set(toSet);
  }

  function loadFromStorage() {
    chrome.storage.local.get(
      [STORAGE_PACKAGE_KEY, STORAGE_RECEIVED_AT_KEY, STORAGE_DEBUG_KEY, STORAGE_COMPLETED_IDS_KEY],
      function (data) {
        state.pkg = data[STORAGE_PACKAGE_KEY] || null;
        state.receivedAt = data[STORAGE_RECEIVED_AT_KEY] || null;
        state.debug = !!data[STORAGE_DEBUG_KEY];
        state.completedStudentIds = data[STORAGE_COMPLETED_IDS_KEY] || [];
        debugToggleEl.checked = state.debug;

        render();

        if (state.pkg) {
          refreshCanvasStatus(function () {
            // Preload the dropdown to whichever remaining student's name
            // exactly matches whatever Canvas is already showing, so
            // opening the popup is "confirm this looks right," not "go
            // find the right name in a 164-student list" — same
            // exact-match-only rule as the post-navigation case.
            autoSelectStudentMatchingCanvas();
            render();
          });
        }
      }
    );
  }

  studentSelectEl.addEventListener("change", function () {
    var id = studentSelectEl.value;
    state.selectedStudent = remainingStudents().find(function (s) {
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
    chrome.storage.local.remove(
      [STORAGE_PACKAGE_KEY, STORAGE_RECEIVED_AT_KEY, STORAGE_COMPLETED_IDS_KEY],
      function () {
        state.pkg = null;
        state.receivedAt = null;
        state.selectedStudent = null;
        state.canvasStatus = null;
        state.completedStudentIds = [];
        resultEl.textContent = "";
        navStatusEl.textContent = "";
        debugOutputEl.hidden = true;
        render();
      }
    );
  });

  updateGradesBtn.addEventListener("click", function () {
    resultEl.textContent = "Sending…";
    debugOutputEl.hidden = true;
    var studentBeingSent = state.selectedStudent;

    withActiveTab(function (tab) {
      if (!tab) {
        resultEl.textContent = "No active tab.";
        return;
      }
      chrome.tabs.sendMessage(
        tab.id,
        {
          type: "SEND_GRADES",
          payload: { selectedStudent: studentBeingSent, debug: state.debug },
        },
        function (response) {
          void chrome.runtime.lastError;
          if (!response) {
            resultEl.textContent = "No response from the Canvas page. Reload the page and try again.";
            return;
          }
          if (response.ok) {
            resultEl.textContent =
              "Fields filled (" +
              response.filled +
              ")" +
              (response.updateScoresClicked ? " and Update Scores clicked." : " — Update Scores was NOT clicked; check Canvas.") +
              " GridGrader can't verify Canvas actually saved it — check the page.";

            // Mark done and drop from the dropdown, whether or not the
            // Update Scores click itself reported success — the fields
            // are filled either way, and re-sending the same student
            // isn't harmful, but this is what makes paging through a
            // large roster tractable.
            state.completedStudentIds.push(studentBeingSent.id);
            persistCompletedIds();
            state.selectedStudent = null;
            render();
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

  function goToStudent(direction) {
    navStatusEl.textContent = "Navigating…";
    withActiveTab(function (tab) {
      if (!tab) {
        navStatusEl.textContent = "No active tab.";
        return;
      }
      var messageType = direction === "next" ? "CLICK_NEXT_STUDENT" : "CLICK_PREV_STUDENT";
      chrome.tabs.sendMessage(tab.id, { type: messageType }, function (response) {
        void chrome.runtime.lastError;
        if (!response) {
          navStatusEl.textContent = "No response — this may not be a compatible Canvas page.";
          return;
        }
        if (!response.ok) {
          navStatusEl.textContent = "Could not navigate (already at an end, or the button wasn't found).";
          return;
        }
        // Canvas needs a moment to load the next/previous student's
        // data before re-checking who's displayed.
        navStatusEl.textContent = "Navigated — refreshing…";
        setTimeout(function () {
          refreshCanvasStatus(function () {
            autoSelectStudentMatchingCanvas();
            render();
            navStatusEl.textContent = "";
          });
        }, 600);
      });
    });
  }

  prevStudentBtn.addEventListener("click", function () {
    goToStudent("prev");
  });

  nextStudentBtn.addEventListener("click", function () {
    goToStudent("next");
  });

  loadFromStorage();
})();
