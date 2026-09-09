// GridGrader-origin content script: the only piece of this extension that
// listens for window messages. It accepts only same-window, same-origin,
// exactly-typed messages, validates the payload against the shared
// schema, and only then writes to chrome.storage.local.
//
// shouldAcceptMessage / handleIncomingPackage are pure and take their
// inputs as parameters so they're testable without a real `window` or
// `chrome` global — see extension/test/gridgrader.test.js.

(function (global) {
  "use strict";

  function shouldAcceptMessage(params) {
    if (!params.isSelfWindow) return false;
    if (params.origin !== params.expectedOrigin) return false;
    var data = params.data;
    if (!data || typeof data !== "object") return false;
    if (data.source !== "gridgrader-web") return false;
    if (data.type !== "GRIDGRADER_CANVAS_EXPORT") return false;
    return true;
  }

  function handleIncomingPackage(payload, schema) {
    try {
      var pkg = schema.validateCanvasTransferPackage(payload);
      return { ok: true, pkg: pkg };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }

  var GridGraderReceiver = {
    shouldAcceptMessage: shouldAcceptMessage,
    handleIncomingPackage: handleIncomingPackage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = GridGraderReceiver;
    return;
  }

  global.GridGraderReceiver = GridGraderReceiver;

  if (typeof window !== "undefined" && typeof chrome !== "undefined" && chrome.storage) {
    window.addEventListener("message", function (event) {
      var accepted = shouldAcceptMessage({
        isSelfWindow: event.source === window,
        origin: event.origin,
        expectedOrigin: window.location.origin,
        data: event.data,
      });
      if (!accepted) return;

      var result = handleIncomingPackage(event.data.payload, global.GridGraderTransferSchema);
      if (!result.ok) {
        // The error message names only which field failed (see
        // transfer-schema.js) — never the student data itself.
        console.warn("[GridGrader Canvas Companion] rejected transfer package: " + result.error);
        return;
      }

      chrome.storage.local.set({
        gridgraderCanvasPackage: result.pkg,
        gridgraderCanvasPackageReceivedAt: Date.now(),
      });
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
