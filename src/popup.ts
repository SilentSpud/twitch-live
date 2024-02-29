import type { Message } from "./background";
import browser from "webextension-polyfill";

const background = browser.runtime.connect({ name: "popup" });
const sendMessage = (message: Message) => background.postMessage(message);
background.onMessage.addListener((message: Message) => {
  switch (message.command) {
    case "info":
      if (!message.data.isLoggedIn) {
        const optionsErrorDiv = document.querySelector<HTMLDivElement>("#optionsErrorDiv");
        if (!optionsErrorDiv) throw new Error("Error working with document.");
        optionsErrorDiv.style.display = "";
      }
      break;

    case "status":
    case "error":
      setErrorMessage(message.data);
      break;

    case "streams":
      updateView(message.data);
      break;

    default:
      break;
  }
});
sendMessage({ command: "userInfo" });

function setErrorMessage(msg: string = "") {
  if (msg !== "") {
    //need this slight delay, or else the html wont be displayed
    const errorBox = document.querySelector<HTMLDivElement>("#errorContainer");
    if (errorBox) {
      errorBox.innerHTML = msg;
      errorBox.style.display = "block";
    }
  } else {
    const errorBox = document.querySelector<HTMLDivElement>("#errorContainer");
    if (errorBox) {
      errorBox.style.display = "none";
    }
  }
}

async function init() {
  const streamList = document.querySelector<HTMLDivElement>("#streamList");
  if (!streamList) throw new Error("Error working with document.");
  Array.from(streamList.children).forEach(el => el.remove());

  document.querySelectorAll<HTMLDivElement>("#noStreamsDiv, #errorContainer, #optionsErrorDiv").forEach(el => { el.style.display = "none" });

  const refreshAnchor = document.querySelector<HTMLAnchorElement>("#refreshAnchor");
  if (!refreshAnchor) throw new Error("Error working with document.");
  refreshAnchor.addEventListener("click", () => background.postMessage({ command: "refreshStreams" } as Message));

  refreshAnchor.addEventListener("mousedown", () => document.getElementById("refreshAnchor")?.classList.add("refreshImgDown"));
  refreshAnchor.addEventListener("mouseup", () => document.getElementById("refreshAnchor")?.classList.remove("refreshImgDown"));
  refreshAnchor.addEventListener("mouseout", () => document.getElementById("refreshAnchor")?.classList.remove("refreshImgDown"));

  sendMessage({ command: "getStatus" });
  sendMessage({ command: "getStreams" });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => init());
} else {
  init();
}

function sortCategories(streams: any[]) {
  let gameHash: Record<string, any> = {};

  for (const stream of streams) {
    let game = stream.game_name;

    if (!game) {
      game = "Unknown";
    }

    if (!gameHash[game]) {
      gameHash[game] = [];
    }

    gameHash[game].push(stream);
  }

  let sortable = [];
  for (let key in gameHash) {
    if (gameHash.hasOwnProperty(key)) {
      sortable.push([key, gameHash[key]]);
    }
  }

  sortable.sort(function (_a, _b) {
    let a = _a[0].toUpperCase();
    let b = _b[0].toUpperCase();

    if (a > b) {
      return 1;
    }

    if (a < b) {
      return -1;
    }

    return 0;
  });

  return sortable;
}

const updateView = (streams: any[]) => {
  const len = streams ? streams.length : 0;

  const streamList = document.querySelector<HTMLDivElement>("#streamList");
  const noStreamsDiv = document.querySelector<HTMLDivElement>("#noStreamsDiv");
  if (!streamList || !noStreamsDiv) throw new Error("Error working with document.");
  Array.from(streamList.children).forEach(el => el.remove());

  if (!len) {
    noStreamsDiv.style.display = "";
    return;
  } else {
    noStreamsDiv.style.display = "none";
  }

  const sortedStreams = sortCategories(streams);
  let html = "";

  //for (let k = 0; k < sortLen; k++) {
  for (const category of sortedStreams) {
    //category = sortedStreams[k];
    const categoryName = category[0];

    html += `<div class="streamSectionTitle"><a draggable="false" href="https://www.twitch.tv/directory/game/${encodeURIComponent(categoryName)}">${categoryName}</a></div>`;

    const gameStreams = category[1];

    for (let i = 0; i < gameStreams.length; i++) {
      const stream = gameStreams[i];

      //sometimes the user name is empty, so we will show the
      //login name for the streamer (usually the same just different case)
      const streamName = !!stream.user_name ? stream.user_name : stream.user_login;

      html += `<div class="streamDiv"><a draggable="false" title="${stream.title.replace(/"/g, "&quot;")}" href="https://www.twitch.tv/${encodeURIComponent(
        stream.user_login
      )}">${streamName}<span class="channelCount">${new Intl.NumberFormat().format(stream.viewer_count)}</span></a></div>`;
    }

    html += "<div>&nbsp;</div>";
  }

  streamList.innerHTML = html;
};
