import type { Message, TwitchUserData } from "./types";
import browser from "webextension-polyfill";

const background = browser.runtime.connect({ name: "options" });
const sendMessage = (message: Message | Message[]) => (Array.isArray(message) ? message.forEach((msg) => background.postMessage(msg)) : background.postMessage(message));

const listElement = document.getElementById("streamList") as HTMLDivElement;
listElement.childNodes.forEach((el) => el.remove());

const refreshAnchor = document.getElementById("refreshAnchor") as HTMLAnchorElement;
refreshAnchor.addEventListener("click", () => sendMessage({ command: "refreshStreams" }));
const refreshSpin = () => refreshAnchor.classList.toggle("spin");
refreshAnchor.addEventListener("mousedown", refreshSpin);
refreshAnchor.addEventListener("mouseup", refreshSpin);
refreshAnchor.addEventListener("mouseout", refreshSpin);

const errorContainer = document.getElementById("errorContainer") as HTMLDivElement;
const optionsErrorDiv = document.getElementById("optionsErrorDiv") as HTMLDivElement;
const noStreamsDiv = document.getElementById("noStreamsDiv") as HTMLDivElement;
[errorContainer, optionsErrorDiv, noStreamsDiv].forEach((el) => (el.style.display = "none"));

sendMessage([{ command: "getInfo" }, { command: "getStatus" }, { command: "getStreams" }]);

background.onMessage.addListener((message: Message) => {
  switch (message.command) {
    case "info":
      if (!message.data.isLoggedIn) {
        optionsErrorDiv.style.display = "";
      }
      break;

    case "status":
      if (message.data !== "") {
        errorContainer.textContent = message.data;
        errorContainer.style.display = "";
      } else {
        errorContainer.textContent = "";
        errorContainer.style.display = "none";
      }
      break;

    case "streams":
      updateView(message.data);
      break;
  }
});

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

  const html = <>
    {sortedStreams.map(([categoryName, gameStreams]) => <>
      <div class="streamSectionTitle">
        <a class="text-body" draggable="false" href={"https://www.twitch.tv/directory/game/" + encodeURIComponent(categoryName)}>{categoryName}</a>
      </div>
      {gameStreams.map((stream) => {

        return <div class="streamDiv">
          <a class="text-body" draggable="false" title={stream.title.replace(/"/g, "&quot;")} href={`https://www.twitch.tv/${encodeURIComponent(stream.user_login)}`}>{stream.user_name ?? stream.user_login}<span class="channelCount">{new Intl.NumberFormat().format(stream.viewer_count)}</span></a>
        </div>
      })}
      <div>&nbsp;</div>
    </>)}
  </>;

  streamList.innerHTML = html.toString();
};

const sortCategories = (streams: TwitchUserData[]) => {
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
};
