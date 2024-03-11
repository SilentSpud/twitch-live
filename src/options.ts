/*
	Copyright 2012
	Mike Chambers
	mikechambers@gmail.com

	http://www.mikechambers.com
*/

import type { Message } from "./background";
import browser from "webextension-polyfill";

class TwitchLiveOptions {

  /** Port for communication with the background script
   * @private
   */
  #background: browser.Runtime.Port;

  #sendMessage = (message: Message) => this.#background.postMessage(message);


  #authButton: HTMLButtonElement;
  #userNameField: HTMLSpanElement;

  constructor() {
    this.#background = browser.runtime.connect({ name: "options" });
    this.#background.onMessage.addListener(this.listener.bind(this));

    this.#userNameField = document.getElementById("userName") as HTMLSpanElement;
    this.#authButton = document.getElementById("authenticateButton") as HTMLButtonElement;

    this.#authButton.addEventListener("click", (event) => {
      if (event.target instanceof HTMLButtonElement) {
        if (event.target.classList.contains("btn-warning")) {
          this.#authButton.disabled = true;
          this.#sendMessage({ command: "logout" });
          window.setTimeout(() => this.#sendMessage({ command: "getInfo" }), 500);
        } else {
          this.#authButton.disabled = true;
          this.#sendMessage({ command: "login" });
        }
      }
    });
    this.#sendMessage({ command: "getInfo" });
  }

  async #checkLogin(userInfo: { isLoggedIn: Boolean; userName: string }) {
    this.#authButton.disabled = false;

    if (userInfo.isLoggedIn) {
      this.#authButton.innerHTML = "Log out of Twitch account";
      this.#authButton.classList.remove("btn-success");
      this.#authButton.classList.add("btn-warning");
      this.#userNameField.innerHTML = `Logged in as ${userInfo.userName}`;
    } else {
      this.#authButton.innerHTML = "Log in to Twitch account";
      this.#authButton.classList.remove("btn-warning");
      this.#authButton.classList.add("btn-success");
      this.#userNameField.innerHTML = "Not logged in";
    }
  }

  listener(message: Message) {
    switch (message.command) {
      case "info":
        this.#checkLogin(message.data);
        break;
    }
  }
}
new TwitchLiveOptions();
