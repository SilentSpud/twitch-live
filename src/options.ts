/*
	Copyright 2012
	Mike Chambers
	mikechambers@gmail.com

	http://www.mikechambers.com
*/

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
  let userName = background.userName;

  let authBtn = document.getElementById("authenticateButton");
  let userNameField = document.getElementById("userName");

  if (background.isLoggedIn) {
    authBtn.innerHTML = "Log out of Twitch";
    authBtn.onclick = logOutTwitch;
    userNameField.innerHTML = userName + "&nbsp;&nbsp;";
  } else {
    authBtn.innerHTML = "Authenticate with Twitch";
    authBtn.onclick = authenticateWithTwitch;
    userNameField.innerHTML = "";
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

let init = async function () {
  background = chrome.extension.getBackgroundPage().background;

  checkLogin();

  openInPopoutCB = document.getElementById("openInPopoutCheck");

  /** @type {{ userId: string, accessToken: string, userName: string }} */
  const { openInPopout } = await browser.storage.sync.get(["openInPopout"]);

  if (openInPopout) {
    openInPopoutCB.checked = true;
  }

  openInPopoutCB.removeEventListener("change", onOpenInPopupChange);
  openInPopoutCB.addEventListener("change", onOpenInPopupChange);
};

init();

window.isOptions = true;

window.addEventListener("storage", onStorageUpdate);
