/*
    Copyright 2022
    Mike Chambers
    mikechambers@gmail.com

    http://www.mikechambers.com
*/
import browser from "webextension-polyfill";

type AuthMessage = { command: "login" };
type LogoutMessage = { command: "logout" };
type UserInfoMessage = { command: "getInfo" };
type UserInfo = { isLoggedIn: boolean; userName: string };
type InfoMessage = { command: "info"; data: UserInfo };
type GetStreamsMessage = { command: "getStreams" };
type StreamsMessage = { command: "streams"; data: Record<string, any>[] };
type RefreshStreamsMessage = { command: "refreshStreams" };
type GetStatusMessage = { command: "getStatus" };
type StatusMessage = { command: "status"; data: string };
export type Message = AuthMessage | LogoutMessage | UserInfoMessage | InfoMessage | GetStreamsMessage | StreamsMessage | RefreshStreamsMessage | GetStatusMessage | StatusMessage;

export type TwitchUserData = {
  user_login: string;
  user_name: string;
  game_name: string;
  type: "live";
  title: string;
  viewer_count: number;
  started_at: string;
};
export type TwitchUserResponse = {
  data: TwitchUserData[];
  pagination?: {
    cursor: string;
  };
};

/**
 * Represents a Twitch live background class.
 * @class
 */
class TwitchLiveBackground {
  /** The Twitch client ID.
   * @private
   */
  #ClientID: string = "qxn1utz0tedn3vjv4k0tlrf5zfnpr3";

  /** The update interval for the background in milliseconds.
   * @default 2 minutes (2 * 60 * 1000 milliseconds)
   */
  UpdateInterval: number = 30 * 1000;

  /** Twitch API access token.
   * @private
   */
  #AccessToken: string = "";

  /** Twitch user ID.
   * @private
   */
  #UserID: string = "";

  /** Twitch username.
   * @private
   */
  #UserName: string = "";

  /** Active timer
   */
  #timer: number | undefined = undefined;

  /** Array of listener ports
   *
   */
  #ports: Array<browser.Runtime.Port> = [];

  /** Twitch live streams.
   * @private
   */
  #streams: Array<any> = [];

  #errorMessage = "";

  /** Initializes a new instance of the TwitchLiveBackground class.
   * @constructor
   */
  constructor() {
    /* Load settings from local storage */
    browser.storage.local
      .get(["userId", "accessToken", "userName"])
      .then(({ userId, accessToken, userName }) => {
        if (userId && accessToken && userName) {
          this.#UserID = userId;
          this.#AccessToken = accessToken;
          this.#UserName = userName;
          this.#refresh();
        } else throw new Error("No user data found");
      })
      .catch((e) => this.#errorHandler(e.message));

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
  }

  /**
   * Inter-page message handler
   * @private
   */
  async #messenger(message: Message, port: browser.Runtime.Port) {
    switch (message.command) {
      case "login":
        this.#twitchLogin();
        break;

      case "logout":
        this.#twitchLogout();
        break;

      case "getInfo":
        port.postMessage({ command: "info", data: { isLoggedIn: this.#UserID !== "", userName: this.#UserName } } as Message);
        break;

      case "getStreams":
        port.postMessage({ command: "streams", data: this.#streams } as Message);
        break;

      case "refreshStreams":
        this.#refresh();
        break;

      case "getStatus":
        port.postMessage({ command: "status", data: this.#errorMessage } as Message);
        break;
    }
  }

  /**
   * Public listener for inter-page communication
   * @param {browser.Runtime.Port} port - The port to send and listen on.
   * @private
   */
  portListener(port: browser.Runtime.Port) {
    this.#ports.push(port);
    port.onMessage.addListener((message, port) => this.#messenger(message, port));
    port.onDisconnect.addListener((port) => {
      this.#ports = this.#ports.filter((p) => p !== port);
    });
  }

  /** Sends a message to all listening ports.
   * @param {Message} message - The message to send.
   * @private
   */
  async #sendMessage(message: Message) {
    for (const port of this.#ports) {
      port.postMessage(message);
    }
  }

  /** Makes a request to the Twitch API.
   * @param {string} url - The URL to make the request to.
   * @param {string} [method="GET"] - The HTTP method to use for the request.
   * @returns {Promise<Response>} The response from the Twitch API.
   * @private
   */
  async #fetch(url: string, method: string = "GET"): Promise<Response> {
    const request = new Request(url, {
      headers: new Headers({
        Accept: "application/vnd.twitchtv.v5+json",
        "Client-ID": this.#ClientID,
        Authorization: `Bearer ${this.#AccessToken}`,
      }),
      method: method,
      cache: "no-store",
    });

    const response = await fetch(request);
    if (!response.ok) {
      if (response.status === 401) {
        this.#twitchLogout();
      }
      throw new Error(`Error: ${response.status} : ${response.statusText}`);
    }
    return response;
  }

  #updateIcon(givenText?: string, givenColor?: string) {
    const color = givenColor ? givenColor : this.#streams.length > 0 ? "#0000FF" : "#000000";
    const text = givenText ? givenText : this.#streams.length > 0 ? String(this.#streams.length) : "";

    chrome.browserAction.setBadgeBackgroundColor({ color });
    chrome.browserAction.setBadgeText({ text });
  }

  async #refresh() {
    if (this.#timer) {
      window.clearTimeout(this.#timer);
      this.#timer = undefined;
    }
    if (!this.#UserID) {
      this.#updateIcon();
      return;
    }
    this.#timer = window.setTimeout((bg: TwitchLiveBackground) => bg.#refresh(), this.UpdateInterval, this);

    this.#refreshStreams();
  }

  async #refreshStreams() {
    this.#streams = [];

    //https://dev.twitch.tv/docs/api/reference#get-followed-streams
    const response = await this.#fetch(`https://api.twitch.tv/helix/streams/followed?first=100&user_id=${this.#UserID}`, "GET");
    const data: TwitchUserResponse = await response.json();

    this.#streams.push.apply(this.#streams, data.data);

    if (data.pagination && data.pagination.cursor) {
      let newCursor = data.pagination.cursor;

      while (newCursor) {
        const response = await this.#fetch(`https://api.twitch.tv/helix/streams/followed?first=100&user_id=${this.#UserID}&after=${newCursor}`, "GET");
        const data: TwitchUserResponse = await response.json();

        this.#streams.push.apply(this.#streams, data.data);
        newCursor = data.pagination?.cursor ?? "";
      }
    }
    this.#updateIcon();
    this.#sendMessage({ command: "streams", data: this.#streams });
  }

  async #twitchLogin() {
    const response = await browser.identity.launchWebAuthFlow({
      url: `https://id.twitch.tv/oauth2/authorize?client_id=${this.#ClientID}&force_verify=true&response_type=token&scope=user:read:follows&redirect_uri=${encodeURIComponent(
        browser.identity.getRedirectURL()
      )}`,
      interactive: true,
    });

    const search = response.split("/#");
    const params = new URLSearchParams(search[1]);
    const code = params.get("access_token");

    if (code == null) {
      console.error("Unable to parse the response from Twitch.");
      return false;
    }

    this.#AccessToken = code;
    await browser.storage.local.set({ accessToken: code });

    const data = await this.#fetch("https://api.twitch.tv/helix/users")
      .then((response) => response.json())
      .catch((e) => this.#errorHandler(e.message));
    const results = data.data;

    if (!results || results.length === 0) {
      console.error("Unable to retrieve user data from Twitch API.");
      return false;
    }

    const user = results[0];
    this.#UserID = user.id;
    this.#UserName = user.display_name;

    await browser.storage.local.set({ userId: this.#UserID, userName: this.#UserName });
  }

  async #twitchLogout() {
    if (this.#timer) {
      window.clearTimeout(this.#timer);
      this.#timer = undefined;
    }

    this.#streams = [];
    this.#updateIcon();

    await browser.storage.local.remove(["userId", "accessToken", "userName"]);

    await this.#fetch(`https://id.twitch.tv/oauth2/revoke?client_id=${this.#ClientID}&token=${this.#AccessToken}`, "POST");

    this.#AccessToken = "";
    this.#UserID = "";
    this.#UserName = "";

    this.#refresh();
    this.#updateIcon();
  }

  #errorHandler(errorMsg: string) {
    if (errorMsg) {
      this.#updateIcon("?", "#ff0000");
    }
  }
}

const background: TwitchLiveBackground = new TwitchLiveBackground();

browser.runtime.onConnect.addListener(background.portListener.bind(background));
