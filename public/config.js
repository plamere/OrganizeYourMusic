"use strict";

var isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
var SPOTIFY_CLIENT_ID = '1c81d0d03de148c083744f5cce782ef7';
var SPOTIFY_REDIRECT_URI = isLocal
    ? window.location.origin + '/'
    : 'https://organize-your-music.vercel.app/';
