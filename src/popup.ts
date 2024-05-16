import type { Message, TwitchUserData } from "./types";
import browser from "webextension-polyfill";

/**
  Represents a Twitch live popup class.
  @class
*/
class TwitchLivePopup {
  /** Port for communication with the background script
   * @private
   */
  #background: browser.Runtime.Port;

  #sendMessage = (message: Message | Message[]) => Array.isArray(message) ? message.forEach(msg => this.#background.postMessage(msg)) : this.#background.postMessage(message);

  #listElement: HTMLDivElement;
  #optionsErrorDiv: HTMLDivElement;
  #errorContainer: HTMLDivElement;
  #refreshAnchor: HTMLAnchorElement;
  #noStreamsDiv: HTMLDivElement;

  constructor() {
    this.#background = browser.runtime.connect({ name: "options" });
    this.#background.onMessage.addListener(this.listener.bind(this));

    this.#listElement = document.getElementById("streamList") as HTMLDivElement;
    this.#listElement.childNodes.forEach((el) => el.remove());

    this.#refreshAnchor = document.getElementById("refreshAnchor") as HTMLAnchorElement;
    this.#refreshAnchor.addEventListener("click", () => this.#sendMessage({ command: "refreshStreams" }));
    this.#refreshAnchor.addEventListener("mousedown", () => this.#refreshAnchor.classList.add("refreshImgDown"));
    this.#refreshAnchor.addEventListener("mouseup", () => this.#refreshAnchor.classList.remove("refreshImgDown"));
    this.#refreshAnchor.addEventListener("mouseout", () => this.#refreshAnchor.classList.remove("refreshImgDown"));

    this.#errorContainer = document.getElementById("errorContainer") as HTMLDivElement;
    this.#optionsErrorDiv = document.getElementById("optionsErrorDiv") as HTMLDivElement;
    this.#noStreamsDiv = document.getElementById("noStreamsDiv") as HTMLDivElement;
    [this.#errorContainer, this.#optionsErrorDiv, this.#noStreamsDiv].forEach((el) => (el.style.display = "none"));

    this.#sendMessage([{ command: "getInfo" }, { command: "getStatus" }, { command: "getStreams" }]);
  }

  #setStatus(msg: string = "") {
    if (msg !== "") {
      this.#errorContainer.textContent = msg;
      this.#errorContainer.style.display = "";
    } else {
      this.#errorContainer.style.display = "none";
    }
  }

  #updateView = (streams: any[]) => {
    const streamList = document.querySelector<HTMLDivElement>("#streamList");
    const noStreamsDiv = document.querySelector<HTMLDivElement>("#noStreamsDiv");
    if (!streamList || !noStreamsDiv) throw new Error("Error working with document.");
    Array.from(streamList.children).forEach((el) => el.remove());

    if (streams.length === 0) {
      noStreamsDiv.style.display = "";
      return;
    } else {
      noStreamsDiv.style.display = "none";
    }

    const sortedStreams = this.#sortCategories(streams);

    let html = "";

    for (const [categoryName, gameStreams] of sortedStreams) {
      html += `<div class="streamSectionTitle"><a class="text-body" draggable="false" href="https://www.twitch.tv/directory/game/${encodeURIComponent(categoryName)}">${categoryName}</a></div>`;

      for (const stream of gameStreams) {
        //sometimes the user name is empty, so we will show the login name for the streamer (usually the same just different case)
        const streamName = stream.user_name ?? stream.user_login;

        html += `<div class="streamDiv"><a class="text-body" draggable="false" title="${stream.title.replace(/"/g, "&quot;")}" href="https://www.twitch.tv/${encodeURIComponent(
          stream.user_login
        )}">${streamName}<span class="channelCount">${new Intl.NumberFormat().format(stream.viewer_count)}</span></a></div>`;
      }

      html += "<div>&nbsp;</div>";
    }

    streamList.innerHTML = html;
  };

  #sortCategories(streams: TwitchUserData[]) {
    const gameList: Record<string, TwitchUserData[]> = {};
  
    for (const stream of streams) {
      const game = stream.game_name || "Unknown";
  
      if (!gameList[game]) {
        gameList[game] = [];
      }
  
      gameList[game].push(stream);
    }
  
    return Object.entries(gameList).toSorted(function ([gameA], [gameB]) {
      const nameA = gameA.toUpperCase();
      const nameB = gameB.toUpperCase();
  
      if (nameA > nameB) return 1;
      if (nameB < nameB) return -1;
      return 0;
    });
  }

  listener(message: Message) {
    switch (message.command) {
      case "info":
        if (!message.data.isLoggedIn) {
          this.#optionsErrorDiv.style.display = "";
        }
        break;

      case "status":
        this.#setStatus(message.data);
        break;

      case "streams":
        this.#updateView(message.data);
        break;
    }
  }
}
new TwitchLivePopup();