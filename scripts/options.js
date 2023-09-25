/*
	Copyright 2012
	Mike Chambers
	mikechambers@gmail.com

	http://www.mikechambers.com
*/

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global localStorage, document, chrome, setTimeout*/

(function () {
  "use strict";
  let openInPopoutCB;

  let authenticateWithTwitch = function () {
    background.authenticateWithTwitch();
  };

  let logOutTwitch = function () {
    background.logOutTwitch(true);
  };

  let save = function () {
    storeData();
  };

  let storeData = function () {
    localStorage.openInPopout = openInPopoutCB.checked;

    showStatusMessage("Options Saved");
  };

  let showStatusMessage = function (msg) {
    let status = document.getElementById("status");
    status.innerHTML = msg;
    status.style.opacity = 1;

    setTimeout(function () {
      status.innerHTML = "";
      status.style.opacity = 0;
    }, 4000);
  };

  let checkLogin = function () {
    let userId = localStorage[background.USER_ID_STORAGE_TOKEN];
    let accessToken = localStorage[background.ACCESS_TOKEN_STORAGE_TOKEN];
    let userName = localStorage[background.USER_NAME_STORAGE_TOKEN];

    let authenticateButton = document.getElementById("authenticateButton");
    let userNameField = document.getElementById("userName");

    if (!accessToken || !userId) {
      authenticateButton.innerHTML = "Authenticate with Twitch";
      authenticateButton.onclick = authenticateWithTwitch;
      userNameField.innerHTML = "";
    } else {
      authenticateButton.innerHTML = "Log out of Twitch";
      authenticateButton.onclick = logOutTwitch;
      userNameField.innerHTML = userName + "&nbsp;&nbsp;";
    }
  };

  let onStorageUpdate = function () {
    window.removeEventListener("storage", onStorageUpdate);
    window.addEventListener("storage", onStorageUpdate);
    init();
  };

  let onOpenInPopupChange = function () {
    storeData();
  };

  let background;
  let init = function () {
    background = chrome.extension.getBackgroundPage();

    checkLogin();

    openInPopoutCB = document.getElementById("openInPopoutCheck");
    let openInPopout = localStorage.openInPopout === "true";

    if (openInPopout) {
      openInPopoutCB.checked = true;
    }

    openInPopoutCB.removeEventListener("change", onOpenInPopupChange);
    openInPopoutCB.addEventListener("change", onOpenInPopupChange);
  };

  init();

  window.isOptions = true;

  window.addEventListener("storage", onStorageUpdate);
})();
