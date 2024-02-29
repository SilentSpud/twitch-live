import type { Message } from "./background";
import browser from "webextension-polyfill";

const background = browser.runtime.connect({ name: "options" });
background.onMessage.addListener((message: Message) => {
  switch (message.command) {
    case "info":
      if (!message.data.isLoggedIn) {
        $("#optionsErrorDiv").show();
      }
      break;

    case "status":
      setErrorMessage(message.data);
      break;

    case "streams":
      updateView(message.data);
      break;

    default:
      break;
  }
});
background.postMessage({ command: "userInfo" } as Message);

function setErrorMessage(msg: string = "") {
  if (msg !== "") {
    //need this slight delay, or else the html wont be displayed
    $("#errorContainer").show().html(msg);
  } else {
    $("#errorContainer").hide();
  }
}

async function init() {
  $("#streamList").empty();
  $("#noStreamsDiv").hide();
  $("#errorContainer").hide();
  $("#optionsErrorDiv").hide();
  $("#refreshAnchor").on("click", () => background.postMessage({ command: "refreshStreams" } as Message));
  $("#optionsAnchor").on("click", () => chrome.tabs.create({ url: "options.html" }));

  $("#refreshAnchor").on("mousedown", () => document.getElementById("refreshAnchor")?.classList.remove("refreshImgDown"));
  $("#refreshAnchor").on("mouseup mouseout", () => document.getElementById("refreshAnchor")?.classList.add("refreshImgDown"));

  background.postMessage({ command: "getStatus" } as Message);
  background.postMessage({ command: "getStreams" } as Message);

  //this is required so we can get the mouse cursor to change on hover

  //hack to work around chrome extension bug that gives focus to the refreshAnchor
  setTimeout(() => $("#refreshAnchor").trigger("blur"), 100);
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

  $(".streamDiv").off("click");
  $("#streamList").empty();

  if (!len) {
    $("#noStreamsDiv").show();
    return;
  } else {
    $("#noStreamsDiv").hide();
  }

  const sortedStreams = sortCategories(streams);
  let html = "";

  //for (let k = 0; k < sortLen; k++) {
  for (const category of sortedStreams) {
    //category = sortedStreams[k];
    const categoryName = category[0];

    html += `<div class="streamSectionTitle"><a href="https://www.twitch.tv/directory/game/${encodeURIComponent(categoryName)}">${categoryName}</a></div>`;

    const gameStreams = category[1];

    for (let i = 0; i < gameStreams.length; i++) {
      const stream = gameStreams[i];

      //sometimes the user name is empty, so we will show the
      //login name for the streamer (usually the same just different case)
      const streamName = !!stream.user_name ? stream.user_name : stream.user_login;

      html += `<div class="streamDiv"><a title="${stream.title.replace(/"/g, "&quot;")}" href="https://www.twitch.tv/${encodeURIComponent(
        stream.user_login
      )}">${streamName}<span class="channelCount">${new Intl.NumberFormat().format(stream.viewer_count)}</span></a></div>`;
    }

    html += "<div>&nbsp;</div>";
  }

  $("#streamList").append(html);

  // Replaced these with plain links
  /*document.querySelectorAll(".streamDiv").forEach(el => el.addEventListener("click", () => {

  }));

  document.querySelectorAll(".streamSectionTitle").forEach(el => el.addEventListener("click", () => {
    
  }));*/
};
