/*
    Copyright 2022
    Mike Chambers
    mikechambers@gmail.com

    http://www.mikechambers.com
*/
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
"use strict";

/**
 * Represents a Twitch live background class.
 * @class
 */
class TwitchLiveBackground {
  /** The Twitch client ID.
   * @private
   */
  #ClientID = "qxn1utz0tedn3vjv4k0tlrf5zfnpr3";

  /** The update interval for the background in milliseconds.
   * @type {number}
   * @default 2 minutes (2 * 1000 * 60 milliseconds)
   */
  UpdateInterval: number = 2 * 1000 * 60;

  /** Twitch API access token.
   * @type {string}
   * @private
   */
  #AccessToken: string = "";

  /** Twitch user ID.
   * @type {string}
   * @private
   */
  #UserID: string = "";

  /** Twitch username.
   * @type {string}
   * @private
   */
  #UserName: string = "";

  /** Active timer
   * @type {number | undefined}
   */
  _timer: number | undefined;

  /** Popup window
   * @type {Window}
   * @private
   * @default undefined
   */
  #popup: Window | undefined;

  /** Twitch live streams.
   * @type {Array}
   * @private
   * @default undefined
   */
  #streams: Array<any> = [];

  #errorMessage = "";

  #streamBuffer: string[] = [];
  
  #openInPopout = false;

  /** Initializes a new instance of the TwitchLiveBackground class.
   * @constructor
   */
  constructor() {
    this.#loadSettings();
    this.#createContextMenu();
  }

  get userName() {
    return this.#UserName;
  }

  get userId() {
    return this.#UserID;
  }

  get openInPopout() {
    return this.#openInPopout;
  }
  set openInPopout(value) {
    this.#openInPopout = !!value;
  }

  get streams() {
    return this.#streams;
  }

  get isLoggedIn() {
    return this.#UserID !== undefined && this.#AccessToken !== undefined && this.#UserName !== undefined;
  }

  /** Makes a request to the Twitch API.
   * @param {string} url - The URL to make the request to.
   * @param {string} [method="GET"] - The HTTP method to use for the request.
   * @param {boolean} json - Whether or not the response should be parsed as JSON.
   * @returns {Promise<string | Record<string, string>>} The response from the Twitch API.
   * @private
   */
  async #twitchApi(url: string, method: string = "GET", json: boolean = true): Promise<string | Record<string, string>> {
    const headers = new Headers({
      Accept: "application/vnd.twitchtv.v5+json",
      "Client-ID": this.#ClientID,
      Authorization: `Bearer ${this.#AccessToken}`,
    });

    const request = new Request(url, {
      headers,
      method: method,
      cache: "no-store",
    });

    const response = await fetch(request);
    if (!response.ok) {
      if (response.status === 401) {
        this.#twitchLogout(true);
      }
      throw new Error(`Error : ${response.status} : ${response.statusText}`);
    }
    return json ? await response.json() as Record<string, string> : await response.text() as string;
  }

  /** Sets the popup window.
   *
   * @param {Window} popup
   */
  setPopup(popup: Window) {
    this.#popup = popup;
  }

  updateIcon() {
    chrome.browserAction.setBadgeBackgroundColor({ color: this.#streams !== undefined ? "#0000ff" : "#000000" });
    chrome.browserAction.setBadgeText({ text: this.#streams !== undefined ? String(this.#streams.length) : "" });
  }

  async refresh() {
    if (this._timer) {
      window.clearTimeout(this._timer);
      this._timer = undefined;
    }
    if (!this.#UserID) {
      this.updateIcon();
      return;
    }
    this._timer = window.setTimeout(() => background.refresh(), this.UpdateInterval);

    this.#refreshStreams();
  }

  async #refreshStreams(cursor: string | undefined = undefined) {
    let cursorString = "";
    if (!cursor) {
      this.#streamBuffer = [];
    } else {
      cursorString = "&after=" + cursor;
    }

    //https://dev.twitch.tv/docs/api/reference#get-followed-streams
    const url = `https://api.twitch.tv/helix/streams/followed?first=100&user_id=${this.#UserID}${cursorString}`;

    const data = await this.#twitchApi(url, "GET", true) as Record<string, any>;
    
    this.#streamBuffer.push.apply(this.#streamBuffer, data["data"]);

    let newCursor = data["pagination"].cursor;

    if (!newCursor) {
      this.#streams = this.#streamBuffer;

      this.updateIcon();

      try {
        if (this.#popup) {
          this.#popup.updateView();
        }
      } catch (e) {
        //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Dead_object
      }
    } else {
      loadLiveStreams(newCursor);
    }
  }

  async #twitchLogin() {
    const response = await browser.identity.launchWebAuthFlow({
      url: `https://id.twitch.tv/oauth2/authorize?client_id=${this.#ClientID}&force_verify=true&response_type=token&scope=user:read:follows&redirect_uri=${encodeURIComponent(
        browser.identity.getRedirectURL()
      )}`,
      interactive: true,
    });

    let search = response.split("/#");
    let params = new URLSearchParams(search[1]);
    let code = params.get("access_token");

    if (code == null) {
      console.log("ERROR: Could not parse access token");
      return;
    }

    this.#AccessToken = code;

    let views = browser.extension.getViews();
    let optionsView;
    for (let v of views) {
      if (v.isOptions) {
        optionsView = v;
        break;
      }
    }

    if (!optionsView) {
      console.log("ERROR: Could not find options");
      console.log(views);
      return;
    }

    const data = await this.#twitchApi("https://api.twitch.tv/helix/users");
    let results = data.data;

    if (!results || results.length === 0) {
      console.log("ERROR : COULD NOT RETRIEVE USER ID");
      return;
    }

    let user = results[0];
    this.#UserID = user.id;
    this.#UserName = user.display_name;

    await browser.storage.local.set({ userId: this.#UserID, accessToken: this.#AccessToken, userName: this.#UserName });
  }

  async #twitchLogout(shouldRevoke = false) {
    if (this._timer) {
      window.clearTimeout(this._timer);
      this._timer = null;
    }

    this.#streams = undefined;
    this.#updateIcon();

    await browser.storage.local.remove(["userId", "accessToken", "userName"]);

    if (!shouldRevoke) return;

    await this.#twitchApi(`https://id.twitch.tv/oauth2/revoke?client_id=${this.#ClientID}&token=${this.#AccessToken}`, "POST");
    this.refresh();
    this.#AccessToken = null;
    this.#UserID = null;
    this.#UserName = null;
  }

  /**
   * Loads settings from local storage.
   * @async
   * @private
   * @returns {Promise<void>}
   */
  async #loadSettings(): Promise<void> {
    try {
      /** @type {{ userId: string, accessToken: string, userName: string }} */
      const { userId, accessToken, userName } = await browser.storage.local.get(["userId", "accessToken", "userName"]);

      if (userId && accessToken && userName) {
        this.#UserID = userId;
        this.#AccessToken = accessToken;
        this.#UserName = userName;
      } else throw new Error("No user data found");
    } catch (e) {
      await this.#twitchLogout();
    }

    this.#updateIcon();

    window.addEventListener("storage", this.#onStorageUpdate);

    if (this.#UserID !== undefined && this.#AccessToken !== undefined && this.#UserName !== undefined) {
      this.refresh();
    }
  }

  #createContextMenu() {
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

  #onStorageUpdate(evt) {
    if (evt.key === USER_ID_STORAGE_TOKEN || evt.key === ACCESS_TOKEN_STORAGE_TOKEN) {
      this.#UserID = evt.newValue;
      this.refresh();
    }
  }

  BroadcastError(msg) {
    this.#errorMessage = msg;
    if (this.#popup) {
      this.#popup.setErrorMessage(msg);
    }

    //should move this to updateBadge
    if (msg) {
      chrome.browserAction.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });
      chrome.browserAction.setBadgeText({ text: "?" });
    }
  }

  getErrorMessage() {
    return this.#errorMessage;
  }

  async authenticateWithTwitch() {
    return await this.#twitchLogin();
  }
}

// @ts-ignore
const background = new TwitchLiveBackground();
