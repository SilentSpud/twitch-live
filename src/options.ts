/*
	Copyright 2012
	Mike Chambers
	mikechambers@gmail.com

	http://www.mikechambers.com
*/

import type { Message } from "./types";
import browser from "webextension-polyfill";

const background = browser.runtime.connect({ name: "options" });
const sendMessage = (message: Message | Message[]) => (Array.isArray(message) ? message.forEach((msg) => background.postMessage(msg)) : background.postMessage(message));
background.onMessage.addListener((message: Message) => {
  if (!message.command) return;
  switch (message.command) {
    case "info":
      checkLogin(message.data);
      break;
  }
});
sendMessage({ command: "getInfo" });

const userNameField = document.getElementById("userName") as HTMLSpanElement;
const authBtn = document.getElementById("authenticateButton") as HTMLButtonElement;

authBtn.addEventListener("click", (event) => {
  if (event.target instanceof HTMLButtonElement) {
    authBtn.disabled = true;
    if (event.target.classList.contains("btn-warning")) {
      sendMessage({ command: "logout" });
      window.setTimeout(() => location.reload(), 1000);
    } else {
      sendMessage({ command: "login" });
    }
  }
});

const checkLogin = async (userInfo: { isLoggedIn: boolean; userName: string }) => {
  authBtn.disabled = false;

  if (userInfo.isLoggedIn) {
    authBtn.classList.remove("btn-success");
    authBtn.classList.add("btn-warning");
    authBtn.innerHTML = "Log out of Twitch account";
    userNameField.innerHTML = `Logged in as ${userInfo.userName}`;
  } else {
    authBtn.classList.remove("btn-warning");
    authBtn.classList.add("btn-success");
    authBtn.innerHTML = "Log in to Twitch account";
    userNameField.innerHTML = "Not logged in";
  }
};
