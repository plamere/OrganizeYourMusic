# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Organize Your Music is a client-side Spotify web app that lets users organize their saved music, playlists, and followed playlists by attributes like genre, mood, decade, popularity, and audio features (energy, danceability, etc.). Users can browse organized "bins," preview tracks, and save selections as new Spotify playlists.

## Architecture

This is a **no-build, single-page web app**. All application logic lives as inline JavaScript in `web/index.html` (~2400 lines). There is no build system, bundler, or package manager.

**Key files:**
- `web/index.html` — The entire app: HTML, CSS overrides, and all JS logic inline
- `web/config.js` — Spotify OAuth client ID and redirect URIs
- `web/styles2.css` — Custom styles (on top of Spotify Bootstrap theme)
- `web/lib/` — Vendored JS libraries (jQuery, Underscore, Moment, RSVP, Typeahead)
- `web/deploy` — Shell script to deploy via `s3cmd sync` to S3

**External dependencies (loaded via CDN):**
- Spotify Bootstrap CSS/JS, Font Awesome, Google Charts, Plotly, x-editable

**Spotify API integration:**
- Uses Implicit Grant OAuth flow (token in URL hash after redirect)
- Config toggles between `LOCAL_SPOTIFY_REDIRECT_URI` (localhost:8000) and `REMOTE_SPOTIFY_REDIRECT_URI` in `config.js`
- All Spotify Web API calls are made client-side via jQuery AJAX

## Local Development

Serve the `web/` directory on localhost:8000 (matching the local redirect URI in config.js):

```bash
cd web && python3 -m http.server 8000
```

To use local development, change `config.js` to set:
```js
var SPOTIFY_REDIRECT_URI = LOCAL_SPOTIFY_REDIRECT_URI;
```

## Deployment

```bash
cd web && bash deploy
```

Deploys all files to S3 via `s3cmd sync`.

## Code Organization (within index.html)

The inline JS is organized into these major sections:
- **Spotify API helpers** — OAuth token handling, paginated fetch for saved tracks/playlists
- **Data processing** — Categorizing tracks into bins by genre, mood, decade, popularity, and audio features
- **UI rendering** — jQuery-based DOM manipulation for bin lists, track tables, plotting (Plotly/Google Charts)
- **Playlist management** — Staging playlist, saving to Spotify, x-editable for renaming
