/*
    Copyright 2022
    Mike Chambers
    mikechambers@gmail.com

    http://www.mikechambers.com
*/
import browser from "webextension-polyfill";

type AuthMessage = { command: "twitchAuth" };
type LoggedInMessage = { command: "loggedin" };
type LogoutMessage = { command: "twitchLogout" };
type LoggedOutMessage = { command: "loggedout"; data: boolean };
type UserInfoMessage = { command: "userInfo" };
type InfoMessage = { command: "info"; data: { isLoggedIn: boolean; userName: string } };
type GetStreamsMessage = { command: "getStreams" };
type StreamsMessage = { command: "streams"; data: Record<string, any>[] };
type RefreshStreamsMessage = { command: "refreshStreams" };
type GetStatusMessage = { command: "getStatus" };
type StatusMessage = { command: "status"; data: string };
type ErrorMessage = { command: "error"; data: string };
export type Message = AuthMessage | LoggedInMessage | LogoutMessage | LoggedOutMessage | UserInfoMessage | InfoMessage | GetStreamsMessage | StreamsMessage | RefreshStreamsMessage | GetStatusMessage | StatusMessage | ErrorMessage;

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
   * @default 2 minutes (2 * 1000 * 60 milliseconds)
   */
  UpdateInterval: number = 2 * 1000 * 60;

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
  _timer: number | undefined = undefined;

  /** Array of listener ports
   *
   */
  #ports: Array<browser.Runtime.Port> = [];

  /** Twitch live streams.
   * @private
   */
  #streams: Array<any> = [];

  #errorMessage = "";

  #streamBuffer = [];

  /** Initializes a new instance of the TwitchLiveBackground class.
   * @constructor
   */
  constructor() {
    this.#loadSettings();

    browser.contextMenus.create({
      title: "About Twitch Live",
      contexts: ["browser_action"],
      onclick: function () {
        browser.tabs.create({ url: "about.html" });
      },
    });

    browser.contextMenus.create({
      title: "Twitch Live Options",
      contexts: ["browser_action"],
      onclick: function () {
        browser.tabs.create({ url: "options.html" });
      },
    });
  }

  /**
   * Loads settings from local storage.
   * @private
   */
  async #loadSettings(): Promise<void> {
    try {
      type browserData = { userId: string; accessToken: string; userName: string };
      const { userId, accessToken, userName } = (await browser.storage.local.get(["userId", "accessToken", "userName"])) as browserData;

      if (userId && accessToken && userName) {
        this.#UserID = userId;
        this.#AccessToken = accessToken;
        this.#UserName = userName;
        await this.#refresh();
      } else throw new Error("No user data found");
    } catch (e) {
      await this.#twitchLogout();
    }
  }

  async listener(port: browser.Runtime.Port) {
    this.#ports.push(port);

    port.onMessage.addListener((message: Message) => this.#messenger(message, port));
    port.onDisconnect.addListener((port) => {
      // Remove the port from the list on disconnect
      this.#ports = this.#ports.filter((p) => p !== port);
    });
  }

  async #sendMessage(message: Message) {
    for (const port of this.#ports) {
      port.postMessage(message);
    }
  }

  /**
   * Asynchronous message handler
   * @private
   */
  async #messenger(message: Message, port: browser.Runtime.Port) {
    switch (message.command) {
      case "twitchAuth":
        await this.#twitchLogin();
        return port.postMessage({ command: "loggedin" } as Message);

      case "twitchLogout":
        await this.#twitchLogout();
        return port.postMessage({ command: "loggedout" } as Message);

      case "userInfo":
        return port.postMessage({ command: "info", data: { isLoggedIn: this.#UserID !== "", userName: this.#UserName } } as Message);

      case "getStreams":
        return port.postMessage({ command: "streams", data: this.#streams } as Message);

      case "refreshStreams":
        return this.#refresh();

      case "getStatus":
        return port.postMessage({ command: "status", data: this.#errorMessage } as Message);
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
    if (this._timer) {
      window.clearTimeout(this._timer);
      this._timer = undefined;
    }
    if (!this.#UserID) {
      this.#updateIcon();
      return;
    }
    this._timer = window.setTimeout((bg: TwitchLiveBackground) => bg.#refresh(), this.UpdateInterval, this);

    this.#refreshStreams();
  }

  async #refreshStreams(cursor?: string) {
    //https://dev.twitch.tv/docs/api/reference#get-followed-streams
    const data = await this.#fetch(`https://api.twitch.tv/helix/streams/followed?first=100&user_id=${this.#UserID}${cursor ? `&after=${cursor}` : ""}`, "GET")
      .then((response) => response.json())
      .catch((e) => this.#errorHandler(e.message));

    this.#streamBuffer.push.apply(this.#streamBuffer, data.data);

    const newCursor = data.pagination.cursor;

    if (!newCursor) {
      this.#streams = this.#streamBuffer;
      this.#updateIcon();
      this.#sendMessage({ command: "streams", data: this.#streams });
      this.#streamBuffer = [];
    } else {
      this.#refreshStreams(newCursor);
    }
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
    return true;
  }

  async #twitchLogout() {
    if (this._timer) {
      window.clearTimeout(this._timer);
      this._timer = undefined;
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

    window.addEventListener("storage", this.onStorageUpdate);
  }

  onStorageUpdate(evt: StorageEvent) {
    if (evt.key === "USER_ID_STORAGE_TOKEN" || evt.key === "ACCESS_TOKEN_STORAGE_TOKEN") {
      this.#UserID = evt.newValue ?? "";
      this.#refresh();
    }
  }

  #errorHandler(errorMsg: string) {
    this.#errorMessage = errorMsg;
    if (errorMsg) {
      this.#sendMessage({ command: "error", data: errorMsg });
      this.#updateIcon("?", "#ff0000");
    }
  }
}

const background: TwitchLiveBackground = new TwitchLiveBackground();

browser.runtime.onConnect.addListener(background.listener.bind(background));