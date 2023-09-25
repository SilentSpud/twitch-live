/*
    Copyright 2022
    Mike Chambers
    mikechambers@gmail.com

    http://www.mikechambers.com
*/

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global localStorage, window, $, webkitNotifications, chrome */

//check text status, when there is a timeout, add additional delay

(function () {
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

  let onStorageUpdate = function (e) {
    if (
      e.key === USER_ID_STORAGE_TOKEN ||
      e.key === ACCESS_TOKEN_STORAGE_TOKEN
    ) {
      _userId = e.newValue;
      updateData();
    }
  };

  const getStreams = () => streams;

  const getErrorMessage = () => errorMessage;

  let setPopup = function (p) {
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

  let loadLiveStreams = function (cursor) {
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

  let onLoadLiveStreams = function (response) {
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

  let handleError = function (errorName, errorStatus, errorMessage, url) {
    console.log(
      "------------------------Error Loading Data-------------------------------------"
    );
    console.log("Error : " + errorName);
    console.log("Time : " + new Date().toString());
    console.log("URL : " + url);
    console.log("Status :", errorStatus);
    console.log("Description :", errorMessage);
    console.log(
      "------------------------------End Error----------------------------------------"
    );
  };

  let updateData = function () {
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

  let updateUserId = function (u) {
    _userId = u;
  };

  let init = function () {
    _userId = localStorage[USER_ID_STORAGE_TOKEN];
    _accessToken = localStorage[ACCESS_TOKEN_STORAGE_TOKEN];
    _userName = localStorage[USER_NAME_STORAGE_TOKEN];

    //console.log("_userId", _userId);
    //console.log("_accessToken", _accessToken);
    //console.log("_userName", _userName);

    let isLoggedIn = !(
      _userId == undefined ||
      _accessToken == undefined ||
      _userName == undefined
    );

    if (!isLoggedIn) {
      logOutTwitch();
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

  let logOutTwitch = function (shouldRevoke = false) {
    if (intervalId) {
      window.clearTimeout(intervalId);
    }

    streams = undefined;
    updateBadge();

    localStorage.removeItem(USER_ID_STORAGE_TOKEN);
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_TOKEN);
    localStorage.removeItem(USER_NAME_STORAGE_TOKEN);

    if (!shouldRevoke) {
      return;
    }

    let accessToken = _accessToken;
    _userId = null;
    _accessToken = null;

    if (accessToken) {
      let revokeUrl =
        "https://id.twitch.tv/oauth2/revoke?client_id=" +
        CLIENT_ID +
        "&token=" +
        accessToken;

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

  let onAuthCallback = function (responseUrl) {
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

      if (!results || results.length < 0) {
        console.log("ERROR : COULD NOT RETRIEVE USER ID");
        return;
      }

      let user = results[0];
      _userId = user.id;
      _userName = user.display_name;

      ///console.log("_userName", _userName);
      ///console.log("_accessToken", _accessToken);
      //console.log("userId", _userId);

      localStorage[USER_NAME_STORAGE_TOKEN] = _userName;
      localStorage[ACCESS_TOKEN_STORAGE_TOKEN] = _accessToken;
      localStorage[USER_ID_STORAGE_TOKEN] = _userId;

      updateData();
    };

    callApi(
      "https://api.twitch.tv/helix/users",
      onData,
      "onAuthenticationError"
    );
  };

  let authenticateWithTwitch = function () {
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
})();
