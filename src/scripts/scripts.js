import normalizeSpotifyTracks from "./spotifyTransformer.js";

"use strict";
console.log("Organize Your Music - scripts.js loaded");
var accessToken = null;
var ACCESS_TOKEN_STORAGE_KEY = "access_token";
var REFRESH_TOKEN_STORAGE_KEY = "refresh_token";
var curUserID = null;
var curTracks = {};
var curRawTrackItems = [];
var curArtists = {};
var curAlbums = {};
var curTypeName = null;
var curSelected = new Set();
var curSelectedTracks = [];
var nodeMap = {};
var genreIndex = 0;
var sourceIndex = 7;
var thePlot = null;

var skipGenrePhrases = ["christmas"];
var audio = document.createElement("audio");
var nowPlaying = null;
var curNode = null;
var abortLoading = false;

var progressBar = document.getElementById("progress-bar");

var topArtistCount = 0;
var totalTracks = 0;
var topArtistName = null;
var topTrackName = null;
var topTrackCount = 0;
var totalPlaylists = 0;
var processedPlaylists = 0;
var theTrackTable = null;
var theStagingTable = null;
var stagingIsVisible = false;
var maxTracksShown = 20000;
var sidebarExpanded = true;
var SIDEBAR_VISIBLE_KEY = "oym_sidebar_visible";
var SIDEBAR_EXPANDED_KEY = "oym_sidebar_expanded";

// NEW: Global search state
var currentSearchQuery = "";
var quickMode = false;
window.normalizedTrackData = [];
window.getNormalizedTrackData = function () {
  return Array.isArray(window.normalizedTrackData)
    ? window.normalizedTrackData
    : [];
};

window.addEventListener("unhandledrejection", function (event) {
  console.error("Unhandled promise rejection:", event.reason);
});

function isSpotifyScopeError(resp) {
  var payload = resp && resp.responseJSON;
  if (!payload && resp && resp.responseText) {
    try {
      payload = JSON.parse(resp.responseText);
    } catch (e) {
      payload = null;
    }
  }

  var msg = getSpotifyErrorMessage(payload);

  if (!msg) {
    return false;
  }

  var lower = String(msg).toLowerCase();
  return lower.indexOf("insufficient") !== -1 && lower.indexOf("scope") !== -1;
}

function getSpotifyErrorMessage(payload) {
  if (!payload) {
    return null;
  }

  var msg = payload && payload.error && payload.error.message;
  if (!msg && payload && typeof payload.error === "string") {
    msg = payload.error;
  }
  if (!msg && typeof payload.message === "string") {
    msg = payload.message;
  }
  return msg || null;
}

function isSpotifyTokenExpiredError(payload) {
  var msg = getSpotifyErrorMessage(payload);
  if (!msg) {
    return false;
  }

  var lower = String(msg).toLowerCase();
  return (
    lower.indexOf("token expired") !== -1 ||
    lower.indexOf("access token expired") !== -1 ||
    lower.indexOf("the access token expired") !== -1 ||
    lower.indexOf("expired token") !== -1
  );
}

async function readSpotifyErrorPayload(response) {
  if (!response || typeof response.clone !== "function") {
    return null;
  }

  try {
    var text = await response.clone().text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      return { error: { message: text } };
    }
  } catch (e) {
    return null;
  }
}

function restartAuthorization(message) {
  if (message) {
    error(message);
  }

  accessToken = null;
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);

  // Stop any ongoing fetch
  abortLoading = true;

  // Reset UI to login state
  var intro = document.getElementById("intro");
  if (intro) intro.style.display = "block";

  var loginState = document.getElementById("login-state");
  if (loginState) loginState.style.display = "block";

  var selectionState = document.getElementById("selection-state");
  if (selectionState) selectionState.style.display = "none";

  document.querySelectorAll(".work").forEach(function (el) {
    el.classList.add("hidden");
    el.classList.remove("flex");
  });
}

var theWorld = [
  { name: "Genres", nodes: [] },
  {
    name: "Moods",
    nodes: [
      makeNode(
        "(unclassified mood)",
        "popularity",
        featMissingFilter("energy"),
        featGetterInt("popularity"),
        featSorter("popularity", true),
        true,
      ),
      makeNode(
        "chill",
        "energy",
        featMusicFilter("energy", 0, 0.2),
        featGetterPercent("energy"),
        featSorter("energy", false),
        true,
      ),
      makeNode(
        "amped",
        "energy",
        featMusicFilter("energy", 0.8, 1.0),
        featGetterPercent("energy"),
        featSorter("energy", true),
        true,
      ),
      makeNode(
        "sad",
        "sadness",
        featMusicFilter("sadness", 0.8, 1.0),
        featGetterPercent("sadness"),
        featSorter("sadness", true),
        true,
      ),
      makeNode(
        "anger",
        "anger",
        featMusicFilter("anger", 0.8, 1.0),
        featGetterPercent("anger"),
        featSorter("anger", true),
        true,
      ),
      makeNode(
        "happy",
        "happiness",
        featMusicFilter("happiness", 0.8, 1.0),
        featGetterPercent("happiness"),
        featSorter("happiness", true),
        true,
      ),
      makeNode(
        "danceable",
        "danceability",
        featMusicFilter("danceability", 0.8, 1.0),
        featGetterPercent("danceability"),
        featSorter("danceability", true),
        true,
      ),
    ],
  },
  {
    name: "Styles",
    nodes: [
      makeNode(
        "instrumental",
        "instrumentalness",
        featMusicFilter("instrumentalness", 0.8, 1.0),
        featGetterPercent("instrumentalness"),
        featSorter("instrumentalness", true),
        true,
      ),
      makeNode(
        "acoustic",
        "acousticness",
        featMusicFilter("acousticness", 0.8, 1.0),
        featGetterPercent("acousticness"),
        featSorter("acousticness", true),
        true,
      ),
      makeNode(
        "live",
        "liveness",
        featMusicFilter("liveness", 0.85, 1.0),
        featGetterPercent("liveness"),
        featSorter("liveness", true),
        true,
      ),
      makeNode(
        "spoken word",
        "speechiness",
        featFilter("speechiness", 0.85, 1.0),
        featGetterPercent("speechiness"),
        featSorter("speechiness", true),
        true,
      ),
      makeNode(
        "clean",
        "explicit",
        featBoolFilter("explicit", false),
        featGetterBool("explicit", "explicit", "clean"),
        featSorter("explicit", true),
        false,
      ),
      makeNode(
        "explicit",
        "explicit",
        featBoolFilter("explicit", true),
        featGetterBool("explicit", "explicit", "clean"),
        featSorter("explicit", true),
        false,
      ),
      makeNode(
        "loud",
        "loudness (dB)",
        featMusicFilter("loudness", -5, 0),
        featGetterInt("loudness"),
        featSorter("loudness", true),
        true,
      ),
      makeNode(
        "quiet",
        "loudness (dB)",
        featMusicFilter("loudness", -60, -10),
        featGetterInt("loudness"),
        featSorter("loudness", false),
        true,
      ),
    ],
  },
  {
    name: "Decades",
    nodes: [
      makeNode(
        "Oldies",
        "year",
        featFilter("year", 0, 1950),
        featGetter("year"),
        featSorter("year", false),
        true,
      ),
      makeNode(
        "1950s",
        "year",
        featFilter("year", 1950, 1959),
        featGetter("year"),
        featSorter("year", false),
        true,
      ),
      makeNode(
        "1960s",
        "year",
        featFilter("year", 1960, 1969),
        featGetter("year"),
        featSorter("year", false),
        true,
      ),
      makeNode(
        "1970s",
        "year",
        featFilter("year", 1970, 1979),
        featGetter("year"),
        featSorter("year", false),
        true,
      ),
      makeNode(
        "1980s",
        "year",
        featFilter("year", 1980, 1989),
        featGetter("year"),
        featSorter("year", false),
        true,
      ),
      makeNode(
        "1990s",
        "year",
        featFilter("year", 1990, 1999),
        featGetter("year"),
        featSorter("year", false),
        true,
      ),
      makeNode(
        "2000s",
        "year",
        featFilter("year", 2000, 2009),
        featGetter("year"),
        featSorter("year", false),
        true,
      ),
      makeNode(
        "2010s",
        "year",
        featFilter("year", 2010, 2019),
        featGetter("year"),
        featSorter("year", false),
        true,
      ),
      makeNode(
        "2020s",
        "year",
        featFilter("year", 2020, 2029),
        featGetter("year"),
        featSorter("year", false),
        true,
      ),
      makeNode(
        "Now",
        "year",
        featFilter("year", 2016, 2020),
        featGetter("year"),
        featSorter("year", false),
        true,
      ),
      makeNode(
        "(unclassified year)",
        "year",
        featFilter("year", -1, 0),
        featGetter("year"),
        featSorter("year", false),
        false,
      ),
    ],
  },
  {
    name: "Added",
    nodes: [
      makeNode(
        "Today",
        "age (days)",
        featFilter("age", 0, 1),
        featGetterInt("age"),
        featSorter("age", false),
        true,
      ),
      makeNode(
        "In the last week",
        "age (days)",
        featFilter("age", 0, 7),
        featGetterInt("age"),
        featSorter("age", false),
        true,
      ),
      makeNode(
        "In the last month",
        "age (days)",
        featFilter("age", 0, 30),
        featGetterInt("age"),
        featSorter("age", false),
        true,
      ),
      makeNode(
        "In the last year",
        "age (days)",
        featFilter("age", 0, 365),
        featGetterInt("age"),
        featSorter("age", false),
        true,
      ),
      makeNode(
        "Over a year ago",
        "age (days)",
        featFilter("age", 356, 365 * 100),
        featGetterInt("age"),
        featSorter("age", false),
        true,
      ),
      makeNode(
        "Over 2 years ago",
        "age (days)",
        featFilter("age", 356 * 2, 365 * 100),
        featGetterInt("age"),
        featSorter("age", false),
        true,
      ),
      makeNode(
        "Over 5 years ago",
        "age (days)",
        featFilter("age", 356 * 5, 365 * 100),
        featGetterInt("age"),
        featSorter("age", false),
        true,
      ),
      makeNode(
        "Whenever",
        "age (days)",
        featFilter("age", 0, 365 * 100),
        featGetterInt("age"),
        featSorter("age", false),
        true,
      ),
    ],
  },
  {
    name: "Popularity",
    nodes: [
      makeNode(
        "top popular",
        "Popularity",
        featFilter("popularity", 75, 100),
        featGetter("popularity"),
        featSorter("popularity", true),
        true,
      ),
      makeNode(
        "very popular",
        "Popularity",
        featFilter("popularity", 50, 75),
        featGetter("popularity"),
        featSorter("popularity", true),
        true,
      ),
      makeNode(
        "somewhat popular",
        "Popularity",
        featFilter("popularity", 20, 50),
        featGetter("popularity"),
        featSorter("popularity", true),
        true,
      ),
      makeNode(
        "deep",
        "Popularity",
        featFilter("popularity", 0, 20),
        featGetter("popularity"),
        featSorter("popularity", true),
        true,
      ),
    ],
  },
  {
    name: "Duration",
    nodes: [
      makeNode(
        "Very very short",
        "Duration",
        featFilter("duration_ms", mins(0), mins(0.5)),
        featGetter("duration_ms"),
        featSorter("duration_ms", false),
        true,
      ),
      makeNode(
        "Very short",
        "Duration",
        featFilter("duration_ms", mins(0), mins(1.5)),
        featGetter("duration_ms"),
        featSorter("duration_ms", false),
        true,
      ),
      makeNode(
        "Short",
        "Duration",
        featFilter("duration_ms", mins(0), mins(3)),
        featGetter("duration_ms"),
        featSorter("duration_ms", false),
        true,
      ),
      makeNode(
        "Medium",
        "Duration",
        featFilter("duration_ms", mins(3), mins(6)),
        featGetter("duration_ms"),
        featSorter("duration_ms", false),
        true,
      ),
      makeNode(
        "Long",
        "Duration",
        featFilter("duration_ms", mins(6), mins(1000)),
        featGetter("duration_ms"),
        featSorter("duration_ms", false),
        true,
      ),
      makeNode(
        "Very long",
        "Duration",
        featFilter("duration_ms", mins(12), mins(1000)),
        featGetter("duration_ms"),
        featSorter("duration_ms", false),
        true,
      ),
      makeNode(
        "Very very long",
        "Duration",
        featFilter("duration_ms", mins(30), mins(1000)),
        featGetter("duration_ms"),
        featSorter("duration_ms", false),
        true,
      ),
    ],
  },
  { name: "Sources", nodes: [] },
  {
    name: "All Results",
    nodes: [
      makeNode(
        "All results",
        "All results",
        function (track) {
          return true;
        },
        featGetter("popularity"),
        featSorter("popularity", true),
        false,
      ),
    ],
  },
];

function mins(min) {
  return min * 60 * 1000;
}
function now() {
  return new Date().getTime();
}

function updateFavs() {
  if (theWorld[genreIndex].nodes.length > 0 && topArtistName && topTrackName) {
    var favGenre = theWorld[genreIndex].nodes[0].name;
    document.getElementById("fav-genre").textContent = favGenre;
    document.getElementById("fav-artist").textContent = topArtistName;
    document.getElementById("fav-song").textContent = topTrackName;
    var favs = document.getElementById("favs");
    favs.classList.remove("hidden");
    favs.classList.add("block");
  }
}

function refreshHeader() {
  var ntracks = Object.keys(curTracks).length;
  var nArtists = Object.keys(curArtists).length;
  if (totalPlaylists > 0) {
    linfo(
      "Found " +
      ntracks +
      " unique tracks by " +
      nArtists +
      " artists in " +
      processedPlaylists +
      " of " +
      totalPlaylists +
      " playlists",
    );
    var progress = (processedPlaylists * 100) / totalPlaylists;
    setProgress(progress);
  } else {
    if (totalTracks > 0) {
      var progress = (ntracks * 100) / totalTracks;
      setProgress(progress);
    }
    linfo(
      "Found " +
      ntracks +
      " tracks by " +
      nArtists +
      " artists in your collection.",
    );
  }
}

function addTracks(tracks) {
  const AUDIO_FEATURE_FIELDS = [
    'danceability', 'energy', 'valence', 'tempo', 'loudness',
    'speechiness', 'acousticness', 'instrumentalness', 'liveness',
    'key', 'mode', 'time_signature'
  ];

  tracks.forEach(function (track) {
    track.feats = track.feats || {};

    // 1. Copy audio features from track root to track.feats
    AUDIO_FEATURE_FIELDS.forEach(field => {
      if (track[field] !== undefined && track[field] !== null) {
        track.feats[field] = track[field];
      }
    });

    // 2. Calculate Moods (happiness, sadness, anger) if energy and valence exist
    if (track.feats.energy !== undefined && track.feats.valence !== undefined) {
      track.feats.sadness = (1 - track.feats.energy) * (1 - track.feats.valence);
      track.feats.happiness = track.feats.energy * track.feats.valence;
      track.feats.anger = track.feats.energy * (1 - track.feats.valence);
    }

    // 3. Handle Genres
    var genres = getGenresForTrack(track);
    track.feats.genres = new Set();
    track.feats.topGenre = "";

    genres.forEach(function (genre) {
      if (isGoodGenre(genre)) {
        track.feats.genres.add(genre);
        if (
          track.feats.topGenre.length == 0 &&
          genre !== "(unclassified genre)"
        ) {
          track.feats.topGenre = genre;
        }

        if (!(genre in nodeMap)) {
          var node = makeNode(
            genre,
            "Genres",
            featGenreFilter(genre),
            featGenreGetter(genre),
            featSorter("popularity", true),
            false,
          );
          theWorld[genreIndex].nodes.push(node);
        }
      }
    });

    // Fallback for unclassified if no good genres found
    if (track.feats.genres.size === 0) {
      const unclassified = "(unclassified genre)";
      track.feats.genres.add(unclassified);
      track.feats.topGenre = unclassified;
      if (!(unclassified in nodeMap)) {
        var node = makeNode(
          unclassified,
          "Genres",
          featGenreFilter(unclassified),
          featGenreGetter(unclassified),
          featSorter("popularity", true),
          false,
        );
        theWorld[genreIndex].nodes.push(node);
      }
    }

    // 4. Sources
    if (track.feats.sources) {
      track.feats.sources.forEach(function (source) {
        if (!(source in nodeMap)) {
          var node = makeNode(
            source,
            "Sources",
            featSourceFilter(source),
            featSourceGetter(source),
            featSorter("popularity", true),
            false,
          );
          theWorld[sourceIndex].nodes.push(node);
        }
      });
    }

    track.feats.year = getYearForTrack(track);
    track.feats.popularity = track.popularity;
    track.feats.duration_ms = track.duration_ms;
  });
}

function filterTracks(tracks) {
  theWorld.forEach(function (bin) {
    bin.nodes.forEach(function (node) {
      applyFilter(tracks, node.filter).forEach(function (track) {
        node.tracks.push(track);
        node.artists.add(track.details.artists[0].id);
      });
    });
  });
  tracks.forEach(function (track) {
    saveTrack(track);
  });
}

var totRefresh = 0;

function refreshTheWorld(quick) {
  var start = now();
  updateViewOfTheWorld(quick);
  var delta = now() - start;
  totRefresh += delta;
}

function playlistSubtitle(s) {
  document.getElementById("playlist-sub-title").textContent = s;
}
function playlistTitle(s) {
  document.getElementById("playlist-title").textContent = s;
}

var curPlottingNodes = {};
var curPlottingNames = [];

function getPlotData(node) {
  var xDataName = document.getElementById("select-xaxis").value;
  var yDataName = document.getElementById("select-yaxis").value;

  var theDataTrace = {
    x: [],
    y: [],
    mode: "markers",
    name: node.name,
    text: [],
    node: node,
    marker: {
      sizemode: "diameter",
      size: [],
      sizeref: 1,
      sizemin: 2,
      color: "#1DB954",
    },
  };
  var xGetter = plottableData[xDataName].getter;
  var yGetter = plottableData[yDataName].getter;

  node.tracks.forEach(function (track) {
    theDataTrace.x.push(xGetter(track));
    theDataTrace.y.push(yGetter(track));
    var name = track.details.name + " - " + track.details.artists[0].name;
    theDataTrace.text.push(name);
  });

  var nsizes = normalizeSizes(node.tracks);
  theDataTrace.marker.size = nsizes;
  return theDataTrace;
}

function normalizeSizes(tracks) {
  var sizeDataName = document.getElementById("select-size").value;
  var sizeInfo = plottableData[sizeDataName];
  var minWidth = 4;
  var maxWidth = 12;
  var minSize = sizeInfo.min;
  var maxSize = sizeInfo.max;
  var out = [];
  var range = maxSize - minSize;
  var orange = maxWidth - minWidth;
  tracks.forEach(function (track) {
    var val = sizeInfo.getter(track);
    if (val < minSize) val = minSize;
    if (val > maxSize) val = maxSize;
    var nval = (val - minSize) / range;
    var oval = nval * orange + minWidth;
    out.push(oval);
  });
  return out;
}

function plotPlaylist(node) {
  if (node.name in curPlottingNodes) {
    delete curPlottingNodes[node.name];
    redrawPlot();
  } else {
    curPlottingNodes[node.name] = node;
    curPlottingNames.push(node.name);
    redrawPlot();
  }
}

function getLayout() {
  var xDataName = document.getElementById("select-xaxis").value;
  var yDataName = document.getElementById("select-yaxis").value;
  var plotHost = document.getElementById("the-plot").parentElement;
  var xMargin = 16;
  var yMargin = 180;
  var yFooter = 24;
  var minHeight = 420;
  var minWidth = 300;

  var width = plotHost.clientWidth - xMargin;
  if (width < minWidth) width = minWidth;
  var plotControls = document.getElementById("plot-controls");
  var controlsHeight = plotControls ? plotControls.offsetHeight : 0;
  var tabsList = document.querySelector("#exTab3 > ul.nav");
  var tabsHeight = tabsList ? tabsList.offsetHeight : 0;
  var height =
    window.innerHeight - yMargin - yFooter - controlsHeight - tabsHeight;
  if (height < minHeight) height = minHeight;
  var layout = {
    showlegend: true,
    legend: { orientation: "v", font: { color: "#b3b3b3" } },
    hovermode: "closest",
    xaxis: {
      title: plottableData[xDataName].name,
      color: "#b3b3b3",
      gridcolor: "#3E3E3E",
      zerolinecolor: "#3E3E3E",
    },
    yaxis: {
      title: plottableData[yDataName].name,
      color: "#b3b3b3",
      gridcolor: "#3E3E3E",
      zerolinecolor: "#3E3E3E",
    },
    autosize: true,
    margin: { l: 55, r: 90, t: 30, b: 55 },
    width: width,
    height: height,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#b3b3b3" },
  };
  return layout;
}

function redrawPlot() {
  var layout = getLayout();
  var plotData = [];
  curPlottingNames = [];
  Object.entries(curPlottingNodes).forEach(function (entry) {
    var name = entry[0];
    var node = entry[1];
    curPlottingNames.push(name);
    plotData.push(getPlotData(node));
  });
  Plotly.newPlot(thePlot, plotData, layout, {
    displayLogo: false,
    displayModeBar: true,
    responsive: true,
  });
  thePlot.on("plotly_click", function (data) {
    if (data.points.length > 0) {
      var idx = data.points[0].pointNumber;
      var track = data.points[0].data.node.tracks[idx];
      playTrack(track);
    }
  });

  thePlot.on("plotly_selected", function (data) {
    var trackList = [];
    data.points.forEach(function (point) {
      var plotName = curPlottingNames[point.curveNumber];
      var track = curPlottingNodes[plotName].tracks[point.pointNumber];
      trackList.push(track);
      curSelected.add(track.id);
    });
    var elements = document.querySelectorAll(".nstaging-tracks");
    elements.forEach(function (el) {
      el.textContent = curSelected.size;
    });
    info("selected " + trackList.length + " tracks");
  });
}

function clearPlot() {
  curPlottingNodes = {};
  redrawPlot();
}

function showPlaylist(node) {
  curNode = node;
  if (theTrackTable == null) return;

  if (stagingIsVisible) {
    // Need to implement tab show
    showTab("#the-track-list-tab");
  }
  curNode = node;

  var displayTracks =
    currentSearchQuery.trim() !== ""
      ? getGlobalSearchTracks(currentSearchQuery)
      : node.tracks;
  var isSearching = currentSearchQuery.trim() !== "";

  var nTracks = displayTracks.length;
  var nArtists = new Set(
    displayTracks.flatMap(function (t) {
      return (t.details.artists || []).map(function (a) {
        return a.id;
      });
    }),
  ).size;

  const resetBtn = document.getElementById("reset-column-order");
  if (isSearching) {
    playlistTitle("Search results");
    playlistSubtitle(
      "Search Results: " + nTracks + " tracks / " + nArtists + " artists",
    );
    if (resetBtn) resetBtn.classList.add("hidden");
  } else {
    if (node.name == "All results") {
      playlistTitle("All results in this collection");
      if (resetBtn) resetBtn.classList.remove("hidden");
    } else {
      playlistTitle("Your " + uname(node.name) + " tracks");
      if (resetBtn) resetBtn.classList.add("hidden");
    }
    playlistSubtitle(nTracks + " tracks / " + nArtists + " artists");
  }

  // document.getElementById("tbl-param").textContent = node.label; // Missing element in new UI
  if (displayTracks.length === 0) {
    document.getElementById("track-table-shell").classList.add("hidden");
    var emptyMsg = document.getElementById("track-table-empty");
    emptyMsg.classList.remove("hidden");
    emptyMsg.classList.add("flex");
    var truncated = document.getElementById("gthe-track-table-truncated");
    if (truncated) {
      truncated.classList.remove("block");
      truncated.classList.add("hidden");
    }
    return;
  }

  var emptyMsg = document.getElementById("track-table-empty");
  emptyMsg.classList.remove("flex");
  emptyMsg.classList.add("hidden");
  document.getElementById("track-table-shell").classList.remove("hidden");

  var truncated = document.getElementById("gthe-track-table-truncated");
  if (displayTracks.length > maxTracksShown) {
    if (truncated) {
      truncated.classList.remove("hidden");
      truncated.classList.add("block");
    }
  } else {
    if (truncated) {
      truncated.classList.remove("block");
      truncated.classList.add("hidden");
    }
  }
  showTracksInTable(
    theTrackTable,
    displayTracks,
    node.getter,
    node.label,
    false,
  );
}

function getGlobalSearchTracks(query) {
  var searchQuery = query.trim().toLowerCase();
  if (searchQuery === "") return [];

  return Object.values(curTracks).filter(function (track) {
    var trackName = (track.details.name || "").toLowerCase();
    var artistNames = (track.details.artists || []).map(function (artist) {
      return (artist.name || "").toLowerCase();
    });
    var artistGenres = (track.details.artists || []).map(function (artist) {
      var artistInfo = curArtists[artist.id];
      return artistInfo && artistInfo.genres ? artistInfo.genres : [];
    });
    var albumInfo = curAlbums[track.details.album_id] || {};
    var albumName = (albumInfo.name || "").toLowerCase();
    var albumGenres = (albumInfo.genres || []).map(function (genre) {
      return (genre || "").toLowerCase();
    });
    var trackGenres = Array.from(track.feats.genres || []).map(
      function (genre) {
        return (genre || "").toLowerCase();
      },
    );
    var sources = Array.from(track.feats.sources || []);
    var sourceMatch = sources.some(function (source) {
      return (source || "").toLowerCase().includes(searchQuery);
    });
    var topGenre = (track.feats.topGenre || "").toLowerCase();
    if (
      trackName.includes(searchQuery) ||
      albumName.includes(searchQuery) ||
      sourceMatch ||
      topGenre.includes(searchQuery)
    )
      return true;
    return (
      artistNames.some(function (artistName) {
        return artistName.includes(searchQuery);
      }) ||
      albumGenres.some(function (genre) {
        return genre.includes(searchQuery);
      }) ||
      trackGenres.some(function (genre) {
        return genre.includes(searchQuery);
      }) ||
      artistGenres.flat().some(function (genre) {
        return (genre || "").toLowerCase().includes(searchQuery);
      })
    );
  });
}

function showStagingList() {
  if (theStagingTable == null) return;

  curSelectedTracks = [];
  curSelected.forEach(function (tid) {
    curSelectedTracks.push(curTracks[tid]);
  });
  if (curSelectedTracks.length > 0) {
    var full = document.getElementById("staging-full");
    full.classList.remove("hidden");
    full.classList.add("block");
    var empty = document.getElementById("staging-empty");
    empty.classList.remove("block");
    empty.classList.add("hidden");
  } else {
    var full = document.getElementById("staging-full");
    full.classList.remove("block");
    full.classList.add("hidden");
    var empty = document.getElementById("staging-empty");
    empty.classList.remove("hidden");
    empty.classList.add("block");
  }
  var truncated = document.getElementById("gthe-staging-table-truncated");
  if (curSelectedTracks.length > maxTracksShown) {
    if (truncated) {
      truncated.classList.remove("hidden");
      truncated.classList.add("block");
    }
  } else {
    if (truncated) {
      truncated.classList.remove("block");
      truncated.classList.add("hidden");
    }
  }
  showTracksInTable(
    theStagingTable,
    curSelectedTracks,
    featGetter("popularity"),
    "popularity",
    true,
  );
}

function getStagingTracks() {
  // Return currently selected tracks in a consistent order
  var out = [];
  curSelected.forEach(function (tid) {
    var track = curTracks[tid];
    if (track) out.push(track);
  });
  // Sort by popularity by default for the saved playlist
  out.sort(function (a, b) {
    return b.feats.popularity - a.feats.popularity;
  });
  return out;
}

function toFiniteNumber(val) {
  if (val == null || val === "") return null;
  var num = Number(val);
  if (!Number.isFinite(num)) return null;
  return num;
}
function getInt(val) {
  var num = toFiniteNumber(val);
  if (num == null) return null;
  return Math.round(num);
}
function getString(val) {
  if (val == null) return "";
  if (typeof val === "number" && !Number.isFinite(val)) return "";
  return String(val);
}
function getDate(val) {
  if (val && val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  return "";
}
function getPercent(val) {
  var num = toFiniteNumber(val);
  if (num == null) return null;
  return getInt(num * 100);
}
function getDuration(val) {
  var num = toFiniteNumber(val);
  if (num == null) return null;
  return getInt(num / 1000);
}

function buildAudioFeaturesPayload(track) {
  var feats = (track && track.feats) || {};
  return {
    id: track ? track.id : null,
    danceability: toFiniteNumber(feats.danceability),
    energy: toFiniteNumber(feats.energy),
    valence: toFiniteNumber(feats.valence),
    tempo: toFiniteNumber(feats.tempo),
    loudness: toFiniteNumber(feats.loudness),
    speechiness: toFiniteNumber(feats.speechiness),
    acousticness: toFiniteNumber(feats.acousticness),
    instrumentalness: toFiniteNumber(feats.instrumentalness),
    liveness: toFiniteNumber(feats.liveness),
    key: toFiniteNumber(feats.key),
    mode: toFiniteNumber(feats.mode),
    time_signature: toFiniteNumber(feats.time_signature),
  };
}

function refreshNormalizedTrackData() {
  var tracks = Object.values(curTracks || {});
  var audioFeatures = tracks.map(buildAudioFeaturesPayload);

  var normalizedRows = normalizeSpotifyTracks(
    curRawTrackItems,
    audioFeatures,
  );
  window.normalizedTrackData = normalizedRows;

  var normalizedById = {};
  normalizedRows.forEach(function (row) {
    if (row && row.id) {
      normalizedById[row.id] = row;
    }
  });

  tracks.forEach(function (track) {
    if (!track || !track.id || !(track.id in normalizedById)) return;
    var normalized = normalizedById[track.id];

    // Keep the legacy nested shape, but copy the flattened fields onto the
    // live track object so all downstream renderers can read them directly.
    Object.keys(normalized).forEach(function (key) {
      if (key === 'id') return;
      track[key] = normalized[key];
    });

    track.feats = track.feats || {};
    track.details = track.details || {};
  });

  return window.normalizedTrackData;
}

function mergeTracksWithNormalizedRows(tracks) {
  var normalizedRows = Array.isArray(window.normalizedTrackData)
    ? window.normalizedTrackData
    : [];

  if (normalizedRows.length === 0) {
    return tracks;
  }

  var normalizedById = {};
  normalizedRows.forEach(function (row) {
    if (row && row.id) {
      normalizedById[row.id] = row;
    }
  });

  return (tracks || []).map(function (track) {
    if (!track || !track.id) return track;
    var normalized = normalizedById[track.id];
    if (!normalized) return track;

    return {
      ...track,
      ...normalized,
      details: {
        ...(track.details || {}),
      },
      feats: {
        ...(track.feats || {}),
      },
    };
  });
}

function showTracksInTable(table, tracks, getter, label, isStagingList) {
  var mergedTracks = mergeTracksWithNormalizedRows(tracks);

  if (isStagingList) {
    if (window.renderStagingTable) {
      window.renderStagingTable(mergedTracks);
    }
  } else {
    if (window.renderTrackTable) {
      window.renderTrackTable(mergedTracks);
    }
  }
}

function saveTracksToPlaylist(playlist, inputTracks) {
  var tracks = inputTracks.slice();
  function saveTracks() {
    var uris = [];
    while (tracks.length > 0 && uris.length < 100) {
      var track = tracks.shift();
      uris.push(track.details.uri);
    }

    var url =
      "https://api.spotify.com/v1/users/" +
      curUserID +
      "/playlists/" +
      playlist.id +
      "/tracks";
    var params = { uris: uris };
    callSpotify("POST", url, params, function (ok) {
      if (ok) {
        if (tracks.length > 0) saveTracks();
        else info("playlist saved");
      } else {
        error("Trouble adding tracks to playlist");
      }
    });
  }
  saveTracks();
}

function makeNode(name, label, filter, getter, sorter, plottable) {
  var node = {
    name: name,
    label: label,
    plottable: plottable,
    tracks: [],
    artists: new Set(),
    filter: filter,
    getter: getter,
    sorter: sorter,
  };
  nodeMap[name] = node;
  return node;
}

function savePlaylist() {
  var curTracks = getStagingTracks();
  if (curTracks.length > 0) {
    var name = document.getElementById("staging-playlist-name").textContent;
    info("saving " + name);
    var url = "https://api.spotify.com/v1/users/" + curUserID + "/playlists";
    callSpotify("POST", url, { name: name }, function (ok, results) {
      if (ok) {
        saveTracksToPlaylist(results, curTracks);
      } else {
        error("Trouble creating playlist");
      }
    });
  } else {
    info("no tracks to save");
  }
}

function collapseAllSidebar() {
  sidebarExpanded = false;
  var lists = document.querySelectorAll(".playlist-list");
  lists.forEach(function (el) {
    el.style.display = "none";
  });
  var icons = document.querySelectorAll("#sidebar h4 i");
  icons.forEach(function (icon) {
    icon.classList.remove("fa-chevron-up");
    icon.classList.add("fa-chevron-down");
  });
  updateSidebarToggleButton();
  window.localStorage.setItem(SIDEBAR_EXPANDED_KEY, "false");
}

function expandAllSidebar() {
  sidebarExpanded = true;
  var lists = document.querySelectorAll(".playlist-list");
  lists.forEach(function (el) {
    el.style.display = "block";
  });
  var icons = document.querySelectorAll("#sidebar h4 i");
  icons.forEach(function (icon) {
    icon.classList.remove("fa-chevron-down");
    icon.classList.add("fa-chevron-up");
  });
  updateSidebarToggleButton();
  window.localStorage.setItem(SIDEBAR_EXPANDED_KEY, "true");
}

function toggleSidebarSections() {
  if (sidebarExpanded) collapseAllSidebar();
  else expandAllSidebar();
}

// Make shared variables and functions available to other modules
window.curSelected = curSelected;
window.nowPlaying = nowPlaying;
window.audio = audio;
window.playTrack = playTrack;
window.toggleSidebarSections = toggleSidebarSections;
window.collapseAllSidebar = collapseAllSidebar;
window.expandAllSidebar = expandAllSidebar;

function updateSidebarToggleButton() {
  var button = document.getElementById("sidebar-toggle-btn");
  if (!button) return;
  var icon = button.querySelector("i");
  if (sidebarExpanded) {
    icon.classList.remove("fa-angle-double-down");
    icon.classList.add("fa-angle-double-up");
    button.setAttribute("title", "Collapse all categories");
    button.setAttribute("aria-label", "Collapse all categories");
  } else {
    icon.classList.remove("fa-angle-double-up");
    icon.classList.add("fa-angle-double-down");
    button.setAttribute("title", "Expand all categories");
    button.setAttribute("aria-label", "Expand all categories");
  }
}

function updateViewOfTheWorld(quick) {
  var isFirstPlaylist = true;
  var minTracksForSection = 3;
  var sidebar = document.getElementById("sidebar");
  sidebar.replaceChildren();

  updateFavs();
  var renderWorld = theWorld.slice();
  if (renderWorld.length > 0) {
    renderWorld = [renderWorld[renderWorld.length - 1]].concat(
      renderWorld.slice(0, renderWorld.length - 1),
    );
  }

  var sidebarControls = document.createElement("div");
  sidebarControls.className =
    "mb-4 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/20 px-3 py-3";

  var controlsLeft = document.createElement("div");
  controlsLeft.className = "min-w-0";
  var controlsTitle = document.createElement("div");
  controlsTitle.className =
    "text-xs font-bold uppercase tracking-wider text-zinc-400";
  controlsTitle.textContent = "Library bins";
  var controlsSub = document.createElement("div");
  controlsSub.className = "text-[11px] text-zinc-500";
  controlsSub.textContent = "Top result first, categories below.";
  controlsTitle.appendChild(controlsSub);
  controlsLeft.appendChild(controlsTitle);

  var toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.id = "sidebar-toggle-btn";
  toggleButton.className =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-spotify-green hover:text-spotify-green";
  var toggleIcon = document.createElement("i");
  toggleIcon.className = "fa fa-angle-double-up text-xs";
  toggleButton.appendChild(toggleIcon);
  toggleButton.onclick = function () {
    toggleSidebarSections();
  };

  sidebarControls.appendChild(controlsLeft);
  sidebarControls.appendChild(toggleButton);
  sidebar.appendChild(sidebarControls);

  renderWorld.forEach(function (bin) {
    var nodes = sortedNodes(bin.nodes);

    var head = document.createElement("h4");
    head.textContent = uname(bin.name);
    head.className =
      "mt-4 mb-2 pb-1 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400 cursor-pointer hover:text-white flex justify-between items-center transition-colors";
    var headIcon = document.createElement("i");
    headIcon.className =
      "fa fa-chevron-down text-zinc-500 text-[10px] transition-transform duration-200";
    head.appendChild(headIcon);
    sidebar.appendChild(head);

    var ul = document.createElement("ul");
    ul.className = "playlist-list";
    ul.id = nname(bin.name);
    sidebar.appendChild(ul);

    head.onclick = function () {
      var isHidden = ul.style.display === "none";
      if (isHidden) {
        ul.style.display = "block";
        headIcon.classList.remove("fa-chevron-down");
        headIcon.classList.add("fa-chevron-up");
      } else {
        ul.style.display = "none";
        headIcon.classList.remove("fa-chevron-up");
        headIcon.classList.add("fa-chevron-down");
      }
    };

    nodes.forEach(function (node) {
      node.tracks = node.sorter(node.tracks);
      var tracks = node.tracks;
      if (tracks.length >= minTracksForSection) {
        var header = document.createElement("li");
        header.textContent = uname(node.name);
        header.className =
          "py-1 px-2 text-sm text-zinc-300 cursor-pointer hover:text-white hover:bg-[#3E3E3E] rounded transition-colors duration-150 flex justify-between items-center";
        var stats = document.createElement("span");
        stats.className = "stats text-xs text-zinc-500 ml-2";
        stats.textContent = "(" + tracks.length + ")";
        header.appendChild(stats);
        if (!quick) {
          header.onclick = function () {
            plotPlaylist(node);
            showPlaylist(node);
          };
          if (isFirstPlaylist) {
            isFirstPlaylist = false;
            showPlaylist(node);
            plotPlaylist(node);
          }
        }
        ul.appendChild(header);
      }
    });

    if (!sidebarExpanded) {
      ul.style.display = "none";
      headIcon.classList.remove("fa-chevron-up");
      headIcon.classList.add("fa-chevron-down");
    }
  });

  updateSidebarToggleButton();
}

var plottableData = {
  energy: {
    name: "energy",
    min: 0,
    max: 1,
    getter: featGetterPercent("energy"),
  },
  danceability: {
    name: "danceability",
    min: 0,
    max: 1,
    getter: featGetterPercent("danceability"),
  },
  valence: {
    name: "valence",
    min: 0,
    max: 1,
    getter: featGetterPercent("valence"),
  },
  duration: {
    name: "duration",
    min: 0,
    max: 1500,
    getter: featGetter("duration"),
  },
  tempo: { name: "tempo", min: 40, max: 240, getter: featGetter("tempo") },
  anger: { name: "anger", min: 0, max: 1, getter: featGetterPercent("anger") },
  happiness: {
    name: "happiness",
    min: 0,
    max: 1,
    getter: featGetterPercent("happiness"),
  },
  loudness: {
    name: "loudness",
    min: -30,
    max: 0,
    getter: featGetter("loudness"),
  },
  acousticness: {
    name: "acousticness",
    min: 0,
    max: 1,
    getter: featGetterPercent("acousticness"),
  },
  liveness: {
    name: "live",
    min: 0,
    max: 1,
    getter: featGetterPercent("liveness"),
  },
  speechiness: {
    name: "speechiness",
    min: 0,
    max: 1,
    getter: featGetterPercent("speechiness"),
  },
  popularity: {
    name: "popularity",
    min: 0,
    max: 100,
    getter: featGetter("popularity"),
  },
  age: {
    min: 0,
    max: 5000,
    name: "days-since-added",
    getter: featGetter("age"),
  },
  year: {
    min: 1950,
    max: 2020,
    name: "release-year",
    getter: featGetter("year"),
  },
};

function addPlotSelect(elem, defaultValue) {
  elem.replaceChildren();
  var keys = Object.keys(plottableData);
  keys.sort();
  keys.forEach(function (key) {
    var param = plottableData[key];
    var option = document.createElement("option");
    option.textContent = param.name;
    option.value = key;
    elem.appendChild(option);
  });
  elem.value = defaultValue;
  elem.onchange = redrawPlot;
}

function nname(s) {
  return s.replace(/ /g, "_");
}
function uname(s) {
  return s.replace(/_/g, " ");
}

function sortedNodes(nodes) {
  nodes.sort(function (a, b) {
    if (a.name == "(unclassified genre)") return 1;
    else if (b.name == "(unclassified genre)") return -1;
    else {
      if (a.tracks.length > b.tracks.length) return -1;
      else if (a.tracks.length < b.tracks.length) return 1;
      else return 0;
    }
  });
  return nodes;
}

function featGenreFilter(genre) {
  return function (track) {
    return track.feats.genres.has(genre);
  };
}
function featGenreGetter(genre) {
  return function (track) {
    var glist = Array.from(track.feats.genres);
    return glist.join(", ");
  };
}
function featGenreSorter() {
  return function (tracks) {
    tracks.sort(function (a, b) {
      if (a.feats.genres.size > b.feats.genres.size) return 1;
      else if (a.feats.genres.size < b.feats.genres.size) return -1;
      else return b.feats.popularity - a.feats.popularity;
    });
    return tracks;
  };
}

function featSourceFilter(source) {
  return function (track) {
    return track.feats.sources && track.feats.sources.has(source);
  };
}
function featSourceGetter(source) {
  return function (track) {
    return Array.from(track.feats.sources || []).join(", ");
  };
}

function featSorter(param, reverse) {
  return function (tracks) {
    tracks.sort(function (a, b) {
      if (a.feats[param] > b.feats[param]) return 1;
      else if (a.feats[param] < b.feats[param]) return -1;
      else return 0;
    });
    if (reverse) tracks.reverse();
    return tracks;
  };
}

function featGetter(param) {
  return function (track) {
    return track.feats[param];
  };
}
function featGetterInt(param) {
  return function (track) {
    return Math.round(track.feats[param]);
  };
}
function featGetterPercent(param) {
  return function (track) {
    return Math.round(100 * track.feats[param]);
  };
}
function featGetterBool(param, true_val, false_val) {
  return function (track) {
    return track.feats[param] ? true_val : false_val;
  };
}
function featBoolFilter(param, state) {
  return function (track) {
    return "feats" in track && track.feats[param] == state;
  };
}
function featMusicFilter(param, low, high) {
  return function (track) {
    return (
      "feats" in track &&
      track.feats.speechiness < 0.8 &&
      track.feats[param] >= low &&
      track.feats[param] <= high
    );
  };
}
function featMissingFilter(param) {
  return function (track) {
    return !("energy" in track.feats);
  };
}
function featFilter(param, low, high) {
  return function (track) {
    return (
      "feats" in track &&
      track.feats[param] >= low &&
      track.feats[param] <= high
    );
  };
}

function applyFilter(tracks, filt) {
  var out = [];
  tracks.forEach(function (track) {
    if (filt(track)) out.push(track);
  });
  return out;
}

function getYearForTrack(track) {
  var year = -1;
  if (track.details.album_id in curAlbums) {
    var album = curAlbums[track.details.album_id];
    if ("release_date" in album) {
      var date = album.release_date;
      if (date.length >= 4) {
        var syear = date.substring(0, 4);
        year = parseInt(syear);
      }
    }
  }
  return year;
}

function getGenresForTrack(track) {
  var genres = [];
  var albumId = track.details.album_id;
  if (albumId in curAlbums) {
    var album = curAlbums[albumId];
    (album.genres || []).forEach(function (g) {
      genres.push(g);
    });
  }

  track.details.artists.forEach(function (artist) {
    if (artist.id in curArtists) {
      var detailedArtist = curArtists[artist.id];
      (detailedArtist.genres || []).forEach(function (genre) {
        genres.push(genre);
      });
    }
  });
  if (genres.length == 0) genres.push("(unclassified genre)");
  return genres;
}

function tinyArtists(artists) {
  return (artists || []).map(function (a) {
    return {
      id: a.id,
      name: a.name,
    };
  });
}

function isGoodGenre(genre) {
  var lgenre = genre.toLowerCase();
  for (var i = 0; i < skipGenrePhrases.length; i++) {
    var phrase = skipGenrePhrases[i];
    if (lgenre.indexOf(phrase) != -1) return false;
  }
  return true;
}

function error(msg) {
  info(msg);
}
function info(msg) {
  document.getElementById("info").textContent = msg;
}
function linfo(msg) {
  document.getElementById("linfo").textContent = msg;
}

function generateRandomString(length) {
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).reduce(function (acc, x) {
    return acc + possible[x % possible.length];
  }, "");
}

function sha256(plain) {
  var encoder = new TextEncoder();
  var data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
}

function base64encode(input) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function authorizeUser() {
  console.log("Initiating Authorize User flow...");
  var scopes =
    "user-library-read user-read-email playlist-read-private playlist-read-collaborative playlist-modify-public";
  var codeVerifier = generateRandomString(64);
  window.localStorage.setItem("code_verifier", codeVerifier);

  sha256(codeVerifier)
    .then(function (hashed) {
      var codeChallenge = base64encode(hashed);
      var authUrl =
        "https://accounts.spotify.com/authorize?" +
        "client_id=" +
        encodeURIComponent(SPOTIFY_CLIENT_ID) +
        "&response_type=code&show_dialog=false&scope=" +
        encodeURIComponent(scopes) +
        "&redirect_uri=" +
        encodeURIComponent(SPOTIFY_REDIRECT_URI) +
        "&code_challenge_method=S256&code_challenge=" +
        encodeURIComponent(codeChallenge);

      console.log("Redirecting to Spotify Auth URL:", authUrl);
      document.location = authUrl;
    })
    .catch(function (err) {
      console.error("Error in sha256 generation:", err);
      error("Secure context required or crypto API failure.");
    });
}

function persistSpotifyTokens(data) {
  if (!data) {
    return;
  }

  if (data.access_token) {
    accessToken = data.access_token;
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.access_token);
  }

  if (data.refresh_token) {
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refresh_token);
  }
}

async function exchangeCodeForToken(code) {
  var codeVerifier = window.localStorage.getItem("code_verifier");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange code for token");
  }

  const data = await response.json();
  persistSpotifyTokens(data);
  return data;
}

async function refreshAccessToken() {
  var refreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  if (!refreshToken) {
    throw new Error("Refresh token is missing");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh access token");
  }

  const data = await response.json();
  persistSpotifyTokens(data);
  if (!data || !data.access_token) {
    throw new Error("Refresh response missing access token");
  }
  return data;
}

async function callSpotify(type, url, json, callback) {
  var refreshed = false;

  async function doCall() {
    var backendUrl =
      window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
        ? "http://localhost:8000/api/spotify"
        : "/api/spotify";

    try {
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url,
          method: type,
          data: json,
          accessToken: accessToken,
        }),
      });

      var errorPayload = null;
      if (!response.ok) {
        errorPayload = await readSpotifyErrorPayload(response);
      }

      if (response.status === 403 && isSpotifyScopeError(errorPayload)) {
        restartAuthorization(
          "Your Spotify authorization expired or is missing permissions. Please connect again.",
        );
        return;
      }

      if (
        (response.status === 401 ||
          (response.status === 403 &&
            isSpotifyTokenExpiredError(errorPayload))) &&
        !refreshed
      ) {
        refreshed = true;
        try {
          await refreshAccessToken();
          await doCall();
        } catch (e) {
          restartAuthorization(
            "Your Spotify session expired. Please connect again.",
          );
        }
        return;
      }

      if (response.ok) {
        const r = await response.json();
        callback(true, r);
      } else {
        callback(false, response);
      }
    } catch (error) {
      callback(false, error);
    }
  }

  await doCall();
}

async function getSpotifyP(url, data) {
  var curRetry = 0;
  var maxRetries = 10;
  var refreshed = false;

  async function go() {
    var backendUrl =
      window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
        ? "http://localhost:8000/api/spotify"
        : "/api/spotify";

    try {
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url,
          data: data,
          accessToken: accessToken,
        }),
      });

      var errorPayload = null;
      if (!response.ok) {
        errorPayload = await readSpotifyErrorPayload(response);
      }

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 403 && isSpotifyScopeError(errorPayload)) {
        restartAuthorization(
          "Your Spotify authorization expired or is missing permissions. Please connect again.",
        );
        throw new Error("Unauthorized");
      }

      if (
        response.status === 403 &&
        isSpotifyTokenExpiredError(errorPayload) &&
        !refreshed
      ) {
        refreshed = true;
        await new Promise((r) => setTimeout(r, 1000));
        await refreshAccessToken();
        return await go();
      }

      if (response.status === 401 && !refreshed) {
        refreshed = true;
        await refreshAccessToken();
        return await go();
      }

      if (response.status >= 500 && response.status < 600) {
        if (curRetry++ < maxRetries) {
          await new Promise((r) => setTimeout(r, 500));
          return await go();
        }
        throw new Error("Server error after retries");
      }

      if (response.status === 429) {
        var retry = 2000;
        var retryAfter = response.headers.get("Retry-After");
        if (retryAfter) retry = parseInt(retryAfter, 10) * 1000;
        if (retry < 1000) retry = 1000;
        if (curRetry++ < maxRetries) {
          await new Promise((r) => setTimeout(r, retry + curRetry * retry));
          return await go();
        }
        throw new Error("Rate limit exceeded after retries");
      }

      throw new Error("API error: " + response.status);
    } catch (error) {
      throw error;
    }
  }
  return await go();
}

function fetchCurrentUserProfile() {
  var url = "https://api.spotify.com/v1/me";
  return getSpotifyP(url, null);
}

function isPlaying(track) {
  return track === nowPlaying && !audio.paused;
}

function playTrack(track) {
  if (track != nowPlaying) {
    audio.pause();
    audio.src = track.details.preview_url;
    audio.play();
    nowPlaying = track;
  } else {
    stopTrack();
  }
}

function stopTrack() {
  audio.pause();
  nowPlaying = null;
  document.querySelectorAll(".playing").forEach(function (el) {
    el.classList.remove("playing");
  });
}

// =======================================================================
// MODERNIZED DATA FETCHING (Replaces old sequential RSVP/Ajax logic)
// =======================================================================

class SpotifyDataFetcher {
  constructor() {
    // Automatically determine the correct backend URL (local vs prod)
    this.proxyUrl =
      window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
        ? "http://localhost:8000/api/spotify"
        : "/api/spotify";
    this.queue = [];
    this.activeRequests = 0;
    this.maxConcurrent = 3;
  }

  async enqueue(fn) {
    if (this.activeRequests >= this.maxConcurrent) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.activeRequests++;
    try {
      return await fn();
    } finally {
      this.activeRequests--;
      // Minimal breather between requests
      await this.sleep(100);
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next();
      }
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async apiCall(url, method = "GET", data = null, retries = 5) {
    let currentRetries = retries;
    let hasRefreshed = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for large batches

    while (currentRetries >= 0) {
      const result = await this.enqueue(async () => {
        try {
          const response = await fetch(this.proxyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, method, data, accessToken }),
            signal: controller.signal,
          });

          if (response.status === 429) {
            const retryAfterHeader = response.headers.get("Retry-After");
            const baseDelay = retryAfterHeader
              ? parseInt(retryAfterHeader, 10)
              : Math.pow(2, 5 - currentRetries) + 1;
            const jitter = Math.random() * 1000;
            const totalDelay = baseDelay * 1000 + jitter;
            return { type: "retry", delay: totalDelay };
          }

          if (response.status === 401 || response.status === 403) {
            var errorData = await readSpotifyErrorPayload(response);
            if (errorData) {
              console.error(`Spotify ${response.status} Error:`, errorData);
            }

            if (response.status === 403 && isSpotifyScopeError(errorData)) {
              restartAuthorization(
                "Your Spotify authorization expired or is missing permissions. Please connect again.",
              );
              return { type: "error", message: "Scope or permission error" };
            }

            // Try to refresh token ONCE per call
            if (
              !hasRefreshed &&
              (response.status === 401 || isSpotifyTokenExpiredError(errorData))
            ) {
              console.log(
                "Token expired during API call, attempting refresh...",
              );
              hasRefreshed = true;
              try {
                await refreshAccessToken();
                return { type: "retry", delay: 0 }; // Immediate retry with new token
              } catch (e) {
                console.error("Automatic token refresh failed:", e);
              }
            }

            var errorMsg =
              "Your Spotify session expired or is missing permissions. Please connect again.";
            if (response.status === 403) {
              errorMsg =
                "Access Forbidden (403). If using a custom Client ID, ensure your Spotify email is whitelisted in the Developer Dashboard (Users and Access).";
            }
            restartAuthorization(errorMsg);
            return { type: "error", message: "Auth expired" };
          }

          if (!response.ok) {
            const errorData = await response.text();
            return {
              type: "error",
              message: `API Error: ${response.status} - ${errorData}`,
            };
          }

          const json = await response.json();
          return { type: "success", data: json };
        } catch (error) {
          if (error.name === "AbortError") {
            return { type: "error", message: "Request timed out" };
          }
          return { type: "error", message: error.message };
        }
      });

      if (result.type === "success") {
        clearTimeout(timeoutId);
        return result.data;
      }

      if (result.type === "retry" && currentRetries > 0) {
        if (result.delay > 0) {
          console.warn(
            `Rate limited (429). Retrying in ${Math.round(result.delay)}ms... (Attempts left: ${currentRetries})`,
          );
          await this.sleep(result.delay);
        }
        currentRetries--;
        continue;
      }

      clearTimeout(timeoutId);
      throw new Error(result.message || "Max retries exceeded or fatal error.");
    }
  }
}

const spotifyFetcher = new SpotifyDataFetcher();

// =======================================================================
// UI STATE MANAGEMENT FUNCTIONS (moved earlier to prevent ReferenceError)
// =======================================================================

function startShowingTracks() {
  showLoadingState();
}

function stopShowingTracks() {
  showLoadedState();
}

function showLoadingState() {
  var selectionState = document.getElementById("selection-state");
  if (selectionState) selectionState.style.display = "none";

  var loadingState = document.getElementById("loading");
  if (loadingState) {
    loadingState.classList.remove("hidden");
    loadingState.classList.add("block");
  }

  // Hide all UI aspects using forceful styles
  var nav = document.querySelector("nav");
  if (nav) nav.style.setProperty("display", "none", "important");

  var sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.add("hidden");
    sidebar.classList.remove("md:block", "md:flex", "flex");
    sidebar.style.setProperty("display", "none", "important");
  }

  var loaded = document.getElementById("loaded");
  if (loaded) {
    loaded.classList.add("hidden");
    loaded.classList.remove("flex");
    loaded.style.setProperty("display", "none", "important");
  }

  var mainArea = document.getElementById("main-area");
  if (mainArea) {
    mainArea.classList.remove("hidden");
    mainArea.classList.add("flex");
    mainArea.style.setProperty("display", "flex", "important");
  }

  var mainWrapper = document.getElementById("main-wrapper");
  if (mainWrapper) {
    mainWrapper.classList.remove("hidden");
    mainWrapper.classList.add("flex");
    mainWrapper.style.setProperty("display", "flex", "important");
  }

  var intro = document.getElementById("intro");
  if (intro) intro.style.setProperty("display", "none", "important");

  // Hide the sidebar toggle button
  var toggleSidebarBtn = document.getElementById("toggle-sidebar");
  if (toggleSidebarBtn) {
    toggleSidebarBtn.classList.add("hidden");
    toggleSidebarBtn.classList.remove("md:flex");
  }
}

function showLoadedState() {
  var loadingState = document.getElementById("loading");
  if (loadingState) {
    loadingState.classList.remove("block");
    loadingState.classList.add("hidden");
    loadingState.style.setProperty("display", "none", "important");
  }

  var selectionState = document.getElementById("selection-state");
  if (selectionState) selectionState.style.display = "none";

  // Restore UI aspects
  var nav = document.querySelector("nav");
  if (nav) nav.style.setProperty("display", "flex", "important");

  var sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.remove("hidden");
    sidebar.classList.add("md:block");
    sidebar.style.removeProperty("display");
  }

  var loaded = document.getElementById("loaded");
  if (loaded) {
    loaded.classList.remove("hidden");
    loaded.classList.add("flex");
    loaded.style.removeProperty("display");
  }

  var mainArea = document.getElementById("main-area");
  if (mainArea) {
    mainArea.classList.remove("hidden");
    mainArea.classList.add("flex");
    mainArea.style.removeProperty("display");
  }

  var mainWrapper = document.getElementById("main-wrapper");
  if (mainWrapper) {
    mainWrapper.classList.remove("hidden");
    mainWrapper.classList.add("flex");
    mainWrapper.style.removeProperty("display");
  }

  var toggleSidebarBtn = document.getElementById("toggle-sidebar");
  if (toggleSidebarBtn) {
    toggleSidebarBtn.classList.remove("hidden");
    toggleSidebarBtn.classList.add("md:flex");
  }

  // Restore sidebar visibility state
  var sidebarVisible = window.localStorage.getItem(SIDEBAR_VISIBLE_KEY);
  if (sidebarVisible === "false") {
    var sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.classList.add("hidden");
      sidebar.classList.remove("md:block", "md:flex", "flex");
      sidebar.style.setProperty("display", "none", "important");

      var icon = toggleSidebarBtn?.querySelector("i");
      if (icon) {
        icon.classList.remove("fa-bars");
        icon.classList.add("fa-arrow-right");
      }
    }
  }

  // Restore sidebar sections state
  var sectionsExpanded = window.localStorage.getItem(SIDEBAR_EXPANDED_KEY);
  if (sectionsExpanded === "false") {
    collapseAllSidebar();
  } else if (sectionsExpanded === "true") {
    expandAllSidebar();
  }

  var intro = document.getElementById("intro");
  if (intro) intro.style.setProperty("display", "none", "important");
}

function showRefreshingState() {
  // For refetching: show subtle loading overlay without hiding the UI
  var loadingState = document.getElementById("loading");
  if (loadingState) {
    loadingState.classList.remove("hidden");
    loadingState.classList.add("block");
    loadingState.style.setProperty("opacity", "0.7", "important");
  }

  // Keep the UI visible so users can see current data
  var nav = document.querySelector("nav");
  if (nav) nav.style.setProperty("display", "flex", "important");

  var sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.remove("hidden");
    sidebar.style.removeProperty("display");
  }

  var loaded = document.getElementById("loaded");
  if (loaded) {
    loaded.classList.remove("hidden");
    loaded.style.removeProperty("display");
  }

  var mainArea = document.getElementById("main-area");
  if (mainArea) {
    mainArea.classList.remove("hidden");
    mainArea.style.removeProperty("display");
  }
}

/**
 * Replaces the old collectAudioAttributes, collectArtistAttributes,
 * and collectAlbumAttributes by fetching them all concurrently.
 */
async function collectAllMetadata(tracks) {
  const tids = tracks.map((t) => t.id);
  const aidsSet = new Set();
  const albumIdsSet = new Set();

  // Map out the IDs we need to query
  tracks.forEach((track) => {
    track.details.artists.forEach((artist) => aidsSet.add(artist.id));
    if (!(track.details.album_id in curAlbums))
      albumIdsSet.add(track.details.album_id);
  });

  const aids = Array.from(aidsSet);
  const albumIds = Array.from(albumIdsSet);

  // Spotify's mandatory chunk limits
  const trackChunks = spotifyFetcher.chunkArray(tids, 100);
  const artistChunks = spotifyFetcher.chunkArray(aids, 50);
  const albumChunks = spotifyFetcher.chunkArray(albumIds, 20);

  // Fetch Audio Features, Artists, and Albums in PARALLEL
  const allReqs = [
    ...trackChunks.map((chunk) => ({ type: "track", chunk })),
    ...artistChunks.map((chunk) => ({ type: "artist", chunk })),
    ...albumChunks.map((chunk) => ({ type: "album", chunk })),
  ];

  const totalBatches = allReqs.length;
  let completedBatches = 0;

  // Process all requests. The enqueue system handles the 3-at-a-time limit,
  // but we use Promise.all here to manage the overall collection.
  await Promise.all(
    allReqs.map(async (req) => {
      if (abortLoading) return;
      try {
        if (req.type === "track") {
          const res = await spotifyFetcher.apiCall(
            "https://api.spotify.com/v1/audio-features",
            "GET",
            { ids: req.chunk.join(",") },
          );
          if (res && res.audio_features) {
            res.audio_features.forEach((audio_feature) => {
              if (audio_feature && audio_feature.id) {
                const track = curTracks[audio_feature.id];
                if (track) {
                  Object.keys(audio_feature).forEach(function (name) {
                    track.feats[name] = audio_feature[name];
                  });
                  track.feats.sadness =
                    (1 - audio_feature.energy) * (1 - audio_feature.valence);
                  track.feats.happiness =
                    audio_feature.energy * audio_feature.valence;
                  track.feats.anger =
                    audio_feature.energy * (1 - audio_feature.valence);
                }
              }
            });
          }
        } else if (req.type === "artist") {
          const res = await spotifyFetcher.apiCall(
            "https://api.spotify.com/v1/artists",
            "GET",
            { ids: req.chunk.join(",") },
          );
          if (res && res.artists) {
            res.artists.forEach((artist) => {
              if (artist && artist.id) {
                curArtists[artist.id] = {
                  genres: artist.genres,
                  name: artist.name,
                  count: 0,
                };
              }
            });
          }
        } else if (req.type === "album") {
          const res = await spotifyFetcher.apiCall(
            "https://api.spotify.com/v1/albums",
            "GET",
            { ids: req.chunk.join(",") },
          );
          if (res && res.albums) {
            res.albums.forEach((album) => {
              if (album && album.id) {
                curAlbums[album.id] = {
                  name: album.name,
                  release_date: album.release_date,
                  genres: album.genres,
                };
              }
            });
          }
        }
      } catch (e) {
        console.error(`Metadata batch failed for ${req.type}:`, e);
      } finally {
        completedBatches++;
        const progress = Math.round((completedBatches / totalBatches) * 100);
        linfo(
          `Enriching metadata: ${completedBatches} / ${totalBatches} batches...`,
        );
        setProgress(progress);
      }
    }),
  );

  // Calculate artist appearance counts based on new tracks safely
  tracks.forEach((track) => {
    track.details.artists.forEach((artist) => {
      if (curArtists[artist.id]) {
        curArtists[artist.id].count += 1;
        if (curArtists[artist.id].count > topArtistCount) {
          topArtistCount = curArtists[artist.id].count;
          topArtistName = curArtists[artist.id].name;
        }
      }
    });
  });
}

/**
 * Replaces recursive fetching with parallel page fetching
 */
async function getTracksFromAPI(source, uri) {
  const now = new Date();
  const allNewTracks = [];
  const allLoadedTracks = [];
  const limit = 50;

  // 1. Fetch the first page to get total size
  const firstPage = await spotifyFetcher.apiCall(uri, "GET", {
    limit,
    offset: 0,
    market: "from_token",
  });
  if (!firstPage || firstPage.total === undefined) return curTracks;

  totalTracks = firstPage.total;
  let allItems = [...(firstPage.items || [])];
  refreshHeader();

  // 2. Queue up and fetch in batches of 10 to avoid 429 rate limiting
  const offsetList = [];
  for (let offset = limit; offset < totalTracks; offset += limit) {
    if (abortLoading) break;
    offsetList.push(offset);
  }

  const batches = spotifyFetcher.chunkArray(offsetList, 10);
  for (const batch of batches) {
    if (abortLoading) break;
    const pageResults = await Promise.all(
      batch.map((offset) =>
        spotifyFetcher.apiCall(uri, "GET", {
          limit,
          offset,
          market: "from_token",
        }),
      ),
    );
    pageResults.forEach((page) => {
      if (page && page.items) {
        allItems = allItems.concat(page.items);
        refreshHeader();
      }
    });
  }

  // 3. Process the collected track objects into our global map
  allItems.forEach((item) => {
    curRawTrackItems.push(item);

    if (!item.is_local && item.track && "id" in item.track) {
      var addedAtDate = item.added_at ? new Date(item.added_at) : new Date();
      var diffMs = now.getTime() - addedAtDate.getTime();
      var diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (item.track.id in curTracks) {
        curTracks[item.track.id].feats.count += 1;
        if (curTracks[item.track.id].feats.sources) {
          curTracks[item.track.id].feats.sources.add(source);
        }
        if (curTracks[item.track.id].feats.count > topTrackCount) {
          topTrackCount = curTracks[item.track.id].feats.count;
          topTrackName = item.track.name;
        }
      } else {
        const track = {
          id: item.track.id,
          feats: {
            date_added: addedAtDate,
            age: diffDays,
            explicit: item.track.explicit,
            duration_ms: item.track.duration_ms,
            popularity: item.track.popularity,
            sources: new Set([source]),
            count: 1,
          },
          details: {
            name: item.track.name,
            album_id: item.track.album.id,
            uri: item.track.uri,
            preview_url: item.track.preview_url,
            artists: tinyArtists(item.track.artists),
          },
        };

        const ntrack = loadTrack(track.id);
        if (ntrack != null) {
          curTracks[track.id] = ntrack;
          curTracks[track.id].feats.count = 1;
          curTracks[track.id].feats.sources = new Set([source]);
        } else {
          curTracks[track.id] = track;
        }

        // NEW: Populate curArtists during collection to fix "0 artists" bug
        track.details.artists.forEach((artist) => {
          if (!(artist.id in curArtists)) {
            curArtists[artist.id] = { name: artist.name, genres: [], count: 0 };
          }
        });
      }
    }
  });
}

/**
 * Finalizes the collection by fetching metadata for all new tracks
 * and performing a single global UI refresh.
 */
async function finalizeCollection() {
  const allTracks = Object.values(curTracks);
  const tracksToEnrich = allTracks.filter((t) => !t.feats.energy); // If no audio features, we need metadata

  if (tracksToEnrich.length > 0) {
    document.getElementById("lplaylist-name").textContent =
      "Enriching Metadata...";
    linfo(
      "Fetching audio features and genres for " +
      tracksToEnrich.length +
      " tracks...",
    );
    await collectAllMetadata(tracksToEnrich);
  }

  refreshNormalizedTrackData();

  addTracks(allTracks);
  filterTracks(allTracks);
  refreshTheWorld(false);
}

// -------------------------------------------------------------------
// Updated Entry Points (Async Native)
// -------------------------------------------------------------------

async function getSavedTracks() {
  startShowingTracks();
  document.getElementById("lplaylist-name").textContent = "Your Saved Tracks";
  try {
    await getTracksFromAPI(
      "Your Saved tracks",
      "https://api.spotify.com/v1/me/tracks",
    );
    await finalizeCollection();
  } catch (error) {
    console.log("GST catch ", error);
  } finally {
    stopShowingTracks();
    showLoadedState();
  }
}

async function getAllMusic() {
  startShowingTracks();
  document.getElementById("lplaylist-name").textContent = "Your Saved Tracks";
  try {
    await getTracksFromAPI(
      "Your Saved Tracks",
      "https://api.spotify.com/v1/me/tracks",
    );
    await getMusicFromPlaylists(true);
    await finalizeCollection();
  } catch (err) {
    console.error("Error fetching all music: ", err);
  } finally {
    stopShowingTracks();
    showLoadedState();
  }
}

async function getMusicFromPlaylists(allPlaylists) {
  startShowingTracks();
  try {
    let offset = 0;
    let total = Infinity;
    const outstandingPlaylists = [];

    // Paginate playlists sequentially to avoid massive overhead upfront
    while (offset < total && !abortLoading) {
      const results = await spotifyFetcher.apiCall(
        "https://api.spotify.com/v1/me/playlists",
        "GET",
        { limit: 50, offset },
      );
      if (results && results.items) {
        totalPlaylists = results.total || 0;
        total = totalPlaylists;

        results.items.forEach((playlist) => {
          if (playlist) outstandingPlaylists.push(playlist);
        });

        offset += results.items.length;
      } else {
        throw new Error("Can't get your playlists");
      }
    }

    await loadPlaylists(outstandingPlaylists, allPlaylists);
    await finalizeCollection();
  } catch (err) {
    error("trouble, " + err);
  } finally {
    stopShowingTracks();
    showLoadedState();
  }
}

function isGoodPlaylist(playlist, allPlaylists) {
  if (allPlaylists) return true;
  return playlist.owner && playlist.owner.id === curUserID;
}

async function loadPlaylists(playlists, allPlaylists) {
  for (const playlist of playlists) {
    if (abortLoading) break;
    processedPlaylists += 1;

    if (quickMode && processedPlaylists > 100) return;

    if (isGoodPlaylist(playlist, allPlaylists)) {
      const trackCount =
        playlist.tracks && playlist.tracks.total ? playlist.tracks.total : 0;
      document.getElementById("lplaylist-name").textContent =
        playlist.name + " (" + trackCount + " tracks)";
      await getPlaylistTracks(playlist);
    }
  }
}

async function getPlaylistTracks(playlist) {
  const uri = playlist.uri;
  if (isValidPlaylistUri(uri)) {
    const playlistID = getPlaylistPid(uri);
    const url = `https://api.spotify.com/v1/playlists/${playlistID}/tracks`;
    return getTracksFromAPI(playlist.name, url);
  } else {
    throw new Error("bad playlist URI");
  }
}

async function getPlaylistFromURI(name, uri) {
  startShowingTracks();
  const playlist = { name, uri };
  try {
    await getPlaylistTracks(playlist);
    await finalizeCollection();
  } catch (err) {
    console.error("Error in getPlaylistFromURI:", err);
    error("Trouble fetching playlist: " + err.message);
  } finally {
    stopShowingTracks();
    showLoadedState();
  }
}

function isValidPlaylistUri(uri) {
  if (!uri || typeof uri !== "string") return false;
  var fields = uri.split(":");
  if (fields[0] !== "spotify") return false;
  // Standard playlist URI: spotify:playlist:ID (length 3)
  // Legacy user playlist URI: spotify:user:USER:playlist:ID (length 5)
  if (fields.length === 3 && fields[1] === "playlist") return true;
  if (fields.length === 5 && fields[3] === "playlist") return true;
  return false;
}

function getPlaylistPid(uri) {
  var fields = uri.split(":");
  if (fields.length === 3 && fields[1] === "playlist") return fields[2];
  if (fields.length === 5 && fields[3] === "playlist") return fields[4];
  // Fallback search for 'playlist' segment
  var idx = fields.indexOf("playlist");
  if (idx !== -1 && fields[idx + 1]) return fields[idx + 1];
  return null;
}

function saveInfo(params) {
  localStorage.setItem("info", JSON.stringify(params));
}
function getInfo() {
  var item = localStorage.getItem("info");
  return JSON.parse(item);
}

function compactTrackArtists(artists) {
  return (artists || []).map(function (artist) {
    return {
      id: artist && artist.id ? artist.id : "",
      name: artist && artist.name ? artist.name : "",
    };
  });
}

function clearWorldState() {
  theWorld.forEach(function (bin) {
    bin.nodes.forEach(function (node) {
      node.tracks = [];
      node.artists = new Set();
    });
  });
  theWorld[genreIndex].nodes = [];
  theWorld[sourceIndex].nodes = [];
  curSelected = new Set();
  curSelectedTracks = [];
  curPlottingNodes = {};
  curPlottingNames = [];
  nodeMap = {};
  genreIndex = 0;
  sourceIndex = 7;
}

function resetCollectionState() {
  curTracks = {};
  curRawTrackItems = [];
  curArtists = {};
  curAlbums = {};
  topArtistCount = 0;
  totalTracks = 0;
  topArtistName = null;
  topTrackName = null;
  topTrackCount = 0;
  totalPlaylists = 0;
  processedPlaylists = 0;
  curSelected = new Set();
  curSelectedTracks = [];
  clearWorldState();
  clearPlot();
  var elements = document.querySelectorAll(".nstaging-tracks");
  elements.forEach(function (el) {
    el.textContent = "0";
  });
  window.normalizedTrackData = [];
}

function buildTrackFromSpotifyItem(item, source) {
  var addedAtDate = item.added_at ? new Date(item.added_at) : new Date();
  var now = new Date();
  var age = (now.getTime() - addedAtDate.getTime()) / (1000 * 60 * 60 * 24);

  return {
    id: item.track.id,
    feats: {
      date_added: addedAtDate,
      age: age,
      explicit: item.track.explicit,
      duration_ms: item.track.duration_ms,
      popularity: item.track.popularity,
      sources: new Set([source]),
      count: 1,
    },
    details: {
      name: item.track.name,
      album_id: item.track.album.id,
      uri: item.track.uri,
      preview_url: item.track.preview_url,
      artists: tinyArtists(item.track.artists),
    },
  };
}

async function collectTracksByIds(trackRefs) {
  var ids = [];
  var trackMeta = {};

  trackRefs.forEach(function (trackRef) {
    if (!trackRef || !trackRef.id) return;
    ids.push(trackRef.id);
    trackMeta[trackRef.id] = trackRef;
  });

  var restoredTracks = [];
  var batches = [];
  for (var i = 0; i < ids.length; i += 50) {
    batches.push(ids.slice(i, i + 50));
  }

  for (var j = 0; j < batches.length; j++) {
    var batchIds = batches[j];
    try {
      var results = await getSpotifyP("https://api.spotify.com/v1/tracks", {
        ids: batchIds.join(","),
      });
      results.tracks.forEach(function (trackItem) {
        if (!trackItem || !trackItem.id) return;

        var trackRef = trackMeta[trackItem.id];
        var track = buildTrackFromSpotifyItem(
          {
            track: trackItem,
            added_at:
              trackRef && trackRef.feats ? trackRef.feats.date_added : null,
          },
          trackRef && trackRef.feats ? trackRef.feats.source : null,
        );
        if (trackRef && trackRef.feats) {
          if (trackRef.feats.date_added)
            track.feats.date_added = new Date(trackRef.feats.date_added);
          if (trackRef.feats.sources) {
            track.feats.sources = new Set(trackRef.feats.sources);
          } else if (trackRef.feats.source) {
            track.feats.sources = new Set([trackRef.feats.source]);
          }
          if (trackRef.feats.count) track.feats.count = trackRef.feats.count;
          var now = new Date();
          track.feats.age =
            (now.getTime() - track.feats.date_added.getTime()) /
            (1000 * 60 * 60 * 24);
        }

        restoredTracks.push(track);
      });
    } catch (error) {
      console.error("Batch fetch failed", error);
    }
  }
  return restoredTracks;
}

function startCollectionFetch(info) {
  if (info.type == "saved") getSavedTracks();
  else if (info.type == "added") getMusicFromPlaylists(false);
  else if (info.type == "playlist")
    getPlaylistFromURI("Your Playlist", info.uri);
  else if (info.type == "follow") getMusicFromPlaylists(true);
  else if (info.type == "all") getAllMusic();
  else console.log("unexpected type", info.type);
}

function refetchCurrentCollection() {
  var info = getInfo();
  if (!info || !info.type) return;
  abortLoading = false;
  // Show refreshing state (overlay) without resetting or hiding existing data
  showRefreshingState();
  startCollectionFetch(info);
}

function go() {
  var errs = document.querySelectorAll(".err-txt");
  errs.forEach(function (el) {
    el.textContent = "";
  });
  var type = document.getElementById("collection-type").value;
  var params = { type: type };
  if (type == "playlist") {
    var rawUri = document.getElementById("uri-text").value;
    params.uri = normalizeUri(rawUri);
  }
  saveInfo(params);

  showLoadingState();
  startCollectionFetch(params);
}

function goAll() {
  var errs = document.querySelectorAll(".err-txt");
  errs.forEach(function (el) {
    el.textContent = "";
  });
  var params = { type: "all" };
  saveInfo(params);

  showLoadingState();
  startCollectionFetch(params);
}

function normalizeUri(uri) {
  if (typeof uri !== "string") return "";
  uri = uri.trim();
  if (uri.indexOf("?") !== -1) uri = uri.split("?")[0];

  // If it's a URL or contains path segments
  if (uri.indexOf("/") !== -1) {
    var parts = uri.split("/").filter(function (p) {
      return p;
    });
    var playlistIdx = parts.indexOf("playlist");
    if (playlistIdx !== -1 && parts[playlistIdx + 1]) {
      var id = parts[playlistIdx + 1];
      var userIdx = parts.indexOf("user");
      if (userIdx !== -1 && parts[userIdx + 1]) {
        return "spotify:user:" + parts[userIdx + 1] + ":playlist:" + id;
      }
      return "spotify:playlist:" + id;
    }
  }

  // If it's already a URI
  if (uri.startsWith("spotify:")) {
    if (uri.endsWith(":")) uri = uri.substring(0, uri.length - 1);
    return uri;
  }

  // If it's just an ID (no colons or slashes), assume it's a playlist ID
  if (uri.length > 0 && uri.indexOf(":") === -1 && uri.indexOf("/") === -1) {
    return "spotify:playlist:" + uri;
  }

  return uri;
}

function stopLoading() {
  console.log("stop loading");
  abortLoading = true;
  linfo("Stopping ... hang on ...");
}

function goPlaylist() {
  var errs = document.querySelectorAll(".err-txt");
  errs.forEach(function (el) {
    el.textContent = "";
  });
  var uri = normalizeUri(document.getElementById("uri-text").value);
  if (isValidPlaylistUri(uri)) {
    var params = { type: "playlist", uri: uri };
    saveInfo(params);
    showLoadingState();
    startCollectionFetch(params);
  } else {
    var errMsg = document.getElementById("playlist-uri-error");
    if (errMsg) errMsg.textContent = "Invalid playlist URI";
  }
}

function setProgress(percent) {
  progressBar.style.width = percent + "%";
  progressBar.setAttribute("aria-valuenow", percent);
}

function initPlot() {
  addPlotSelect(document.getElementById("select-xaxis"), "energy");
  addPlotSelect(document.getElementById("select-yaxis"), "loudness");
  addPlotSelect(document.getElementById("select-size"), "popularity");

  document.getElementById("plot-clear").onclick = function () {
    clearPlot();
  };
  document.getElementById("refetch-button").onclick = function () {
    refetchCurrentCollection();
  };
  window.onresize = function () {
    redrawPlot();
  };
  clearPlot();
}

function renderLoggedInEmail(user) {
  var identity = null;
  if (user && user.email) {
    identity = user.email;
  } else if (user && user.id) {
    identity = user.id;
  }

  // Update top-right navigation info
  var whoElem = document.getElementById("who");
  if (whoElem) {
    whoElem.textContent = identity || "Not logged in";
  }

  var accountPill = document.getElementById("account-pill");
  if (!accountPill) return;

  if (!identity) {
    accountPill.classList.add("hidden");
    accountPill.textContent = "";
    return;
  }

  accountPill.textContent = "Logged in as " + identity;
  accountPill.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", function () {
  // Hydrate in-memory token so API calls always use the latest persisted value.
  accessToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);

  // Detect Client ID changes to prevent using incompatible tokens
  var lastClientId = window.localStorage.getItem("omy_last_client_id");
  if (lastClientId && lastClientId !== SPOTIFY_CLIENT_ID) {
    console.warn("Client ID change detected. Clearing stored session.");
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem("code_verifier");
    // Access token will be cleared upon first failure or manual reset
    accessToken = null;
  }
  window.localStorage.setItem("omy_last_client_id", SPOTIFY_CLIENT_ID);

  var urlParams = new URLSearchParams(window.location.search);
  var code = urlParams.get("code");
  var authError = urlParams.get("error");

  var toggleSidebarBtn = document.getElementById("toggle-sidebar");
  if (toggleSidebarBtn) {
    toggleSidebarBtn.onclick = function () {
      var sidebar = document.getElementById("sidebar");
      if (sidebar) {
        // More forceful check and toggle
        var isCurrentlyHidden = sidebar.classList.contains("hidden") ||
          sidebar.style.getPropertyValue("display") === "none";

        if (isCurrentlyHidden) {
          sidebar.classList.remove("hidden");
          sidebar.classList.add("md:block");
          sidebar.style.removeProperty("display");
          window.localStorage.setItem(SIDEBAR_VISIBLE_KEY, "true");
          // Update icon to bars
          var icon = toggleSidebarBtn.querySelector("i");
          if (icon) {
            icon.classList.remove("fa-arrow-right");
            icon.classList.add("fa-bars");
          }
        } else {
          sidebar.classList.add("hidden");
          sidebar.classList.remove("md:block", "md:flex", "flex");
          sidebar.style.setProperty("display", "none", "important");
          window.localStorage.setItem(SIDEBAR_VISIBLE_KEY, "false");
          // Update icon to something that suggests showing it back
          var icon = toggleSidebarBtn.querySelector("i");
          if (icon) {
            icon.classList.remove("fa-bars");
            icon.classList.add("fa-arrow-right");
          }
        }
        // Force a window resize event to trigger table/chart re-layouts
        window.dispatchEvent(new Event("resize"));
      }
    };
  }

  var collectionType = document.getElementById("collection-type");
  if (collectionType) {
    collectionType.onchange = function () {
      var type = collectionType.value;
      var uriPrompt = document.getElementById("uri-prompt");
      if (type == "playlist") {
        uriPrompt.classList.remove("hidden");
        uriPrompt.classList.add("block");
      } else {
        uriPrompt.classList.remove("block");
        uriPrompt.classList.add("hidden");
      }
    };
  }

  var globalSearch = document.getElementById("global-search");
  if (globalSearch) {
    globalSearch.oninput = function (e) {
      currentSearchQuery = e.target.value.trim().toLowerCase();
      if (curNode) {
        showPlaylist(curNode);
      }
    };
  }

  console.log("Attaching login button listener...");
  var loginButton = document.getElementById("login-button");
  if (loginButton) {
    loginButton.onclick = function () {
      console.log("Login button clicked!");
      authorizeUser();
    };
  }

  document.querySelectorAll(".max-shown").forEach(function (el) {
    el.textContent = maxTracksShown;
  });
  document.querySelectorAll(".work").forEach(function (el) {
    el.classList.add("hidden");
    el.classList.remove("flex");
  });

  function showSelectionUI() {
    var loginState = document.getElementById("login-state");
    if (loginState) loginState.style.display = "none";

    var selectionState = document.getElementById("selection-state");
    if (selectionState) {
      selectionState.classList.remove("hidden");
      selectionState.style.display = "block";
    }

    // Hide sidebar and toggle button on home screen
    var sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.classList.add("hidden");
      sidebar.classList.remove("md:block", "md:flex", "flex");
      sidebar.style.setProperty("display", "none", "important");
    }
    var toggleSidebarBtn = document.getElementById("toggle-sidebar");
    if (toggleSidebarBtn) {
      toggleSidebarBtn.classList.add("hidden");
      toggleSidebarBtn.classList.remove("md:flex");
    }

    var mainWrapper = document.getElementById("main-wrapper");
    if (mainWrapper) {
      mainWrapper.classList.add("hidden");
      mainWrapper.classList.remove("flex");
      mainWrapper.style.setProperty("display", "none", "important");
    }

    thePlot = document.getElementById("the-plot");

    var stopLoadingBtn = document.getElementById("stop-loading");
    if (stopLoadingBtn)
      stopLoadingBtn.onclick = function () {
        stopLoading();
      };

    // Native inline edit for playlist name
    initNativePlaylistEdit();

    var saveBtn = document.getElementById("save-button");
    if (saveBtn)
      saveBtn.onclick = function () {
        savePlaylist();
      };

    // Native Tabs setup
    initNativeTabs();

    // google.charts.load("current", { packages: ["table"] });
    // google.charts.setOnLoadCallback(initTables);
    initTables();
    initPlot();

    function initTables() {
      // Tables are now handled by React
      theTrackTable = {
        getContainer: function () {
          return document.getElementById("gthe-track-table");
        },
        draw: function () { },
        currentPage: 0,
        totalRows: 0,
      };
      theStagingTable = {
        getContainer: function () {
          return document.getElementById("gthe-staging-table");
        },
        draw: function () { },
        currentPage: 0,
        totalRows: 0,
      };
    }

    fetchCurrentUserProfile()
      .then(function (user) {
        if (user) {
          curUserID = user.id;
          renderLoggedInEmail(user);
        }
      })
      .catch(function (err) {
        console.error("Failed to fetch user profile", err);
        renderLoggedInEmail(null);
      });
  }

  if (authError) {
    error(
      "Sorry, I can't read your music collection from Spotify without authorization",
    );
    var loginState = document.getElementById("login-state");
    if (loginState) loginState.style.display = "block";
    var selectionState = document.getElementById("selection-state");
    if (selectionState) selectionState.style.display = "none";
  } else if (code) {
    window.history.replaceState({}, document.title, window.location.pathname);
    exchangeCodeForToken(code)
      .then(function () {
        showSelectionUI();
      })
      .catch(function (err) {
        console.error("Exchange failed", err);
        error("Failed to exchange authorization code for token");
        var loginState = document.getElementById("login-state");
        if (loginState) loginState.style.display = "block";
        var selectionState = document.getElementById("selection-state");
        if (selectionState) selectionState.style.display = "none";
      });
  } else {
    var storedRefreshToken = window.localStorage.getItem(
      REFRESH_TOKEN_STORAGE_KEY,
    );
    if (storedRefreshToken) {
      refreshAccessToken()
        .then(function () {
          showSelectionUI();
        })
        .catch(function (err) {
          console.error("Refresh failed", err);
          var loginState = document.getElementById("login-state");
          if (loginState) loginState.style.display = "block";
          var selectionState = document.getElementById("selection-state");
          if (selectionState) selectionState.style.display = "none";
        });
    } else {
      var loginState = document.getElementById("login-state");
      if (loginState) loginState.style.display = "block";
      var selectionState = document.getElementById("selection-state");
      if (selectionState) selectionState.style.display = "none";
    }
  }

  var goButton = document.getElementById("go");
  if (goButton) {
    goButton.onclick = function () {
      go();
    };
  }
});

function initNativePlaylistEdit() {
  var el = document.getElementById("staging-playlist-name");
  if (!el) return;
  el.onclick = function (e) {
    e.preventDefault();
    var currentName = el.textContent.trim();
    var input = document.createElement("input");
    input.type = "text";
    input.value = currentName;
    input.className =
      "text-4xl font-black text-white bg-transparent border-b-2 border-spotify-green outline-none w-full";

    var originalDisplay = el.style.display;
    el.style.display = "none";
    el.parentNode.insertBefore(input, el);
    input.focus();

    function finishEdit() {
      var newName = input.value.trim() || currentName;
      el.textContent = newName;
      input.remove();
      el.style.display = originalDisplay;
    }

    input.onblur = finishEdit;
    input.onkeydown = function (ev) {
      if (ev.key === "Enter") finishEdit();
      if (ev.key === "Escape") {
        input.value = currentName;
        finishEdit();
      }
    };
  };
}

function initNativeTabs() {
  var tabLinks = document.querySelectorAll("ul.nav-tabs a");
  tabLinks.forEach(function (link) {
    link.onclick = function (e) {
      e.preventDefault();
      var targetId = link.getAttribute("href");
      showTab(targetId);
    };
  });
}

function showTab(selector) {
  // selector can be #the-track-list-tab, #the-plots-tab, #staging-tab
  var targetId = selector.replace("-tab", "");
  var tabs = ["#the-track-list", "#the-plots", "#staging"];

  tabs.forEach(function (tabId) {
    var tabLinkElem = document.getElementById(tabId.substring(1) + "-tab");
    var tabPanel = document.getElementById(tabId.substring(1));

    if (tabId === targetId) {
      if (tabLinkElem) {
        var parentLi = tabLinkElem.closest("li");
        if (parentLi) parentLi.classList.add("active");
        tabLinkElem.classList.add("active");
      }
      if (tabPanel) tabPanel.classList.add("active", "in");
    } else {
      if (tabLinkElem) {
        var parentLi = tabLinkElem.closest("li");
        if (parentLi) parentLi.classList.remove("active");
        tabLinkElem.classList.remove("active");
      }
      if (tabPanel) tabPanel.classList.remove("active", "in");
    }
  });

  if (targetId === "#the-plots") {
    stagingIsVisible = false;
    redrawPlot();
  } else if (targetId === "#staging") {
    stagingIsVisible = true;
    showStagingList();
  } else {
    stagingIsVisible = false;
  }
}

function saveTrack(track) {
  return;
}
function loadTrack(id) {
  return null;
}
