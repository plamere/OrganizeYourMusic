"use strict";
var accessToken = null;
var curUserID = null;
var curTracks = {};
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
var audio = $("<audio>");
var nowPlaying = null;
var curNode = null;
var abortLoading = false;

var progressBar = $("#progress-bar");

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
var maxTracksShown = 5000;
var defaultTablePageSize = 200;
var cachePrefix = "omy-cache-v4:";
var legacyCachePrefixes = ["omy-cache-v3:", "omy-cache-v2:", "omy-cache-v1:"];
var pendingRestoreInfo = null;
var pendingFetchStarter = null;
var sidebarExpanded = true;

// NEW: Global search state
var currentSearchQuery = "";

RSVP.on("error", function (reason) {
    console.error("Unhandled RSVP error:", reason);
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

    var msg = payload && payload.error && payload.error.message;
    if (!msg && payload && typeof payload.error === "string") {
        msg = payload.error;
    }

    if (!msg) {
        return false;
    }

    var lower = String(msg).toLowerCase();
    return lower.indexOf("insufficient") !== -1 && lower.indexOf("scope") !== -1;
}

function restartAuthorization(message) {
    if (message) {
        error(message);
    }

    accessToken = null;
    window.localStorage.removeItem("refresh_token");
    go();
}

var theWorld = [
    { name: "Genres", nodes: [] },
    {
        name: "Moods",
        nodes: [
            makeNode("(unclassified mood)", "popularity", featMissingFilter("energy"), featGetterInt("popularity"), featSorter("popularity", true), true),
            makeNode("chill", "energy", featMusicFilter("energy", 0, 0.2), featGetterPercent("energy"), featSorter("energy", false), true),
            makeNode("amped", "energy", featMusicFilter("energy", 0.8, 1.0), featGetterPercent("energy"), featSorter("energy", true), true),
            makeNode("sad", "sadness", featMusicFilter("sadness", 0.8, 1.0), featGetterPercent("sadness"), featSorter("sadness", true), true),
            makeNode("anger", "anger", featMusicFilter("anger", 0.8, 1.0), featGetterPercent("anger"), featSorter("anger", true), true),
            makeNode("happy", "happiness", featMusicFilter("happiness", 0.8, 1.0), featGetterPercent("happiness"), featSorter("happiness", true), true),
            makeNode("danceable", "danceability", featMusicFilter("danceability", 0.8, 1.0), featGetterPercent("danceability"), featSorter("danceability", true), true),
        ],
    },
    {
        name: "Styles",
        nodes: [
            makeNode("instrumental", "instrumentalness", featMusicFilter("instrumentalness", 0.8, 1.0), featGetterPercent("instrumentalness"), featSorter("instrumentalness", true), true),
            makeNode("acoustic", "acousticness", featMusicFilter("acousticness", 0.8, 1.0), featGetterPercent("acousticness"), featSorter("acousticness", true), true),
            makeNode("live", "liveness", featMusicFilter("liveness", 0.85, 1.0), featGetterPercent("liveness"), featSorter("liveness", true), true),
            makeNode("spoken word", "speechiness", featFilter("speechiness", 0.85, 1.0), featGetterPercent("speechiness"), featSorter("speechiness", true), true),
            makeNode("clean", "explicit", featBoolFilter("explicit", false), featGetterBool("explicit", "explicit", "clean"), featSorter("explicit", true), false),
            makeNode("explicit", "explicit", featBoolFilter("explicit", true), featGetterBool("explicit", "explicit", "clean"), featSorter("explicit", true), false),
            makeNode("loud", "loudness (dB)", featMusicFilter("loudness", -5, 0), featGetterInt("loudness"), featSorter("loudness", true), true),
            makeNode("quiet", "loudness (dB)", featMusicFilter("loudness", -60, -10), featGetterInt("loudness"), featSorter("loudness", false), true),
        ],
    },
    {
        name: "Decades",
        nodes: [
            makeNode("Oldies", "year", featFilter("year", 0, 1950), featGetter("year"), featSorter("year", false), true),
            makeNode("1950s", "year", featFilter("year", 1950, 1959), featGetter("year"), featSorter("year", false), true),
            makeNode("1960s", "year", featFilter("year", 1960, 1969), featGetter("year"), featSorter("year", false), true),
            makeNode("1970s", "year", featFilter("year", 1970, 1979), featGetter("year"), featSorter("year", false), true),
            makeNode("1980s", "year", featFilter("year", 1980, 1989), featGetter("year"), featSorter("year", false), true),
            makeNode("1990s", "year", featFilter("year", 1990, 1999), featGetter("year"), featSorter("year", false), true),
            makeNode("2000s", "year", featFilter("year", 2000, 2009), featGetter("year"), featSorter("year", false), true),
            makeNode("2010s", "year", featFilter("year", 2010, 2019), featGetter("year"), featSorter("year", false), true),
            makeNode("2020s", "year", featFilter("year", 2020, 2029), featGetter("year"), featSorter("year", false), true),
            makeNode("Now", "year", featFilter("year", 2016, 2020), featGetter("year"), featSorter("year", false), true),
            makeNode("(unclassified year)", "year", featFilter("year", -1, 0), featGetter("year"), featSorter("year", false), false),
        ],
    },
    {
        name: "Added",
        nodes: [
            makeNode("Today", "age (days)", featFilter("age", 0, 1), featGetterInt("age"), featSorter("age", false), true),
            makeNode("In the last week", "age (days)", featFilter("age", 0, 7), featGetterInt("age"), featSorter("age", false), true),
            makeNode("In the last month", "age (days)", featFilter("age", 0, 30), featGetterInt("age"), featSorter("age", false), true),
            makeNode("In the last year", "age (days)", featFilter("age", 0, 365), featGetterInt("age"), featSorter("age", false), true),
            makeNode("Over a year ago", "age (days)", featFilter("age", 356, 365 * 100), featGetterInt("age"), featSorter("age", false), true),
            makeNode("Over 2 years ago", "age (days)", featFilter("age", 356 * 2, 365 * 100), featGetterInt("age"), featSorter("age", false), true),
            makeNode("Over 5 years ago", "age (days)", featFilter("age", 356 * 5, 365 * 100), featGetterInt("age"), featSorter("age", false), true),
            makeNode("Whenever", "age (days)", featFilter("age", 0, 365 * 100), featGetterInt("age"), featSorter("age", false), true),
        ],
    },
    {
        name: "Popularity",
        nodes: [
            makeNode("top popular", "Popularity", featFilter("popularity", 75, 100), featGetter("popularity"), featSorter("popularity", true), true),
            makeNode("very popular", "Popularity", featFilter("popularity", 50, 75), featGetter("popularity"), featSorter("popularity", true), true),
            makeNode("somewhat popular", "Popularity", featFilter("popularity", 20, 50), featGetter("popularity"), featSorter("popularity", true), true),
            makeNode("deep", "Popularity", featFilter("popularity", 0, 20), featGetter("popularity"), featSorter("popularity", true), true),
        ],
    },
    {
        name: "Duration",
        nodes: [
            makeNode("Very very short", "Duration", featFilter("duration_ms", mins(0), mins(0.5)), featGetter("duration_ms"), featSorter("duration_ms", false), true),
            makeNode("Very short", "Duration", featFilter("duration_ms", mins(0), mins(1.5)), featGetter("duration_ms"), featSorter("duration_ms", false), true),
            makeNode("Short", "Duration", featFilter("duration_ms", mins(0), mins(3)), featGetter("duration_ms"), featSorter("duration_ms", false), true),
            makeNode("Medium", "Duration", featFilter("duration_ms", mins(3), mins(6)), featGetter("duration_ms"), featSorter("duration_ms", false), true),
            makeNode("Long", "Duration", featFilter("duration_ms", mins(6), mins(1000)), featGetter("duration_ms"), featSorter("duration_ms", false), true),
            makeNode("Very long", "Duration", featFilter("duration_ms", mins(12), mins(1000)), featGetter("duration_ms"), featSorter("duration_ms", false), true),
            makeNode("Very very long", "Duration", featFilter("duration_ms", mins(30), mins(1000)), featGetter("duration_ms"), featSorter("duration_ms", false), true),
        ],
    },
    { name: "Sources", nodes: [] },
    {
        name: "All Results",
        nodes: [
            makeNode("All results", "All results", function (track) { return true; }, featGetter("popularity"), featSorter("popularity", true), false),
        ],
    },
];

function mins(min) { return min * 60 * 1000; }
function now() { return new Date().getTime(); }

function updateFavs() {
    if (theWorld[genreIndex].nodes.length > 0 && topArtistName && topTrackName) {
        var favGenre = theWorld[genreIndex].nodes[0].name;
        $("#fav-genre").text(favGenre);
        $("#fav-artist").text(topArtistName);
        $("#fav-song").text(topTrackName);
        $("#favs").removeClass("hidden").addClass("block");
    }
}

function refreshHeader() {
    var ntracks = Object.keys(curTracks).length;
    var nArtists = Object.keys(curArtists).length;
    if (totalPlaylists > 0) {
        linfo("Found " + ntracks + " unique tracks by " + nArtists + " artists in " + processedPlaylists + " of " + totalPlaylists + " playlists");
        var progress = (processedPlaylists * 100) / totalPlaylists;
        setProgress(progress);
    } else {
        if (totalTracks > 0) {
            var progress = (ntracks * 100) / totalTracks;
            setProgress(progress);
        }
        linfo("Found " + ntracks + " tracks by " + nArtists + " artists in your collection.");
    }
}

function addTracks(tracks) {
    _.each(tracks, function (track) {
        var genres = getGenresForTrack(track);
        track.feats.genres = new Set();
        track.feats.topGenre = "";
        _.each(genres, function (genre) {
            if (isGoodGenre(genre)) {
                track.feats.genres.add(genre);
                if (track.feats.topGenre.length == 0 && genre !== "(unclassified genre)") {
                    track.feats.topGenre = genre;
                }
                if (!(genre in nodeMap)) {
                    var node = makeNode(genre, "Genre", featGenreFilter(genre), featGenreGetter(genre), featSorter("popularity", true), false);
                    theWorld[genreIndex].nodes.push(node);
                }
                if (!(track.feats.source in nodeMap)) {
                    var node = makeNode(track.feats.source, "Source", featSourceFilter(track.feats.source), featSourceGetter(track.feats.source), featSorter("popularity", true), false);
                    theWorld[sourceIndex].nodes.push(node);
                }
            }
        });
        track.feats.year = getYearForTrack(track);
    });
}

function filterTracks(tracks) {
    _.each(theWorld, function (bin) {
        _.each(bin.nodes, function (node) {
            _.each(applyFilter(tracks, node.filter), function (track) {
                node.tracks.push(track);
                node.artists.add(track.details.artists[0].id);
            });
        });
    });
    _.each(tracks, function (track) { saveTrack(track); });
}

var totRefresh = 0;

function refreshTheWorld(quick) {
    var start = now();
    updateViewOfTheWorld(quick);
    var delta = now() - start;
    totRefresh += delta;
}

function playlistSubtitle(s) { $("#playlist-sub-title").text(s); }
function playlistTitle(s) { $("#playlist-title").text(s); }

var curPlottingNodes = {};
var curPlottingNames = [];

function getPlotData(node) {
    var xDataName = $("#select-xaxis").val();
    var yDataName = $("#select-yaxis").val();

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

    _.each(node.tracks, function (track) {
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
    var sizeDataName = $("#select-size").val();
    var sizeInfo = plottableData[sizeDataName];
    var minWidth = 4;
    var maxWidth = 12;
    var minSize = sizeInfo.min;
    var maxSize = sizeInfo.max;
    var out = [];
    var range = maxSize - minSize;
    var orange = maxWidth - minWidth;
    _.each(tracks, function (track) {
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
    var xDataName = $("#select-xaxis").val();
    var yDataName = $("#select-yaxis").val();
    var plotHost = $("#the-plot").parent();
    var xMargin = 16;
    var yMargin = 180;
    var yFooter = 24;
    var minHeight = 420;
    var minWidth = 300;

    var width = plotHost.innerWidth() - xMargin;
    if (width < minWidth) width = minWidth;
    var controlsHeight = $("#plot-controls").outerHeight(true) || 0;
    var tabsHeight = $("#exTab3 > ul.nav").outerHeight(true) || 0;
    var height = $(window).height() - yMargin - yFooter - controlsHeight - tabsHeight;
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
    _.each(curPlottingNodes, function (node, name) {
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
        _.each(data.points, function (point) {
            var plotName = curPlottingNames[point.curveNumber];
            var track = curPlottingNodes[plotName].tracks[point.pointNumber];
            trackList.push(track);
            curSelected.add(track.id);
        });
        $(".nstaging-tracks").text(curSelected.size);
        info("selected " + trackList.length + " tracks");
    });
}

function clearPlot() {
    curPlottingNodes = {};
    redrawPlot();
}

function showPlaylist(node) {
    if (theTrackTable == null) return;

    if (stagingIsVisible) {
        $("#the-track-list-tab").tab("show");
    }
    curNode = node;

    var displayTracks = currentSearchQuery.trim() !== "" ? getGlobalSearchTracks(currentSearchQuery) : node.tracks;
    var isSearching = currentSearchQuery.trim() !== "";

    var nTracks = displayTracks.length;
    var nArtists = new Set(displayTracks.map(function (t) { return t.details.artists[0].id; })).size;

    if (isSearching) {
        playlistTitle("Search results");
        playlistSubtitle("Search Results: " + nTracks + " tracks / " + nArtists + " artists");
    } else {
        if (node.name == "All results") playlistTitle("All results in this collection");
        else playlistTitle("Your " + uname(node.name) + " tracks");
        playlistSubtitle(nTracks + " tracks / " + nArtists + " artists");
    }

    $("#tbl-param").text(node.label);
    if (displayTracks.length === 0) {
        $("#track-table-shell").addClass("hidden");
        $("#track-table-empty").removeClass("hidden").addClass("flex");
        $("#gthe-track-table-truncated").removeClass("block").addClass("hidden");
        return;
    }

    $("#track-table-empty").removeClass("flex").addClass("hidden");
    $("#track-table-shell").removeClass("hidden");

    if (displayTracks.length > maxTracksShown) {
        $("#gthe-track-table-truncated").removeClass("hidden").addClass("block");
    } else {
        $("#gthe-track-table-truncated").removeClass("block").addClass("hidden");
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

    return _.filter(curTracks, function (track) {
        var trackName = (track.details.name || "").toLowerCase();
        var artistNames = _.map(track.details.artists || [], function (artist) {
            return (artist.name || "").toLowerCase();
        });
        var artistGenres = _.map(track.details.artists || [], function (artist) {
            var artistInfo = curArtists[artist.id];
            return artistInfo && artistInfo.genres ? artistInfo.genres : [];
        });
        var albumInfo = curAlbums[track.details.album_id] || {};
        var albumName = (albumInfo.name || "").toLowerCase();
        var albumGenres = _.map(albumInfo.genres || [], function (genre) {
            return (genre || "").toLowerCase();
        });
        var trackGenres = _.map(Array.from(track.feats.genres || []), function (genre) {
            return (genre || "").toLowerCase();
        });
        var sourceName = (track.feats.source || "").toLowerCase();
        var topGenre = (track.feats.topGenre || "").toLowerCase();
        if (trackName.includes(searchQuery) || albumName.includes(searchQuery) || sourceName.includes(searchQuery) || topGenre.includes(searchQuery)) return true;
        return _.some(artistNames, function (artistName) {
            return artistName.includes(searchQuery);
        }) || _.some(albumGenres, function (genre) {
            return genre.includes(searchQuery);
        }) || _.some(trackGenres, function (genre) {
            return genre.includes(searchQuery);
        }) || _.some(_.flatten(artistGenres), function (genre) {
            return (genre || "").toLowerCase().includes(searchQuery);
        });
    });
}

function showStagingList() {
    if (theStagingTable == null) return;

    curSelectedTracks = [];
    curSelected.forEach(function (tid) {
        curSelectedTracks.push(curTracks[tid]);
    });
    if (curSelectedTracks.length > 0) {
        $("#staging-full").removeClass("hidden").addClass("block");
        $("#staging-empty").removeClass("block").addClass("hidden");
    } else {
        $("#staging-full").removeClass("block").addClass("hidden");
        $("#staging-empty").removeClass("hidden").addClass("block");
    }
    if (curSelectedTracks.length > maxTracksShown) {
        $("#gthe-staging-table-truncated").removeClass("hidden").addClass("block");
    } else {
        $("#gthe-staging-table-truncated").removeClass("block").addClass("hidden");
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
    var sortInfo = theStagingTable.getSortInfo();
    var out = [];

    if (sortInfo.sortedIndexes) {
        _.each(sortInfo.sortedIndexes, function (idx) {
            var track = curSelectedTracks[idx];
            if (curSelected.has(track.id)) out.push(track);
        });
    } else {
        _.each(curSelectedTracks, function (track) {
            if (curSelected.has(track.id)) out.push(track);
        });
    }
    return out;
}

function getInt(val) { return Math.round(val); }
function getString(val) { return val.toString(); }
function getDate(val) { return val.format("YYYY‑MM‑DD"); }
function getPercent(val) { return getInt(val * 100); }
function getDuration(val) { return getInt(val / 1000); }

function showTracksInTable(table, tracks, getter, label, isStagingList) {
    tracks = tracks || [];

    // Store current tracks onto the table object so selectAllHandler can access them
    table.currentTracks = tracks;

    var data = new google.visualization.DataTable();
    data.addColumn("string", "Select");
    data.addColumn("string", "");
    data.addColumn("string", "Title");
    data.addColumn("string", "Artist");
    data.addColumn("string", "Top Genre");
    data.addColumn("string", "Year");
    data.addColumn("string", "Added");
    data.addColumn("number", "BPM");
    data.addColumn("number", "Energy");
    data.addColumn("number", "Danceability");
    data.addColumn("number", "Loudness");
    data.addColumn("number", "Liveness");
    data.addColumn("number", "Valence");
    data.addColumn("number", "Duration");
    data.addColumn("number", "Acousticness");
    data.addColumn("number", "Speechiness");
    data.addColumn("number", "Popularity");

    data.setColumnProperty(0, { allowHTML: true });
    data.setColumnProperty(1, { allowHTML: true });

    var rows = [];
    _.each(tracks, function (track, i) {
        if (i >= maxTracksShown) return;

        var sel = $("<input class='track-select w-4 h-4 text-spotify-green bg-spotify-elevated border-spotify-highlight rounded focus:ring-spotify-green focus:ring-2'>")
            .attr("type", "checkbox")
            .attr("id", "sel-" + track.id)
            .attr("title", "select to add this track to the staging list");

        if (curSelected.has(track.id)) {
            sel.prop("checked", true);
        }

        var play;
        if (track.details.preview_url != null) {
            play = $("<span class='track-play fa fa-play text-zinc-400 hover:text-white cursor-pointer'>");
            play.attr("id", "play-" + track.id);
        } else {
            play = $("<span>");
        }

        var row = [];
        row.push(sel.prop("outerHTML"));
        row.push(play.prop("outerHTML"));
        row.push(track.details.name);
        row.push(track.details.artists[0].name);
        row.push(track.feats.topGenre);
        row.push(getString(track.feats.year));
        row.push(getDate(track.feats.date_added));
        row.push(getInt(track.feats.tempo));
        row.push(getPercent(track.feats.energy));
        row.push(getPercent(track.feats.danceability));
        row.push(getInt(track.feats.loudness));
        row.push(getPercent(track.feats.liveness));
        row.push(getPercent(track.feats.valence));
        row.push(getDuration(track.feats.duration_ms));
        row.push(getPercent(track.feats.acousticness));
        row.push(getPercent(track.feats.speechiness));
        row.push(getInt(track.feats.popularity));
        rows.push(row);
    });
    data.addRows(rows);

    var currentPage = table.currentPage || 0;
    var maxPage = Math.max(Math.ceil(rows.length / defaultTablePageSize) - 1, 0);
    if (currentPage > maxPage) currentPage = maxPage;

    table.draw(data, {
        showRowNumber: true,
        width: "100%",
        page: "enable",
        pageSize: defaultTablePageSize,
        startPage: currentPage,
        allowHtml: true,
        cssClassNames: {
            headerRow: "headerRow",
            tableCell: "track-table-cell",
            headerCell: "track-header-cell",
        },
    });
    table.currentPage = currentPage;
    table.data = data;
    enhancePagerUI(table);
    addEventHandlers($(table.getContainer()));
}

function enhancePagerUI(table) {
    var container = $(table.getContainer());
    var pager = container.find(".google-visualization-table-div-page");
    if (pager.length === 0) return;

    function iconize(selector, iconClass, label) {
        pager.find(selector).each(function () {
            var elem = $(this);
            var control = elem;
            if (!elem.is("a,button,input,[role='button']")) {
                var inner = elem.find("a,button,input,[role='button']").first();
                if (inner.length > 0) {
                    control = inner;
                }
            }

            elem.addClass("pager-shell");
            control.attr("title", label);
            control.attr("aria-label", label);
            control.addClass("pager-arrow pager-control");
            control.html("<i class='fa " + iconClass + "' aria-hidden='true'></i>");
        });
    }

    iconize(".google-visualization-table-first-page, .google-visualization-table-page-first", "fa-angle-double-left", "First page");
    iconize(".google-visualization-table-prev-page, .google-visualization-table-page-prev", "fa-angle-left", "Previous page");
    iconize(".google-visualization-table-next-page, .google-visualization-table-page-next", "fa-angle-right", "Next page");
    iconize(".google-visualization-table-last-page, .google-visualization-table-page-last", "fa-angle-double-right", "Last page");
}

function addEventHandlers(tableContainer) {
    $(".track-select").off("change");
    $(".track-play").off("click");

    $(".track-select").each(function () {
        var tid = getTidFromElemId($(this).attr("id"));
        if (curSelected.has(tid)) {
            $(this).prop("checked", true);
        } else {
            $(this).prop("checked", false);
        }
    });

    $(".track-select").on("change", function (e) {
        var tid = getTidFromElemId(e.target.id);
        if ($(e.target).is(":checked")) {
            curSelected.add(tid);
        } else {
            curSelected.delete(tid);
        }
        e.stopPropagation();
        $(".nstaging-tracks").text(curSelected.size);
        return false;
    });

    $(".track-play").each(function () {
        var tid = getTidFromElemId($(this).attr("id"));
        var track = curTracks[tid];
        if (isPlaying(track)) {
            $(this).addClass("fa-pause text-spotify-green").removeClass("fa-play text-zinc-400");
        }
    });

    $(".track-play").on("click", function (e) {
        var tid = getTidFromElemId(e.target.id);
        var elem = $(e.target);
        var track = curTracks[tid];

        $(".track-play").removeClass("fa-pause text-spotify-green").addClass("fa-play text-zinc-400");
        if (isPlaying(track)) {
            stopTrack(track);
        } else {
            elem.removeClass("fa-play text-zinc-400").addClass("fa-pause text-spotify-green");
            playTrack(track);
        }
        e.stopPropagation();
        return false;
    });
}

function getTidFromElemId(elemId) { return elemId.split("-")[1]; }

function saveTracksToPlaylist(playlist, inputTracks) {
    var tracks = inputTracks.slice();
    function saveTracks() {
        var uris = [];
        while (tracks.length > 0 && uris.length < 100) {
            var track = tracks.shift();
            uris.push(track.details.uri);
        }

        var url = "https://api.spotify.com/v1/users/" + curUserID + "/playlists/" + playlist.id + "/tracks";
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
    var node = { name: name, label: label, plottable: plottable, tracks: [], artists: new Set(), filter: filter, getter: getter, sorter: sorter };
    nodeMap[name] = node;
    return node;
}

function savePlaylist() {
    var curTracks = getStagingTracks();
    if (curTracks.length > 0) {
        var name = $("#staging-playlist-name").text();
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
    $(".playlist-list").slideUp(200);
    $("#sidebar h4 i").removeClass("fa-chevron-up").addClass("fa-chevron-down");
    updateSidebarToggleButton();
}

function expandAllSidebar() {
    sidebarExpanded = true;
    $(".playlist-list").slideDown(200);
    $("#sidebar h4 i").removeClass("fa-chevron-down").addClass("fa-chevron-up");
    updateSidebarToggleButton();
}

function toggleSidebarSections() {
    if (sidebarExpanded) collapseAllSidebar();
    else expandAllSidebar();
}

function updateSidebarToggleButton() {
    var button = $("#sidebar-toggle-btn");
    if (button.length == 0) return;
    var icon = button.find("i");
    if (sidebarExpanded) {
        icon.removeClass("fa-angle-double-down").addClass("fa-angle-double-up");
        button.attr("title", "Collapse all categories");
        button.attr("aria-label", "Collapse all categories");
    } else {
        icon.removeClass("fa-angle-double-up").addClass("fa-angle-double-down");
        button.attr("title", "Expand all categories");
        button.attr("aria-label", "Expand all categories");
    }
}

function updateViewOfTheWorld(quick) {
    var minTracksForSection = 3;
    var sidebar = $("#sidebar");
    sidebar.empty();
    var first = true;

    updateFavs();
    var renderWorld = theWorld.slice();
    if (renderWorld.length > 0) {
        renderWorld = [renderWorld[renderWorld.length - 1]].concat(renderWorld.slice(0, renderWorld.length - 1));
    }

    var sidebarControls = $("<div class='mb-4 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/20 px-3 py-3'></div>");
    sidebarControls.append($("<div class='min-w-0'></div>").append($("<div class='text-xs font-bold uppercase tracking-wider text-zinc-400'>Library bins</div>").append($("<div class='text-[11px] text-zinc-500'>Top result first, categories below.</div>"))));
    var toggleButton = $("<button type='button' id='sidebar-toggle-btn' class='inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-spotify-green hover:text-spotify-green'></button>");
    toggleButton.append($("<i class='fa fa-angle-double-up text-xs'></i>"));
    toggleButton.on("click", function () { toggleSidebarSections(); });
    sidebarControls.append(toggleButton);
    sidebar.append(sidebarControls);

    _.each(renderWorld, function (bin) {
        var nodes = sortedNodes(bin.nodes);

        var head = $("<h4>")
            .text(uname(bin.name))
            .addClass("mt-4 mb-2 pb-1 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400 cursor-pointer hover:text-white flex justify-between items-center transition-colors");
        head.append($("<i class='fa fa-chevron-down text-zinc-500 text-[10px] transition-transform duration-200'></i>"));
        sidebar.append(head);

        var ul = $("<ul class='playlist-list'>");
        ul.attr("id", nname(bin.name));
        sidebar.append(ul);

        head.on("click", function () {
            ul.slideToggle(200);
            $(this).find("i").toggleClass("fa-chevron-down fa-chevron-up");
        });

        _.each(nodes, function (node) {
            node.tracks = node.sorter(node.tracks);
            var tracks = node.tracks;
            if (tracks.length >= minTracksForSection) {
                var header = $("<li>")
                    .text(uname(node.name))
                    .addClass("py-1 px-2 text-sm text-zinc-300 cursor-pointer hover:text-white hover:bg-[#3E3E3E] rounded transition-colors duration-150 flex justify-between items-center");
                var stats = $("<span class='stats text-xs text-zinc-500 ml-2'>").text("(" + tracks.length + ")");
                header.append(stats);
                if (!quick) {
                    header.on("click", function () {
                        plotPlaylist(node);
                        showPlaylist(node);
                    });
                    if (first) {
                        first = false;
                        showPlaylist(node);
                        plotPlaylist(node);
                    }
                }
                ul.append(header);
            }
        });

        if (!sidebarExpanded) {
            ul.hide();
            head.find("i").removeClass("fa-chevron-up").addClass("fa-chevron-down");
        }
    });

    updateSidebarToggleButton();
    persistCurrentCollection();
}

var plottableData = {
    energy: { name: "energy", min: 0, max: 1, getter: featGetterPercent("energy") },
    danceability: { name: "danceability", min: 0, max: 1, getter: featGetterPercent("danceability") },
    valence: { name: "valence", min: 0, max: 1, getter: featGetterPercent("valence") },
    duration: { name: "duration", min: 0, max: 1500, getter: featGetter("duration") },
    tempo: { name: "tempo", min: 40, max: 240, getter: featGetter("tempo") },
    anger: { name: "anger", min: 0, max: 1, getter: featGetterPercent("anger") },
    happiness: { name: "happiness", min: 0, max: 1, getter: featGetterPercent("happiness") },
    loudness: { name: "loudness", min: -30, max: 0, getter: featGetter("loudness") },
    acousticness: { name: "acousticness", min: 0, max: 1, getter: featGetterPercent("acousticness") },
    liveness: { name: "live", min: 0, max: 1, getter: featGetterPercent("liveness") },
    speechiness: { name: "speechiness", min: 0, max: 1, getter: featGetterPercent("speechiness") },
    popularity: { name: "popularity", min: 0, max: 100, getter: featGetter("popularity") },
    age: { min: 0, max: 5000, name: "days-since-added", getter: featGetter("age") },
    year: { min: 1950, max: 2020, name: "release-year", getter: featGetter("year") },
};

function addPlotSelect(elem, defaultValue) {
    elem.empty();
    var keys = Object.keys(plottableData);
    keys.sort();
    _.each(keys, function (key) {
        var param = plottableData[key];
        var option = $("<option>");
        option.text(param.name);
        option.attr("value", key);
        elem.append(option);
    });
    elem.val(defaultValue);
    elem.on("change", redrawPlot);
}

function nname(s) { return s.replace(/ /g, "_"); }
function uname(s) { return s.replace(/_/g, " "); }

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

function featGenreFilter(genre) { return function (track) { return track.feats.genres.has(genre); }; }
function featGenreGetter(genre) { return function (track) { var glist = Array.from(track.feats.genres); return glist.join(", "); }; }
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

function featSourceFilter(source) { return function (track) { return track.feats.source == source; }; }
function featSourceGetter(source) { return function (track) { return track.feats.source; }; }

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

function featGetter(param) { return function (track) { return track.feats[param]; }; }
function featGetterInt(param) { return function (track) { return Math.round(track.feats[param]); }; }
function featGetterPercent(param) { return function (track) { return Math.round(100 * track.feats[param]); }; }
function featGetterBool(param, true_val, false_val) { return function (track) { return track.feats[param] ? true_val : false_val; }; }
function featBoolFilter(param, state) { return function (track) { return "feats" in track && track.feats[param] == state; }; }
function featMusicFilter(param, low, high) {
    return function (track) {
        return ("feats" in track && track.feats.speechiness < 0.8 && track.feats[param] >= low && track.feats[param] <= high);
    };
}
function featMissingFilter(param) { return function (track) { return !("energy" in track.feats); }; }
function featFilter(param, low, high) {
    return function (track) {
        return ("feats" in track && track.feats[param] >= low && track.feats[param] <= high);
    };
}

function applyFilter(tracks, filt) {
    var out = [];
    _.each(tracks, function (track) { if (filt(track)) out.push(track); });
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
        _.each(album.genres, function (g) { genres.push(g); });
    }

    _.each(track.details.artists, function (artist) {
        if (artist.id in curArtists) {
            var detailedArtist = curArtists[artist.id];
            _.each(detailedArtist.genres, function (genre) { genres.push(genre); });
        }
    });
    if (genres.length == 0) genres.push("(unclassified genre)");
    return genres;
}

function isGoodGenre(genre) {
    var lgenre = genre.toLowerCase();
    for (var i = 0; i < skipGenrePhrases.length; i++) {
        var phrase = skipGenrePhrases[i];
        if (lgenre.indexOf(phrase) != -1) return false;
    }
    return true;
}

function error(msg) { info(msg); }
function info(msg) { $("#info").text(msg); }
function linfo(msg) { $("#linfo").text(msg); }

function generateRandomString(length) {
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
        .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function authorizeUser() {
    var scopes = "user-library-read playlist-read-private playlist-read-collaborative playlist-modify-public";
    var codeVerifier = generateRandomString(64);
    window.localStorage.setItem("code_verifier", codeVerifier);

    var hashed = await sha256(codeVerifier);
    var codeChallenge = base64encode(hashed);

    var authUrl = "https://accounts.spotify.com/authorize?" +
        "client_id=" + encodeURIComponent(SPOTIFY_CLIENT_ID) +
        "&response_type=code&show_dialog=false&scope=" + encodeURIComponent(scopes) +
        "&redirect_uri=" + encodeURIComponent(SPOTIFY_REDIRECT_URI) +
        "&code_challenge_method=S256&code_challenge=" + encodeURIComponent(codeChallenge);

    document.location = authUrl;
}

function exchangeCodeForToken(code) {
    var codeVerifier = window.localStorage.getItem("code_verifier");
    return $.ajax("https://accounts.spotify.com/api/token", {
        type: "POST",
        data: $.param({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: "authorization_code",
            code: code,
            redirect_uri: SPOTIFY_REDIRECT_URI,
            code_verifier: codeVerifier,
        }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
}

function refreshAccessToken() {
    var refreshToken = window.localStorage.getItem("refresh_token");
    if (!refreshToken) {
        return RSVP.reject(new Error("Refresh token is missing"));
    }

    return $.ajax("https://accounts.spotify.com/api/token", {
        type: "POST",
        data: $.param({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }).then(function (response) {
        if (response && response.access_token) {
            accessToken = response.access_token;
        }
        return response;
    });
}

function callSpotify(type, url, json, callback) {
    var refreshed = false;

    function doCall() {
        var backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:8000/api/spotify'
            : '/api/spotify';

        $.ajax(backendUrl, {
            type: 'POST',
            data: JSON.stringify({
                url: url,
                method: type,
                data: json,
                accessToken: accessToken
            }),
            dataType: "json",
            contentType: "application/json",
            success: function (r) { callback(true, r); },
            error: function (r) {
                if (r.status === 401 || (r.status === 403 && isSpotifyScopeError(r))) {
                    restartAuthorization("Your Spotify authorization expired or is missing permissions. Please connect again.");
                    return;
                }

                if ((r.status === 401 || r.status === 403) && !refreshed) {
                    refreshed = true;
                    refreshAccessToken().then(function () {
                        doCall();
                    }, function () {
                        restartAuthorization("Your Spotify session expired. Please connect again.");
                    });
                } else if (r.status >= 200 && r.status < 300) callback(true, r);
                else callback(false, r);
            },
        });
    }

    doCall();
}

function getSpotifyP(url, data) {
    return new RSVP.Promise(function (resolve, reject) {
        var curRetry = 0;
        var maxRetries = 10;
        var refreshed = false;
        function go() {
            var backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:8000/api/spotify'
                : '/api/spotify';

            $.ajax(backendUrl, {
                type: 'POST',
                dataType: "json",
                contentType: 'application/json',
                data: JSON.stringify({
                    url: url,
                    data: data,
                    accessToken: accessToken
                }),
                success: function (data) { resolve(data); },
                error: function (jqXHR, textStatus) {
                    if (jqXHR.status >= 200 && jqXHR.status < 300) resolve(jqXHR);
                    else if (jqXHR.status === 401 || (jqXHR.status === 403 && isSpotifyScopeError(jqXHR))) {
                        restartAuthorization("Your Spotify authorization expired or is missing permissions. Please connect again.");
                        reject(textStatus);
                    }
                    else if ((jqXHR.status === 401 || jqXHR.status === 403) && !refreshed) {
                        refreshed = true;
                        refreshAccessToken().then(function () {
                            go();
                        }, function () {
                            restartAuthorization("Your Spotify session expired. Please connect again.");
                            reject(textStatus);
                        });
                    } else if (jqXHR.status == 401) window.location = "index.html";
                    else if (jqXHR.status >= 500 && jqXHR.status < 600) {
                        if (curRetry++ < maxRetries) setTimeout(go, 500);
                        else reject(textStatus + " after " + maxRetries + " retries");
                    } else if (jqXHR.status == 429) {
                        var retry = 2000;
                        var retryAfter = jqXHR.getResponseHeader("Retry-After");
                        if (retryAfter) retry = parseInt(retryAfter, 10) * 1000;
                        if (retry < 1000) retry = 1000;
                        if (curRetry++ < maxRetries) setTimeout(go, retry + curRetry * retry);
                        else reject(textStatus + " after " + maxRetries + " retries");
                    }
                    else reject(textStatus);
                },
            });
        }
        go();
    });
}

function fetchCurrentUserProfile() {
    var url = "https://api.spotify.com/v1/me";
    return getSpotifyP(url, null);
}

function isPlaying(track) {
    return track === nowPlaying && !audio.get(0).paused;
}

function playTrack(track) {
    if (track != nowPlaying) {
        audio.get(0).pause();
        audio.attr("src", track.details.preview_url);
        audio.get(0).play();
        nowPlaying = track;
    } else {
        stopTrack();
    }
}

function stopTrack() {
    audio.get(0).pause();
    nowPlaying = null;
    $(".playing").removeClass("playing");
}

function collectAudioAttributes(tracks) {
    var maxTracksPerCall = 100;
    var tids = [];
    var deferred = RSVP.defer();

    _.each(tracks, function (track) {
        tids.push(track.id);
    });

    function getNextAudioBatch() {
        var nextTids = getNextBatch(tids, maxTracksPerCall);
        if (nextTids.length > 0) {
            getSpotifyP("https://api.spotify.com/v1/audio-features", {
                ids: nextTids.join(","),
            })
                .then(function (results) {
                    if (results && results.audio_features) {
                        _.each(results.audio_features, function (audio_feature) {
                            if (audio_feature && audio_feature.id) {
                                var track = curTracks[audio_feature.id];
                                _.each(audio_feature, function (val, name) {
                                    track.feats[name] = val;
                                });
                                track.feats.sadness = (1 - audio_feature.energy) * (1 - audio_feature.valence);
                                track.feats.happiness = audio_feature.energy * audio_feature.valence;
                                track.feats.anger = audio_feature.energy * (1 - audio_feature.valence);
                            }
                        });
                    }
                    getNextAudioBatch();
                })
                .catch(function (error) {
                    deferred.reject(error);
                });
        } else {
            deferred.resolve();
        }
    }

    getNextAudioBatch();
    return deferred.promise;
}

function collectArtistAttributes(tracks) {
    var aids = [];
    var maxArtistsPerCall = 50;
    var deferred = RSVP.defer();

    function getNextArtists() {
        var nextAids = getNextBatch(aids, maxArtistsPerCall);
        if (nextAids.length > 0) {
            return getSpotifyP("https://api.spotify.com/v1/artists", { ids: nextAids.join(",") })
                .then(function (results) {
                    _.each(results.artists, function (artist) {
                        if (artist != null && "id" in artist) {
                            curArtists[artist.id] = { genres: artist.genres, name: artist.name, count: 1 };
                        }
                    });
                    getNextArtists();
                })
                .catch(function (error) { deferred.reject(error); });
        } else {
            deferred.resolve(curArtists);
        }
    }

    var aidsSet = new Set();
    _.each(tracks, function (track) {
        _.each(track.details.artists, function (artist) {
            if (!(artist.id in curArtists)) {
                aidsSet.add(artist.id);
            } else {
                curArtists[artist.id].count += 1;
                var count = curArtists[artist.id].count;
                if (count > topArtistCount) {
                    topArtistCount = count;
                    topArtistName = curArtists[artist.id].name;
                }
            }
        });
    });
    aids = Array.from(aidsSet);
    getNextArtists();
    return deferred.promise;
}

function collectAlbumAttributes(tracks) {
    var maxAlbumsPerCall = 20;
    var aids = [];
    var deferred = RSVP.defer();

    function getNextAlbums() {
        var nextAids = getNextBatch(aids, maxAlbumsPerCall);
        if (nextAids.length > 0) {
            getSpotifyP("https://api.spotify.com/v1/albums", { ids: nextAids.join(",") })
                .then(function (results) {
                    _.each(results.albums, function (album) {
                        if (album != null && "id" in album) {
                            curAlbums[album.id] = { name: album.name, release_date: album.release_date, genres: album.genres };
                        }
                    });
                    getNextAlbums();
                })
                .catch(function (error) { deferred.reject(error); });
        } else {
            deferred.resolve(curAlbums);
        }
    }

    var aidSet = new Set();
    _.each(tracks, function (track) {
        if (!(track.details.album_id in curAlbums)) aidSet.add(track.details.album_id);
    });
    aids = Array.from(aidSet);
    getNextAlbums();
    return deferred.promise;
}

function getNextBatch(list, nitems) {
    var out = [];
    while (list.length > 0 && out.length < nitems) out.push(list.shift());
    return out;
}

var trackTextQueue = [];
var showingTracks = false;
var tt = $("#tiny-track");

function showLoadingState() {
    // FIX 5: Safely remove the md:block class to ensure it actually hides when fetching
    $("#sidebar").removeClass("md:block").addClass("hidden");
    $("#loaded").addClass("hidden");
    $("#loading").removeClass("hidden");
}

function showLoadedState() {
    // FIX 5: Ensure sidebar gets its intended desktop structure classes back
    $("#sidebar").removeClass("hidden").addClass("md:block");
    $("#loaded").removeClass("hidden").addClass("flex");
    $("#loading").addClass("hidden");
}

function showTracks(prefix, tracks) {
    _.each(tracks, function (track) {
        var text = prefix + " - " + track.details.artists[0].name + " - " + track.details.name;
        trackTextQueue.push(text);
    });
}

function showTracksUpdater() {
    if (showingTracks) {
        if (trackTextQueue.length > 0) {
            var text = trackTextQueue.shift();
            tt.text(text);
        }
        if (trackTextQueue.length > 0) setTimeout(showTracksUpdater, 40);
        else setTimeout(showTracksUpdater, 300);
    } else {
        tt.text("");
    }
}

function startShowingTracks() {
    showingTracks = true;
    showLoadingState();
    showTracksUpdater();
}
function stopShowingTracks() { showingTracks = false; }

function getTracksFromAPI(source, uri) {
    var deferred = RSVP.defer();
    var allNewTracks = [];
    var allLoadedTracks = [];
    var now = moment();

    function processItems(items) {
        _.each(items, function (item) {
            if (!item.is_local && item.track && "id" in item.track) {
                item.track.added_at = item.added_at;
                item.track.date_added = moment(item.added_at);
                item.track.age = moment.duration(now.diff(item.track.date_added)).asDays();
                var track = {
                    id: item.track.id,
                    feats: {
                        date_added: moment(item.added_at),
                        age: item.track.age,
                        explicit: item.track.explicit,
                        duration_ms: item.track.duration_ms,
                        popularity: item.track.popularity,
                        source: source,
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
                if (track.id in curTracks) {
                    curTracks[track.id].feats.count += 1;
                    var count = curTracks[track.id].feats.count;
                    if (count > topTrackCount) {
                        topTrackCount = count;
                        topTrackName = item.track.name;
                    }
                } else {
                    var ntrack = loadTrack(track.id);
                    if (ntrack != null) {
                        curTracks[track.id] = ntrack;
                        curTracks[track.id].feats.count = 1;
                        allLoadedTracks.push(ntrack);
                    } else {
                        allNewTracks.push(track);
                        curTracks[track.id] = track;
                    }
                }
            }
        });
    }

    function go(offset) {
        getSpotifyP(uri, { limit: 50, market: "from_token", offset: offset })
            .then(function (results) {
                totalTracks = results.total;
                processItems(results.items);
                showTracks(source, allNewTracks.slice(offset));
                refreshHeader();

                if (!abortLoading && offset + results.items.length < results.total) {
                    go(offset + results.items.length);
                } else {
                    collectAudioAttributes(allNewTracks)
                        .then(function () { return collectArtistAttributes(allNewTracks); })
                        .then(function () { return collectAlbumAttributes(allNewTracks); })
                        .then(function () {
                            addTracks(allNewTracks);
                            filterTracks(allNewTracks);
                            filterTracks(allLoadedTracks);
                            refreshTheWorld(true);
                            deferred.resolve(curTracks);
                        })
                        .catch(function (err) { deferred.reject(err); });
                }
            })
            .catch(function (error) {
                deferred.reject(error);
            });
    }

    go(0);
    return deferred.promise;
}

function tinyArtists(artists) {
    var tartists = [];
    _.each(artists, function (artist) { tartists.push({ id: artist.id, name: artist.name }); });
    return tartists;
}

function getSavedTracks() {
    startShowingTracks();
    $("#lplaylist-name").text("Your Saved Tracks");
    getTracksFromAPI("Your Saved tracks", "https://api.spotify.com/v1/me/tracks")
        .then(function () { })
        .catch(function (results) { console.log("GST catch " + results); })
        .finally(function () {
            stopShowingTracks();
            refreshTheWorld(false);
            showLoadedState();
        });
}

function getAllMusic() {
    startShowingTracks();
    $("#lplaylist-name").text("Your Saved Tracks");
    getTracksFromAPI("Your Saved Tracks", "https://api.spotify.com/v1/me/tracks").then(function () {
        getMusicFromPlaylists(true);
    });
}

function getMusicFromPlaylists(allPlaylists) {
    var deferred = RSVP.defer();

    function getMyPlaylists(offset) {
        var params = { limit: 50, offset: offset };
        getSpotifyP("https://api.spotify.com/v1/me/playlists", params)
            .then(function (results) {
                if (results) {
                    var outstandingPlaylists = [];
                    var count = results.offset + results.items.length;
                    totalPlaylists = results.total;
                    _.each(results.items, function (playlist) { outstandingPlaylists.push(playlist); });
                    loadPlaylists(outstandingPlaylists, allPlaylists).then(
                        function () {
                            if (!abortLoading && count < results.total) getMyPlaylists(count);
                            else deferred.resolve(outstandingPlaylists);
                        },
                    );
                } else {
                    deferred.reject(new Error("can't get your playlist"));
                }
            })
            .catch(function (error) { deferred.reject(error); });
    }

    startShowingTracks();
    getMyPlaylists(0);

    deferred.promise
        .then(function () { })
        .catch(function (theError) { error("trouble, " + theError); })
        .finally(function () {
            stopShowingTracks();
            refreshTheWorld(false);
            showLoadedState();
        });
}

var quickMode = false;

function loadPlaylists(playlists, allPlaylists) {
    var deferred = RSVP.defer();

    function fetchNextPlaylist() {
        if (!abortLoading && playlists.length > 0) {
            processedPlaylists += 1;
            var playlist = playlists.shift();
            if (quickMode && processedPlaylists > 100) return deferred.resolve(playlists);
            if (isGoodPlaylist(playlist, allPlaylists)) {
                $("#lplaylist-name").text(playlist.name + " (" + playlist.tracks.total + " tracks)");
                getPlaylistTracks(playlist)
                    .then(function () { fetchNextPlaylist(); })
                    .catch(function () {
                        console.log("trouble loading playlist", playlist);
                        fetchNextPlaylist();
                    });
            } else {
                fetchNextPlaylist();
            }
        } else {
            return deferred.resolve(playlists);
        }
    }
    fetchNextPlaylist();
    return deferred.promise;
}

function isGoodPlaylist(playlist, allPlaylists) {
    if (allPlaylists || playlist.owner.id == curUserID) {
        if (playlist.tracks.total > 0) return true;
    }
    return false;
}

function getPlaylistTracks(playlist) {
    var uri = playlist.uri;
    if (isValidPlaylistUri(uri)) {
        var playlistID = getPlaylistPid(uri);
        var url = "https://api.spotify.com/v1/playlists/" + playlistID + "/tracks";
        return getTracksFromAPI(playlist.name, url);
    } else {
        var deferred = RSVP.defer();
        deferred.reject(new Error("bad playlist URI"));
        return deferred.promise;
    }
}

function getPlaylistFromURI(name, uri) {
    startShowingTracks();
    var playlist = { name: name, uri: uri };
    getPlaylistTracks(playlist).finally(function () {
        stopShowingTracks();
        refreshTheWorld(false);
        showLoadedState();
    });
}

function isValidPlaylistUri(uri) {
    var fields = uri.split(":");
    if (fields.length == 3) {
        if (fields[0] != "spotify" || fields[1] != "playlist") return false;
    } else if (fields.length == 5) {
        if (fields[0] != "spotify" || fields[3] != "playlist") return false;
    } else return false;
    return true;
}

function getPlaylistPid(uri) {
    var fields = uri.split(":");
    if (fields.length == 3) return fields[2];
    else if (fields.length == 5) return fields[4];
    return null;
}

function saveInfo(params) { localStorage.setItem("info", JSON.stringify(params)); }
function getInfo() { var item = localStorage.getItem("info"); return JSON.parse(item); }

function getCollectionCacheKey(info) {
    var type = info && info.type ? info.type : "unknown";
    var uri = info && info.uri ? info.uri : "";
    return cachePrefix + type + ":" + uri;
}

function getLegacyCollectionCacheKey(info) {
    var type = info && info.type ? info.type : "unknown";
    var uri = info && info.uri ? info.uri : "";
    return "omy-cache-v1:" + type + ":" + uri;
}

function getLegacyCollectionCacheKeys(info) {
    var type = info && info.type ? info.type : "unknown";
    var uri = info && info.uri ? info.uri : "";
    var keys = [];

    _.each(legacyCachePrefixes, function (prefix) {
        keys.push(prefix + type + ":" + uri);
    });

    return keys;
}

function getCollectionCacheKeyForRestore(info) {
    var primaryKey = getCollectionCacheKey(info);
    if (localStorage.getItem(primaryKey)) return primaryKey;

    var legacyKeys = getLegacyCollectionCacheKeys(info);
    for (var i = 0; i < legacyKeys.length; i += 1) {
        if (localStorage.getItem(legacyKeys[i])) return legacyKeys[i];
    }

    return null;
}

function compactTrackArtists(artists) {
    return _.map(artists || [], function (artist) {
        return {
            id: artist && artist.id ? artist.id : "",
            name: artist && artist.name ? artist.name : "",
        };
    });
}

function serializeTrack(track) {
    var albumInfo = curAlbums[track.details.album_id] || {};
    return {
        id: track.id,
        feats: {
            date_added: track.feats.date_added ? track.feats.date_added.toISOString() : null,
            age: track.feats.age,
            explicit: track.feats.explicit,
            duration_ms: track.feats.duration_ms,
            popularity: track.feats.popularity,
            source: track.feats.source,
            count: track.feats.count,
            tempo: track.feats.tempo,
            energy: track.feats.energy,
            sadness: track.feats.sadness,
            happiness: track.feats.happiness,
            anger: track.feats.anger,
            danceability: track.feats.danceability,
            loudness: track.feats.loudness,
            liveness: track.feats.liveness,
            valence: track.feats.valence,
            acousticness: track.feats.acousticness,
            speechiness: track.feats.speechiness,
            year: track.feats.year,
            topGenre: track.feats.topGenre,
            genres: track.feats.genres ? Array.from(track.feats.genres) : [],
        },
        details: {
            name: track.details.name,
            album_id: track.details.album_id,
            album_name: albumInfo.name || track.details.album_name || "",
            uri: track.details.uri,
            preview_url: track.details.preview_url,
            artists: compactTrackArtists(track.details.artists),
        },
    };
}

function deserializeTrack(rawTrack) {
    return {
        id: rawTrack.id,
        feats: {
            date_added: rawTrack.feats.date_added ? moment(rawTrack.feats.date_added) : moment(),
            age: rawTrack.feats.age,
            explicit: rawTrack.feats.explicit,
            duration_ms: rawTrack.feats.duration_ms,
            popularity: rawTrack.feats.popularity,
            source: rawTrack.feats.source,
            count: rawTrack.feats.count,
            tempo: rawTrack.feats.tempo,
            energy: rawTrack.feats.energy,
            sadness: rawTrack.feats.sadness,
            happiness: rawTrack.feats.happiness,
            anger: rawTrack.feats.anger,
            danceability: rawTrack.feats.danceability,
            loudness: rawTrack.feats.loudness,
            liveness: rawTrack.feats.liveness,
            valence: rawTrack.feats.valence,
            acousticness: rawTrack.feats.acousticness,
            speechiness: rawTrack.feats.speechiness,
            year: rawTrack.feats.year,
            topGenre: rawTrack.feats.topGenre,
            genres: new Set(rawTrack.feats.genres || []),
        },
        details: {
            name: rawTrack.details.name,
            album_id: rawTrack.details.album_id,
            album_name: rawTrack.details.album_name || "",
            uri: rawTrack.details.uri,
            preview_url: rawTrack.details.preview_url,
            artists: compactTrackArtists(rawTrack.details.artists),
        },
    };
}

function compactTrackForCache(track) {
    return {
        id: track.id,
        feats: {
            date_added: track.feats.date_added ? track.feats.date_added.toISOString() : null,
            source: track.feats.source,
            count: track.feats.count,
        },
    };
}

function compactArtistsForCache(artists) {
    var out = {};
    _.each(artists, function (artist, artistId) {
        if (!artist) return;
        out[artistId] = {
            genres: artist.genres || [],
        };
    });
    return out;
}

function compactAlbumsForCache(albums) {
    var out = {};
    _.each(albums, function (album, albumId) {
        if (!album) return;
        out[albumId] = {
            name: album.name || "",
            genres: album.genres || [],
            release_date: album.release_date || "",
        };
    });
    return out;
}

function isStorageQuotaError(error) {
    if (!error) return false;
    return error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014;
}

function removeOtherCollectionCaches(activeKey) {
    for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key && key.indexOf(cachePrefix) === 0 && key !== activeKey) {
            localStorage.removeItem(key);
        }
    }
}

function tryPersistSnapshot(cacheKey, snapshot) {
    try {
        localStorage.setItem(cacheKey, JSON.stringify(snapshot));
        return true;
    } catch (error) {
        if (!isStorageQuotaError(error)) {
            console.log("Unable to persist collection cache", error);
        }
        return false;
    }
}

function downsampleTracksForCache(serializedTracks, maxTracks) {
    if (!serializedTracks || serializedTracks.length <= maxTracks) return serializedTracks;
    if (maxTracks <= 0) return [];

    var step = serializedTracks.length / maxTracks;
    var sampled = [];
    for (var i = 0; i < maxTracks; i++) {
        var sourceIndex = Math.floor(i * step);
        sampled.push(serializedTracks[sourceIndex]);
    }
    return sampled;
}

function clearWorldState() {
    _.each(theWorld, function (bin) {
        _.each(bin.nodes, function (node) {
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
    trackTextQueue = [];
    clearWorldState();
    clearPlot();
    showTracksUpdater();
    $(".nstaging-tracks").text("0");
}

function persistCurrentCollection() {
    var info = getInfo();
    if (!info || !info.type) return;
    try {
        var cacheKey = getCollectionCacheKey(info);
        var tracks = [];
        _.each(curTracks, function (track) {
            tracks.push(compactTrackForCache(track));
        });

        var snapshot = {
            version: 4,
            tracks: tracks,
            artists: compactArtistsForCache(curArtists),
            albums: compactAlbumsForCache(curAlbums),
            topArtistCount: topArtistCount,
            topArtistName: topArtistName,
            topTrackName: topTrackName,
            topTrackCount: topTrackCount,
            totalTracks: totalTracks,
            totalPlaylists: totalPlaylists,
            processedPlaylists: processedPlaylists,
            curTypeName: curTypeName,
        };

        if (tryPersistSnapshot(cacheKey, snapshot)) {
            localStorage.removeItem(getLegacyCollectionCacheKey(info));
            return;
        }

        removeOtherCollectionCaches(cacheKey);
        if (tryPersistSnapshot(cacheKey, snapshot)) {
            localStorage.removeItem(getLegacyCollectionCacheKey(info));
            return;
        }

        snapshot.artists = {};
        snapshot.albums = {};
        if (tryPersistSnapshot(cacheKey, snapshot)) {
            localStorage.removeItem(getLegacyCollectionCacheKey(info));
            console.log("Collection cache stored in compact mode to avoid storage limits");
            return;
        }

        var reducedTrackCount = Math.floor(tracks.length * 0.75);
        while (reducedTrackCount >= 50) {
            snapshot.tracks = downsampleTracksForCache(tracks, reducedTrackCount);
            if (tryPersistSnapshot(cacheKey, snapshot)) {
                localStorage.removeItem(getLegacyCollectionCacheKey(info));
                console.log("Collection cache stored in reduced mode (" + reducedTrackCount + "/" + tracks.length + " tracks) to avoid storage limits");
                return;
            }
            reducedTrackCount = Math.floor(reducedTrackCount * 0.7);
        }

        localStorage.removeItem(cacheKey);
        console.log("Skipped collection cache due to localStorage size limits");
    } catch (error) { console.log("Unable to persist collection cache", error); }
}

function restoreCurrentCollection(info, cacheKey) {
    var resolvedKey = cacheKey || getCollectionCacheKeyForRestore(info);
    if (!resolvedKey) return false;

    var raw = localStorage.getItem(resolvedKey);
    if (!raw) return false;

    try {
        var snapshot = JSON.parse(raw);
        if (!snapshot || !snapshot.tracks) return false;

        clearWorldState();
        curTracks = {};
        curArtists = snapshot.artists || {};
        curAlbums = snapshot.albums || {};
        topArtistCount = snapshot.topArtistCount || 0;
        topArtistName = snapshot.topArtistName || null;
        topTrackName = snapshot.topTrackName || null;
        topTrackCount = snapshot.topTrackCount || 0;
        totalTracks = snapshot.totalTracks || 0;
        totalPlaylists = snapshot.totalPlaylists || 0;
        processedPlaylists = snapshot.processedPlaylists || 0;
        curTypeName = snapshot.curTypeName || curTypeName;

        var firstTrack = snapshot.tracks[0];
        if (firstTrack && firstTrack.details) {
            var restoredTracks = [];
            _.each(snapshot.tracks, function (rawTrack) {
                var track = deserializeTrack(rawTrack);
                curTracks[track.id] = track;
                restoredTracks.push(track);
            });

            addTracks(restoredTracks);
            filterTracks(restoredTracks);
            refreshTheWorld(false);
            showLoadedState();
            return true;
        }

        var trackRefs = snapshot.tracks;
        if (!trackRefs.length) return false;

        collectTracksByIds(trackRefs)
            .then(function (restoredTracks) {
                curTracks = {};
                _.each(restoredTracks, function (track) {
                    curTracks[track.id] = track;
                });
                addTracks(restoredTracks);
                filterTracks(restoredTracks);
                refreshTheWorld(false);
                showLoadedState();
            })
            .catch(function (error) {
                console.log("Unable to restore cached tracks by id", error);
                pendingFetchStarter = function () { startCollectionFetch(info); };
                if (pendingFetchStarter) {
                    var fallbackFetch = pendingFetchStarter;
                    pendingFetchStarter = null;
                    fallbackFetch();
                }
            });
        return true;
    } catch (error) {
        console.log("Unable to restore collection cache", error);
        return false;
    }
}

function buildTrackFromSpotifyItem(item, source) {
    var dateAdded = item.added_at ? moment(item.added_at) : moment();
    var age = moment.duration(moment().diff(dateAdded)).asDays();

    return {
        id: item.track.id,
        feats: {
            date_added: dateAdded,
            age: age,
            explicit: item.track.explicit,
            duration_ms: item.track.duration_ms,
            popularity: item.track.popularity,
            source: source,
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

function collectTracksByIds(trackRefs) {
    var ids = [];
    var trackMeta = {};
    var deferred = RSVP.defer();

    _.each(trackRefs, function (trackRef) {
        if (!trackRef || !trackRef.id) return;
        ids.push(trackRef.id);
        trackMeta[trackRef.id] = trackRef;
    });

    function getNextTrackBatch(restoredTracks) {
        var nextIds = getNextBatch(ids, 50);
        if (nextIds.length > 0) {
            getSpotifyP("https://api.spotify.com/v1/tracks", { ids: nextIds.join(",") })
                .then(function (results) {
                    _.each(results.tracks, function (trackItem) {
                        if (!trackItem || !trackItem.id) return;

                        var trackRef = trackMeta[trackItem.id];
                        var track = buildTrackFromSpotifyItem({ track: trackItem, added_at: trackRef && trackRef.feats ? trackRef.feats.date_added : null }, trackRef && trackRef.feats ? trackRef.feats.source : null);
                        if (trackRef && trackRef.feats) {
                            if (trackRef.feats.date_added) track.feats.date_added = moment(trackRef.feats.date_added);
                            if (trackRef.feats.source) track.feats.source = trackRef.feats.source;
                            if (trackRef.feats.count) track.feats.count = trackRef.feats.count;
                            track.feats.age = moment.duration(moment().diff(track.feats.date_added)).asDays();
                        }

                        restoredTracks.push(track);
                    });

                    getNextTrackBatch(restoredTracks);
                })
                .catch(function (error) {
                    deferred.reject(error);
                });
        } else {
            deferred.resolve(restoredTracks);
        }
    }

    getNextTrackBatch([]);
    return deferred.promise;
}

function startCollectionFetch(info) {
    if (info.type == "saved") getSavedTracks();
    else if (info.type == "added") getMusicFromPlaylists(false);
    else if (info.type == "playlist") getPlaylistFromURI("Your Playlist", info.uri);
    else if (info.type == "follow") getMusicFromPlaylists(true);
    else if (info.type == "all") getAllMusic();
    else console.log("unexpected type", info.type);
}

function queueRestoreOrFetch(info) {
    var cacheKey = getCollectionCacheKeyForRestore(info);
    if (cacheKey) {
        pendingFetchStarter = function () { startCollectionFetch(info); };
        if (theTrackTable != null && theStagingTable != null) {
            if (!restoreCurrentCollection(info, cacheKey) && pendingFetchStarter) {
                var fallbackFetch = pendingFetchStarter;
                pendingFetchStarter = null;
                fallbackFetch();
            } else {
                pendingFetchStarter = null;
            }
        } else {
            pendingRestoreInfo = info;
        }
        return true;
    }
    return false;
}

function refetchCurrentCollection() {
    var info = getInfo();
    if (!info || !info.type) return;
    localStorage.removeItem(getCollectionCacheKey(info));
    localStorage.removeItem(getLegacyCollectionCacheKey(info));
    pendingRestoreInfo = null;
    pendingFetchStarter = null;
    abortLoading = false;
    resetCollectionState();
    showLoadingState();
    startCollectionFetch(info);
}

function go() {
    $(".err-txt").text("");
    var type = $("#collection-type").val();
    var params = { type: type };
    if (type == "playlist") params.uri = $("#uri-text").val();
    saveInfo(params);
    authorizeUser();
}

function goAll() {
    $(".err-txt").text("");
    var params = { type: "all" };
    saveInfo(params);
    authorizeUser();
}

function normalizeUri(uri) {
    uri = uri.replace("https://open.spotify.com", "spotify");
    uri = uri.replace("https://play.spotify.com", "spotify");
    uri = uri.replace(/\//g, ":");
    return uri;
}

function stopLoading() {
    console.log("stop loading");
    abortLoading = true;
    linfo("Stopping ... hang on ...");
}

function goPlaylist() {
    $(".err-txt").text("");
    var uri = normalizeUri($("#uri-text").val());
    if (isValidPlaylistUri(uri)) {
        var params = { type: "playlist", uri: uri };
        saveInfo(params);
        authorizeUser();
    } else {
        $(".err-txt").text("That's not a playlist URI");
    }
}

function setProgress(percent) {
    progressBar.css("width", percent + "%").attr("aria-valuenow", percent);
}

function initTables() {
    theTrackTable = new google.visualization.Table(document.getElementById("gthe-track-table"));
    google.visualization.events.addListener(theTrackTable, "ready", function () {
        enhancePagerUI(theTrackTable);
    });
    google.visualization.events.addListener(theTrackTable, "select", function () { });

    // FIX 3: Master "Select All" function applies selection against the table's raw data
    // to ensure filtered and non-visible tracks get selected too
    function selectAllHandler(tableId, props, tableObj) {
        if (props.column == 0) {
            var tracksToSelect = tableObj.currentTracks || [];
            _.each(tracksToSelect, function (track) {
                if (props.ascending) curSelected.add(track.id);
                else curSelected.delete(track.id);
            });

            $(tableId).find(".track-select").each(function () {
                $(this).prop("checked", props.ascending);
            });
            $(".nstaging-tracks").text(curSelected.size);
        }
    }

    google.visualization.events.addListener(theTrackTable, "sort", function (props) {
        selectAllHandler("#gthe-track-table", props, theTrackTable);
        addEventHandlers($(theTrackTable.getContainer()));
    });
    google.visualization.events.addListener(theTrackTable, "page", function (props) {
        if (props && typeof props.page === "number") {
            theTrackTable.currentPage = props.page;
        }
        enhancePagerUI(theTrackTable);
        addEventHandlers($(theTrackTable.getContainer()));
    });

    theStagingTable = new google.visualization.Table(document.getElementById("gthe-staging-table"));
    google.visualization.events.addListener(theStagingTable, "ready", function () {
        enhancePagerUI(theStagingTable);
    });
    google.visualization.events.addListener(theStagingTable, "sort", function (props) {
        selectAllHandler("#gthe-staging-table", props, theStagingTable);
        addEventHandlers($(theStagingTable.getContainer()));
    });
    google.visualization.events.addListener(theStagingTable, "page", function (props) {
        if (props && typeof props.page === "number") {
            theStagingTable.currentPage = props.page;
        }
        enhancePagerUI(theStagingTable);
        addEventHandlers($(theStagingTable.getContainer()));
    });

    if (pendingRestoreInfo) {
        var restoreInfo = pendingRestoreInfo;
        pendingRestoreInfo = null;
        if (!restoreCurrentCollection(restoreInfo) && pendingFetchStarter) {
            var fallbackFetch = pendingFetchStarter;
            pendingFetchStarter = null;
            fallbackFetch();
        } else {
            pendingFetchStarter = null;
        }
    }
}

function initPlot() {
    addPlotSelect($("#select-xaxis"), "energy");
    addPlotSelect($("#select-yaxis"), "loudness");
    addPlotSelect($("#select-size"), "popularity");

    $("#plot-clear").on("click", function () { clearPlot(); });
    $("#refetch-button").on("click", function () { refetchCurrentCollection(); });
    window.onresize = function () { redrawPlot(); };
    clearPlot();
}

$(document).ready(function () {
    var urlParams = new URLSearchParams(window.location.search);
    var code = urlParams.get("code");
    var authError = urlParams.get("error");

    $("#collection-type").on("change", function () {
        var type = $("#collection-type").val();
        if (type == "playlist") $("#uri-prompt").removeClass("hidden").addClass("block");
        else $("#uri-prompt").removeClass("block").addClass("hidden");
    });

    $("#global-search").on("input", function () {
        currentSearchQuery = $(this).val().trim().toLowerCase();
        if (curNode) {
            showPlaylist(curNode);
        }
    });

    $(".max-shown").text(maxTracksShown);
    $(".work").addClass("hidden").removeClass("flex");

    if (authError) {
        error("Sorry, I can't read your music collection from Spotify without authorization");
        $("#go").show();
        $("#go").on("click", function () { go(); });
    } else if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        exchangeCodeForToken(code)
            .then(function (response) {
                accessToken = response.access_token;
                if (response.refresh_token) window.localStorage.setItem("refresh_token", response.refresh_token);

                thePlot = $("#the-plot").get(0);
                $(".work").removeClass("hidden").addClass("flex");
                $("#sidebar.work").removeClass("hidden flex").addClass("md:block hidden");
                $("#intro").hide();

                $("#stop-loading").on("click", function () { stopLoading(); });
                $("#staging-playlist-name").editable({ mode: "popup", placement: "right" });
                $("#save-button").on("click", function () { savePlaylist(); });

                $("#staging-tab").on("shown.bs.tab", function () {
                    stagingIsVisible = true;
                    showStagingList();
                });
                $("#staging-tab").on("hidden.bs.tab", function () {
                    stagingIsVisible = false;
                    showStagingList();
                });

                google.charts.load("current", { packages: ["table"] });
                google.charts.setOnLoadCallback(initTables);

                initPlot();
                $("a[href='#the-plots']").on("shown.bs.tab", function () { redrawPlot(); });

                fetchCurrentUserProfile().then(function (user) {
                    if (user) {
                        curUserID = user.id;
                        $("#who").text(user.id);
                        var info = getInfo();
                        var curType = info.type;
                        curTypeName = $("#collection-type option[value='" + curType + "']").text();
                        $("#section-title").text(curTypeName);
                        $("#section-title-inline").text(curTypeName);
                        if (!queueRestoreOrFetch(info)) {
                            startCollectionFetch(info);
                        }
                    } else {
                        error("Trouble getting the user profile");
                    }
                });
            })
            .fail(function () {
                error("Failed to exchange authorization code for token");
                $("#go").show();
                $("#go").on("click", function () { go(); });
            });
    } else {
        $("#go").show();
        $("#go").on("click", function () { go(); });
    }
});

function saveTrack(track) { return; }
function loadTrack(id) { return null; }