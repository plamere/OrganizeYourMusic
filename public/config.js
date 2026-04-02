"use strict";

var SPOTIFY_CLIENT_ID = 'bfe95a91ca5b43ab8b32c86003ee0f5f';
var SPOTIFY_REDIRECT_URI = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? window.location.origin + '/'
    : 'https://organize-your-music.vercel.app/';
