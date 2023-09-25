/*
    Copyright 2022
    Mike Chambers
    mikechambers@gmail.com

    http://www.mikechambers.com
*/

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global browser, window, $, webkitNotifications, chrome */

//check text status, when there is a timeout, add additional delay

"use strict";

const UPDATE_INTERVAL = 60 * 1000 * 2; //2 minutes

const AJAX_TIMEOUT = 1000 * 30; //30 seconds
const CLIENT_ID = "qxn1utz0tedn3vjv4k0tlrf5zfnpr3";

const USER_NAME_STORAGE_TOKEN = "USER_NAME_STORAGE_TOKEN";
const USER_ID_STORAGE_TOKEN = "USER_ID_STORAGE_TOKEN";
const ACCESS_TOKEN_STORAGE_TOKEN = "ACCESS_TOKEN_STORAGE_TOKEN";

let _accessToken;
let _userId;
let _userName;

let _streamBuffer = [];
let _lastRequestController;

let intervalId;
let streams;

let popup;
let errorMessage;

let updateBadge = function (text, color) {
  let badgeColor = [0, 0, 0, 0];
  let badgeText = "";

  if (streams !== undefined) {
    badgeColor = [0, 0, 255, 255];
    badgeText = String(streams.length);
  }

  chrome.browserAction.setBadgeBackgroundColor({ color: badgeColor });
  chrome.browserAction.setBadgeText({ text: badgeText });
};

const onStorageUpdate = (evt) => {
  if (evt.key === USER_ID_STORAGE_TOKEN || evt.key === ACCESS_TOKEN_STORAGE_TOKEN) {
    _userId = evt.newValue;
    updateData();
  }
};

const getStreams = () => streams;

const getErrorMessage = () => errorMessage;

const setPopup = function (p) {
  popup = p;
};

let broadcastError = function (msg) {
  errorMessage = msg;
  if (popup) {
    popup.setErrorMessage(msg);
  }

  //should move this to updateBadge
  if (msg) {
    chrome.browserAction.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });
    chrome.browserAction.setBadgeText({ text: "?" });
  }
};

const loadLiveStreams = (cursor) => {
  let cursorString = "";
  if (!cursor) {
    _streamBuffer = [];
  } else {
    cursorString = "&after=" + cursor;
  }

  //https://dev.twitch.tv/docs/api/reference#get-followed-streams
  const url = `https://api.twitch.tv/helix/streams/followed?first=100&user_id=${userId}${cursorString}`;

  callApi(url, onLoadLiveStreams, "onLoadLiveStreamsError");
};

const onLoadLiveStreams = (response) => {
  _streamBuffer.push.apply(_streamBuffer, response.data);

  let cursor = response.pagination.cursor;

  if (!cursor) {
    streams = _streamBuffer;

    updateBadge();

    try {
      if (popup) {
        popup.updateView();
      }
    } catch (e) {
      //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Dead_object
    }
  } else {
    loadLiveStreams(cursor);
  }
};

const onInterval = () => updateData();

const onUnauthorizedRequest = () => logOutTwitch();

const callApi = function (url, onLoad, errorName, method = "GET") {
  const headers = new Headers({
    Accept: "application/vnd.twitchtv.v5+json",
    "Client-ID": CLIENT_ID,
    Authorization: "Bearer " + _accessToken,
  });

  const request = new Request(url, {
    method: method,
    headers: headers,
    cache: "no-store",
  });

  const controller = new AbortController();
  _lastRequestController = controller;

  const timeoutId = setTimeout(() => controller.abort(), AJAX_TIMEOUT);

  fetch(request)
    .then((response) => {
      if (!response.ok) {
        if (response.status === 401) {
          onUnauthorizedRequest();
        }

        return Promise.reject(response);
      }

      return response.text();
    })
    .then((data) => {
      if (errorName == "onRevokeAccessTokenError") {
        //this is a bit of a hack. When making this call
        //the return data is not JSON. This is a hacky way to
        //detect it
        onLoad();
        return;
      }

      let json = JSON.parse(data);
      onLoad(json);
    })
    .catch((error) => {
      let status = error.status;
      let statusText = error.statusText;
      let errorUrl = error.url;

      if (error instanceof Error) {
        errorUrl = url;
        statusText = error.name + " : " + error.message;
      }

      handleError(errorName, status, statusText, errorUrl);
    })
    .finally(() => {
      if (_lastRequestController === controller) {
        _lastRequestController = null;
      }

      clearTimeout(timeoutId);
    });
};

const handleError = (errorName, errorStatus, errorMessage, url) => {
  console.log("------------------------Error Loading Data-------------------------------------");
  console.log("Error : " + errorName);
  console.log("Time : " + new Date().toString());
  console.log("URL : " + url);
  console.log("Status :", errorStatus);
  console.log("Description :", errorMessage);
  console.log("------------------------------End Error----------------------------------------");
};

const updateData = () => {
  if (!_userId) {
    updateBadge();
    return;
  }

  if (intervalId) {
    window.clearTimeout(intervalId);
  }

  if (_lastRequestController) {
    _lastRequestController.abort();
    _lastRequestController = null;
  }
  intervalId = window.setTimeout(onInterval, UPDATE_INTERVAL);

  loadLiveStreams();
};

const updateUserId = (u) => {
  _userId = u;
};

const init = async () => {
  const localSettings = await browser.storage.local.get(["useSync", "userId", "accessToken", "userName"]);
  if (localSettings.useSync) {
    const syncSettings = await browser.storage.sync.get(["userId", "accessToken", "userName"]);
    const { userId, accessToken, userName } = syncSettings;

    if (userId && accessToken && userName) {
      _userId = userId;
      _accessToken = accessToken;
      _userName = userName;
    }
  } else {
    const { userId, accessToken, userName } = localSettings;

    if (userId && accessToken && userName) {
      _userId = userId;
      _accessToken = accessToken;
      _userName = userName;
    }
  }

  const isLoggedIn = !(userId == undefined || accessToken == undefined || userName == undefined);

  if (!isLoggedIn) {
    await logOutTwitch();
  }

  updateBadge();

  window.addEventListener("storage", onStorageUpdate);

  //TODO: See if we can fix this
  browser.contextMenus.create({
    title: "About Twitch Live",
    contexts: ["browser_action"],
    onclick: function () {
      chrome.tabs.create({ url: "about.html" });
    },
  });

  browser.contextMenus.create({
    title: "Twitch Live Options",
    contexts: ["browser_action"],
    onclick: function () {
      chrome.tabs.create({ url: "options.html" });
    },
  });

  if (isLoggedIn) {
    updateData();
  }
};

const logOutTwitch = async (shouldRevoke = false) => {
  if (intervalId) {
    window.clearTimeout(intervalId);
  }

  streams = undefined;
  updateBadge();

  await browser.storage.local.remove(["userId", "accessToken", "userName"]);

  if (!shouldRevoke) {
    return;
  }

  let accessToken = _accessToken;
  _userId = null;
  _accessToken = null;

  if (accessToken) {
    let revokeUrl = "https://id.twitch.tv/oauth2/revoke?client_id=" + CLIENT_ID + "&token=" + accessToken;

    callApi(
      revokeUrl,
      () => {
        updateData();
      },
      "onRevokeAccessTokenError",
      "POST"
    );
  }
};

const onAuthCallback = (responseUrl) => {
  let search = responseUrl.split("/#");
  let params = new URLSearchParams(search[1]);
  let code = params.get("access_token");

  if (code == null) {
    console.log("ERROR: Could not parse access token");
    return;
  }

  _accessToken = code;

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

  let onData = function (data) {
    let results = data.data;

    if (!results || results.length === 0) {
      console.log("ERROR : COULD NOT RETRIEVE USER ID");
      return;
    }

    let user = results[0];
    _userId = user.id;
    _userName = user.display_name;

    ///console.log("_userName", _userName);
    ///console.log("_accessToken", _accessToken);
    //console.log("userId", _userId);

    browser.storage.set({ userId: _userId, accessToken: _accessToken, userName: _userName });

    updateData();
  };

  callApi("https://api.twitch.tv/helix/users", onData, "onAuthenticationError");
};

const authenticateWithTwitch = () => {
  browser.identity.launchWebAuthFlow(
    {
      url:
        "https://id.twitch.tv/oauth2/authorize?client_id=" +
        CLIENT_ID +
        "&force_verify=true&response_type=token&scope=user:read:follows&redirect_uri=" +
        encodeURIComponent(browser.identity.getRedirectURL()),
      interactive: true,
    },
    onAuthCallback
  );
};

window.USER_NAME_STORAGE_TOKEN = USER_NAME_STORAGE_TOKEN;
window.USER_ID_STORAGE_TOKEN = USER_ID_STORAGE_TOKEN;
window.ACCESS_TOKEN_STORAGE_TOKEN = ACCESS_TOKEN_STORAGE_TOKEN;
window.authenticateWithTwitch = authenticateWithTwitch;
window.logOutTwitch = logOutTwitch;

window.setPopup = setPopup;
window.getErrorMessage = getErrorMessage;
window.getStreams = getStreams;
window.updateData = updateData;
window.callApi = callApi;

init();
