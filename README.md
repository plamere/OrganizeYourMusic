# Organize Your Music

Organize Your Music is a high-performance, data-driven tool designed to help you take full control of your Spotify library. It allows you to analyze, sort, and visualize your music collection using a wide array of musical attributes and technical audio features.

## Key Features

### Advanced Data Grid
The application features a modern, React-based data table optimized for density and readability:
- Sticky Columns: Essential data like Title and Artist remain visible while scrolling horizontally.
- Glassmorphism UI: Semi-transparent headers and rows with backdrop blur for a premium aesthetic.
- Interactive Previews: Hover over the play button to see high-resolution album art and click to listen to 30-second audio clips.
- Relevancy Sorting: Automatically reorders columns based on the active sort key to keep relevant data front and center.
- Deep Tooltips: Detailed explanations for every column header.

### Deep Categorization
Automatically organize your music into "bins" based on:
- Genres: Multiple genre classifications per track.
- Moods and Styles: Energy, danceability, and valence levels.
- Decades: Group by release year and era.
- Popularity: Filter by mainstream or underground status.

### Interactive Visualization
Map your collection onto dynamic scatter plots powered by Plotly.js:
- Customizable Axes: Set X-axis, Y-axis, and bubble size to any audio feature (e.g., Energy vs. Valence).
- Visual Clustering: Identify patterns in your listening habits.
- Batch Selection: Use lasso or box tools to select clusters of tracks visually for staging.

### Staging and Saving
- Staging Area: Collect tracks from different bins and searches into a temporary staging list.
- New Playlists: Save your staged collection as a brand-new playlist directly to your Spotify account.
- Non-Destructive: The tool never modifies or deletes your existing tracks or playlists.

## Technical Audio Features Explained

To help you organize your music more effectively, the app provides access to deep technical metadata:

| Feature | Description |
| :--- | :--- |
| BPM | The tempo of the track in beats per minute. |
| Energy | A measure of intensity and activity (e.g., death metal has high energy). |
| Danceability | How suitable a track is for dancing based on tempo, rhythm stability, and beat strength. |
| Valence | A measure of musical positiveness. High valence sounds happy/cheerful; low valence sounds sad/angry. |
| Acousticness | A confidence measure of whether the track is acoustic. |
| Liveness | Detects the presence of an audience in the recording. |
| Speechiness | Detects the presence of spoken words. Higher values indicate more talk-like tracks. |
| Instrumentalness | Predicts whether a track contains no vocals. |
| Popularity | A score from 0 to 100 based on the total number of plays and how recent those plays are. |

## Tech Stack

### Frontend
- Vite and React 19: High-performance core and modern component architecture.
- Tailwind CSS 4: Next-generation styling with advanced container queries and glassmorphism.
- Plotly.js: Professional-grade data visualization.
- React Table Adapter: Bridging legacy data management with modern React rendering.

### Backend
- Node.js and Express: Acts as a dedicated proxy for the Spotify API to handle complex requests, batching, and OAuth flows.

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended).
- A Spotify Developer Account to obtain a Client ID and Secret.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/CurtisCullenAWong/OrganizeYourMusic.git
   cd OrganizeYourMusic
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration
Create a `.env` file in the root directory and add your Spotify credentials:
```env
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/
```

### Running Locally
To start the development environment (both frontend and backend proxy):
```bash
npm run dev
```

The app will be available at:
- Frontend: `http://localhost:5173`
- Backend API Proxy: `http://localhost:8000`

## How it Works
1. Authentication: Securely login via Spotify OAuth 2.0.
2. Data Fetching: Retrieve your saved tracks, playlists, or your entire collection.
3. Metadata Enrichment: The app automatically fetches detailed audio features for every track in your collection.
4. Categorization: Tracks are sorted into logical bins for easy browsing.
5. Analysis: Use the Grid and Plots to find exactly what you are looking for.
6. Staging: Check tracks to add them to your staging list.
7. Save: Create a new playlist on Spotify with one click.

---
Enhanced with modern UI/UX improvements by Curtis Wong (2026).
Originally created by @plamere.
