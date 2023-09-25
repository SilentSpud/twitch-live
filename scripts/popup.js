(function () {
  "use strict";

  var accountName;
  var background;
  var openInPopout;

  function onOptionsClick(e) {
    chrome.tabs.create({ url: "options.html" });
  }

  function onRefreshClick(e) {
    background.updateData();
    //todo: window.close();
  }

  function setErrorMessage(msg) {
    if (msg) {
      //need this slight delay, or else the html wont be displayed
      $("#errorContainer").show().html(msg);
    } else {
      $("#errorContainer").hide();
    }
  }

  function sortCategories(streams) {
    let gameHash = {};

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
    let key;
    for (key in gameHash) {
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

  function openURLInNewTab(url) {
    if (!url) {
      console.log("Error : url undefined.");
      return;
    }

    if (openInPopout) {
      url += "/popout";

      chrome.windows.create({
        url: url,
        focused: true,
        type: "popup",
      });
    } else {
      chrome.tabs.create({ url: url });
    }

    window.close();
  }

  function onChannelClick(e) {
    e.preventDefault();
    openURLInNewTab("https://www.twitch.tv/" + $(e.target).attr("data-url"));
  }

  function onGameTitleClick(e) {
    e.preventDefault();
    openURLInNewTab("https://www.twitch.tv/directory/game/" + $(e.target).attr("data-url"));
  }

  function onTwitchClick(e) {
    e.preventDefault();
    openURLInNewTab("https://www.twitch.tv");
  }

  function updateView() {
    const streams = background.getStreams();

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

      html += `<div class="streamSectionTitle" data-url="${encodeURIComponent(categoryName)}">${categoryName}</div>`;

      const gameStreams = category[1];

      for (let i = 0; i < gameStreams.length; i++) {
        const stream = gameStreams[i];

        //sometimes the user name is empty, so we will show the
        //login name for the streamer (usually the same just different case)
        const streamName = !!stream.user_name ? stream.user_name : stream.user_login;

        html += `<div title="${stream.title.replace(/"/g, "&quot;")}" class="streamDiv" data-url="${encodeURIComponent(
          stream.user_login
        )}">${streamName}<span class="channelCount">${new Intl.NumberFormat().format(stream.viewer_count)}</span></a></div>`;
      }

      html += "<div>&nbsp;</div>";
    }

    $("#streamList").append(html);

    //$(".channelLink").bind("click", onChannelClick);
    $(".streamDiv").on("click", onChannelClick);

    $(".streamSectionTitle").on("click", onGameTitleClick);
  }

  function onRefreshUp() {
    document.getElementById("refreshAnchor").classList.remove("refreshImgDown");
  }

  function onRefreshDown() {
    document.getElementById("refreshAnchor").classList.add("refreshImgDown");
  }

  $(document).ready(function () {
    $("#streamList").empty();
    $("#noStreamsDiv").hide();
    $("#errorContainer").hide();
    $("#optionsErrorDiv").hide();
    $("#refreshAnchor").on("click", onRefreshClick);
    $("#twitchAnchor").on("click", onTwitchClick);
    $("#optionsAnchor").on("click", onOptionsClick);

    $("#refreshAnchor").on("mousedown", onRefreshDown);
    $("#refreshAnchor").on("mouseup mouseout", onRefreshUp);

    openInPopout = localStorage.openInPopout === "true";
    background = chrome.extension.getBackgroundPage();

    accountName = localStorage[background.USER_NAME_STORAGE_TOKEN];

    background.setPopup(window);

    let error = background.getErrorMessage();
    setErrorMessage(error);

    if (!accountName) {
      $("#optionsErrorDiv").show();
      return;
    }

    updateView();

    //this is required so we can get the mouse cursor to change on hover

    //hack to work around chrome extension bug that gives focus to the refreshAnchor
    setTimeout(function () {
      $("#refreshAnchor").blur();
    }, 100);
  });

  window.setErrorMessage = setErrorMessage;
  window.updateView = updateView;
})();
