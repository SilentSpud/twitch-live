/*
    Copyright 2022
    Mike Chambers
    mikechambers@gmail.com

    http://www.mikechambers.com
*/
import browser from "webextension-polyfill";
import type { TwitchUserData, Message, TwitchUserResponse } from "./types";

const CLIENT_ID = "qxn1utz0tedn3vjv4k0tlrf5zfnpr3";

const config: {
  UpdateInterval: number;
  AccessToken: string;
  UserID: string;
  UserName: string;
} = {
  /** Update interval for  in milliseconds.
   * @default 2 minutes (2 * 60 * 1000 milliseconds)
   */
  UpdateInterval: 30 * 1000,

  /** Twitch API access token
   */
  AccessToken: "",

  /** Twitch user ID
   */
  UserID: "",

  /** Twitch username
   */
  UserName: "",
};

let ports: browser.Runtime.Port[] = [];
let streams: TwitchUserData[] = [];
let timer: number | undefined;

let status: string = "";
const errorHandler = (errorMsg: string) => {
  status = errorMsg;
  updateIcon("?", "#ff0000");
};

/** Updates the browser action icon.
 * @param {string} [iconText] - The text to display. Defaults to the number of streams live.
 * @param {string} [iconColor] - The color to use for the badge. Defaults to blue if at least one stream is live, black if not.
 */
const updateIcon = (iconText?: string, iconColor?: string) => {
  const color = iconColor || !streams.length ? "#0000FF" : "#000000";
  const text = iconText || streams.length.toString();
  chrome.browserAction.setBadgeBackgroundColor({ color });
  chrome.browserAction.setBadgeText({ text });
};

/** Fetch wrapper for Twitch API
 * @param {string} url - The URL to fetch
 * @param {string} method - The HTTP method to use
 * @returns {Promise<Response>}
 */
const twitchFetch = async (url: string, method: string = "GET"): Promise<Response> => {
  const request = new Request(url, {
    headers: new Headers({
      Accept: "application/vnd.twitchtv.v5+json",
      "Client-ID": CLIENT_ID,
      Authorization: `Bearer ${config.AccessToken}`,
    }),
    method: method,
    cache: "no-store",
  });

  const response = await fetch(request);
  if (!response.ok && response.status === 401) {
    twitchLogout();
  }
  return response;
};

/**
 * Public listener for inter-page communication
 * @param {browser.Runtime.Port} port - The port to send and listen on
 */
const portListener = (port: browser.Runtime.Port) => {
  ports.push(port);
  port.onMessage.addListener((message, port) => messenger(message, port));
  port.onDisconnect.addListener((port) => {
    ports = ports.filter((p) => p !== port);
  });
};

/** Public listener for local storage changes
 * @param {StorageEvent} event - The storage event
 */
const storageListener = (event: StorageEvent) => {
  if (event.key === "accessToken") {
    config.AccessToken = event.newValue ?? "";
    refresh();
  }
};

/** Sends a message to all listening ports.
 * @param {Message} message - The message to send.
 * @private
 */
const sendToAll = async (message: Message) => {
  for (const port of ports) {
    port.postMessage(message);
  }
};

/** Refresh the list of live streams
 */
const refresh = async () => {
  if (timer) {
    window.clearTimeout(timer);
    timer = undefined;
  }
  if (!config.UserID) {
    updateIcon();
    return;
  }

  streams = [];

  //https://dev.twitch.tv/docs/api/reference#get-followed-streams
  const response = await twitchFetch(`https://api.twitch.tv/helix/streams/followed?first=100&user_id=${config.UserID}`, "GET");
  const data: TwitchUserResponse = await response.json();

  streams.push.apply(streams, data.data);

  if (data.pagination && data.pagination.cursor) {
    let newCursor = data.pagination.cursor;

    while (newCursor != "") {
      const response = await twitchFetch(`https://api.twitch.tv/helix/streams/followed?first=100&user_id=${config.UserID}&after=${newCursor}`, "GET");
      const data: TwitchUserResponse = await response.json();

      streams.push(...data.data);
      newCursor = data.pagination?.cursor ?? "";
    }
  }

  status = "";
  updateIcon();
  timer = window.setTimeout(refresh, config.UpdateInterval);
  sendToAll({ command: "streams", data: streams });
};

/** Log in to Twitch and retrieve credentials
 */
const twitchLogin = async () => {
  const redir = encodeURIComponent(browser.identity.getRedirectURL());
  const url = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&force_verify=true&response_type=token&scope=user:read:follows&redirect_uri=${redir}`;
  const response = await browser.identity.launchWebAuthFlow({ url, interactive: true });

  const search = response.split("/#");
  const params = new URLSearchParams(search[1]);
  const code = params.get("access_token");

  if (code == null) {
    console.error("Unable to parse the response from Twitch.");
    return;
  }

  config.AccessToken = code;
  await browser.storage.local.set({ accessToken: code });

  const data = await twitchFetch("https://api.twitch.tv/helix/users")
    .then((response) => response.json())
    .catch((e) => errorHandler(e.message));
  const results = data.data;

  if (!results || results.length === 0) {
    console.error("Unable to retrieve user data from Twitch API.");
    return;
  }

  const user = results[0];
  config.UserID = user.id;
  config.UserName = user.display_name;

  await browser.storage.local.set({ userId: config.UserID, userName: config.UserName });
  refresh();
};

/** Clear and revoke Twitch credentials
 */
const twitchLogout = async () => {
  if (timer) {
    window.clearTimeout(timer);
    timer = undefined;
  }

  streams = [];
  updateIcon();

  await browser.storage.local.remove(["userId", "accessToken", "userName"]);

  await twitchFetch(`https://id.twitch.tv/oauth2/revoke?client_id=${CLIENT_ID}&token=${config.AccessToken}`, "POST");

  config.AccessToken = "";
  config.UserID = "";
  config.UserName = "";

  refresh();
  updateIcon();
};

/* Load settings from local storage */
browser.storage.local
  .get(["userId", "accessToken", "userName"])
  .then(({ userId, accessToken, userName }) => {
    if (userId && accessToken && userName) {
      config.UserID = userId;
      config.AccessToken = accessToken;
      config.UserName = userName;
      refresh();
    } else throw new Error("No user data found");
  })
  .catch((e) => errorHandler(e.message));

/* Create context menus */
browser.contextMenus.create({
  title: "About Twitch Live",
  contexts: ["browser_action"],
  onclick: () => browser.tabs.create({ url: "about.html" }),
});

browser.contextMenus.create({
  title: "Twitch Live Options",
  contexts: ["browser_action"],
  onclick: () => browser.tabs.create({ url: "options.html" }),
});

browser.runtime.onConnect.addListener(portListener);
window.addEventListener("storage", storageListener);

/** Inter-page message handler
 */
const messenger = async (message: Message, port: browser.Runtime.Port) => {
  switch (message.command) {
    case "login":
      twitchLogin();
      break;

    case "logout":
      twitchLogout();
      break;

    case "getInfo":
      port.postMessage({ command: "info", data: { isLoggedIn: !!config.UserID, userName: config.UserName } } as Message);
      break;

    case "getStreams":
      port.postMessage({ command: "streams", data: streams } as Message);
      break;

    case "refreshStreams":
      refresh();
      break;

    case "getStatus":
      port.postMessage({ command: "status", data: status } as Message);
      break;
  }
};
