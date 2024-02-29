/*
	Copyright 2012
	Mike Chambers
	mikechambers@gmail.com

	http://www.mikechambers.com
*/

import type { Message } from "./background";
import browser from "webextension-polyfill";

const background = browser.runtime.connect({ name: "options" });
const sendMessage = (message: Message) => background.postMessage(message);
background.onMessage.addListener((message: Message) => {
  switch (message.command) {
    case "info":
      checkLogin(message.data);
      break;
  }
});

const authenticateWithTwitch = () => sendMessage({ command: "login" });
const logOutTwitch = () => sendMessage({ command: "logout" });

const checkLogin = async (userInfo: { isLoggedIn: Boolean; userName: string }) => {
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
  sendMessage({ command: "getInfo" });
};

window.addEventListener("storage", onStorageUpdate);
