"use strict";

var SPOTIFY_CLIENT_ID = '1c81d0d03de148c083744f5cce782ef7';
var SPOTIFY_REDIRECT_URI = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? window.location.origin + '/'
    : 'https://organizeyourmusic.playlistmachinery.com/';
