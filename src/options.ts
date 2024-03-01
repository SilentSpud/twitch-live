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

const checkLogin = async (userInfo: { isLoggedIn: Boolean; userName: string }) => {
  const authBtn = document.getElementById("authenticateButton") as HTMLButtonElement;
  const userNameField = document.getElementById("userName") as HTMLSpanElement;
  authBtn.disabled = false;

  if (userInfo.isLoggedIn) {
    authBtn.innerHTML = "Log out of Twitch account";
    authBtn.classList.remove("btn-success");
    authBtn.classList.add("btn-warning");
    authBtn.onclick = () => sendMessage({ command: "logout" });
    userNameField.innerHTML = `Logged in as ${userInfo.userName}`;
  } else {
    authBtn.innerHTML = "Log in to Twitch account";
    authBtn.classList.remove("btn-warning");
    authBtn.classList.add("btn-success");
    authBtn.onclick = () => sendMessage({ command: "login" });
    userNameField.innerHTML = "Not logged in";
  }
};

sendMessage({ command: "getInfo" });
window.addEventListener("storage", () => window.setTimeout(() => sendMessage({ command: "getInfo" }), 500));
