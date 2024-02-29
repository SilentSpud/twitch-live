/*
	Copyright 2012
	Mike Chambers
	mikechambers@gmail.com

	http://www.mikechambers.com
*/

import type { Message } from "./background";
import browser from "webextension-polyfill";

let openInPopout: boolean = false;
const background = browser.runtime.connect({ name: "options" });
background.onMessage.addListener((message: Message) => {
  switch (message.command) {
    case "info":
      checkLogin(message.data);
      break;
    case "popout":
      openInPopout = message.data;
      document.querySelectorAll<HTMLInputElement>("#openInPopoutCheck").forEach(el => { el.checked = openInPopout });
      break;
    default:
      break;
  }
});


const authenticateWithTwitch = () => background.postMessage({ command: "twitchAuth" } as Message);
const logOutTwitch = () => background.postMessage({ command: "twitchLogout" } as Message);

const storeData = function () {
  const popoutBox = document.getElementById("openInPopoutCheck") as HTMLInputElement;
  background.postMessage({ command: "setPopout", data: popoutBox.checked } as Message);

  showStatusMessage("Options Saved");
};

const showStatusMessage = function (msg: string) {
  const status = document.getElementById("status");
  if (!status) throw new Error("status element not found");
  status.innerHTML = msg;
  status.style.opacity = "1";

  setTimeout(function () {
    status.innerHTML = "";
    status.style.opacity = "0";
  }, 4000);
};

const checkLogin = async (userInfo: { isLoggedIn: Boolean; userName: string; }) => {
  const authBtn = document.getElementById("authenticateButton") as HTMLButtonElement;
  const userNameField = document.getElementById("userName") as HTMLSpanElement;

  if (userInfo.isLoggedIn) {
    authBtn.innerHTML = "Log out of Twitch";
    authBtn.onclick = logOutTwitch;
    authBtn.disabled = false;
    userNameField.innerHTML = userInfo.userName + "&nbsp;&nbsp;";
  } else {
    authBtn.innerHTML = "Authenticate with Twitch";
    authBtn.onclick = authenticateWithTwitch;
    authBtn.disabled = false;
    userNameField.innerHTML = "";
  }
};

const onStorageUpdate = function () {
  window.removeEventListener("storage", onStorageUpdate);
  window.addEventListener("storage", onStorageUpdate);
  init();
};

const onOpenInPopupChange = () => storeData();

const init = async () => {
  background.postMessage({ command: "userInfo" } as Message);

  const popoutBox = document.getElementById("openInPopoutCheck") as HTMLInputElement;
  popoutBox.removeEventListener("change", onOpenInPopupChange);
  popoutBox.addEventListener("change", onOpenInPopupChange);
};

init();

window.addEventListener("storage", onStorageUpdate);
