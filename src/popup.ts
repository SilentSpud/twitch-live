import type { Message, TwitchUserData } from "./background";
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
      setErrorMessage(message.data);
      break;

    case "streams":
      updateView(message.data);
      break;
  }
});
sendMessage({ command: "getInfo" });
sendMessage({ command: "getStatus" });
sendMessage({ command: "getStreams" });

const streamList = document.querySelector<HTMLDivElement>("#streamList");
if (!streamList) throw new Error("Error working with document.");
Array.from(streamList.children).forEach((el) => el.remove());

document.querySelectorAll<HTMLDivElement>("#noStreamsDiv, #errorContainer, #optionsErrorDiv").forEach((el) => {
  el.style.display = "none";
});

const refreshAnchor = document.querySelector<HTMLAnchorElement>("#refreshAnchor");
if (!refreshAnchor) throw new Error("Error working with document.");
refreshAnchor.addEventListener("click", () => background.postMessage({ command: "refreshStreams" } as Message));

refreshAnchor.addEventListener("mousedown", () => document.getElementById("refreshAnchor")?.classList.add("refreshImgDown"));
refreshAnchor.addEventListener("mouseup", () => document.getElementById("refreshAnchor")?.classList.remove("refreshImgDown"));
refreshAnchor.addEventListener("mouseout", () => document.getElementById("refreshAnchor")?.classList.remove("refreshImgDown"));

function setErrorMessage(msg: string = "") {
  if (msg !== "") {
    //need this slight delay, or else the html wont be displayed
    const errorBox = document.querySelector<HTMLDivElement>("#errorContainer");
    if (errorBox) {
      errorBox.innerHTML = msg;
      errorBox.style.display = "";
    }
  } else {
    const errorBox = document.querySelector<HTMLDivElement>("#errorContainer");
    if (errorBox) {
      errorBox.style.display = "none";
    }
  }
}

function sortCategories(streams: TwitchUserData[]) {
  const gameList: Record<string, TwitchUserData[]> = {};

  for (const stream of streams) {
    const game = stream.game_name ?? "Unknown";

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

const updateView = (streams: any[]) => {
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

  const sortedStreams = sortCategories(streams);

  let html = "";

  const formatter = new Intl.NumberFormat();
  for (const [categoryName, gameStreams] of sortedStreams) {
    html += `<div class="streamSectionTitle"><a class="text-body" draggable="false" href="https://www.twitch.tv/directory/game/${encodeURIComponent(categoryName)}">${categoryName}</a></div>`;

    for (const stream of gameStreams) {
      //sometimes the user name is empty, so we will show the login name for the streamer (usually the same just different case)
      const streamName = stream.user_name ?? stream.user_login;

      html += `<div class="streamDiv"><a class="text-body" draggable="false" title="${stream.title.replace(/"/g, "&quot;")}" href="https://www.twitch.tv/${encodeURIComponent(
        stream.user_login
      )}">${streamName}<span class="channelCount">${formatter.format(stream.viewer_count)}</span></a></div>`;
    }

    html += "<div>&nbsp;</div>";
  }

  streamList.innerHTML = html;
};
