// --- Spotify Web API Implicit Grant Flow ---
// Register your app at developer.spotify.com/dashboard
// Set REDIRECT_URI to the HTTPS page where this is hosted, e.g. https://username.github.io/repo/
const CLIENT_ID = "36b771785afb424086e92d9dceb4f262";
const REDIRECT_URI = "YOUR_REDIRECT_URI"; // <-- Replace with your deployed app URL!
const SCOPES = "";
function getHashParams() {
    const hash = window.location.hash.substring(1);
    return Object.fromEntries(new URLSearchParams(hash));
}
function buildAuthURL() {
    return 'https://accounts.spotify.com/authorize'
        + '?response_type=token'
        + '&client_id=' + encodeURIComponent(CLIENT_ID)
        + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI)
        + '&scope=' + SCOPES
        + '&show_dialog=true';
}

let accessToken = getHashParams().access_token;
if (!accessToken) {
    document.getElementById('topCharts').innerHTML = "<div class='loading'>Please login with Spotify.</div>";
    document.getElementById('albumsGrid').innerHTML = "<div class='loading'>Please login with Spotify.</div>";
    let loginbtn = document.createElement('button');
    loginbtn.textContent = "Login with Spotify";
    loginbtn.className = "action-btn primary-btn";
    loginbtn.onclick = () => window.location = buildAuthURL();
    document.body.insertBefore(loginbtn, document.body.firstChild);
} else {
const app = {
    currentTrackIndex: 0,
    isPlaying: false,
    currentPlaylist: [],
    volume: 0.7,
    isMuted: false,
    currentView: 'home',
    topTracks: [],
    albums: [],
    audio: document.getElementById('audioPlayer'),
    searchTimeout: null,

    async fetchSpotify(endpoint) {
        const res = await fetch("https://api.spotify.com/v1/"+endpoint,
              {headers: {Authorization: `Bearer ${accessToken}`}});
        if (res.status === 401) window.location = buildAuthURL(); // expired token
        return res.json();
    },

    setupEventListeners() {
        document.querySelectorAll('.nav-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-icon').forEach(i => i.classList.remove('active'));
                e.target.classList.add('active');
                let view = e.target.dataset.view;
                if (view) this.switchView(view);
            });
        });

        document.getElementById('searchInput').addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                if (e.target.value.trim()) this.search(e.target.value.trim());
                else this.loadInitialData();
            }, 500);
        });

        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            document.getElementById('playIcon').innerHTML = '<path d="M8 5v14l11-7z"/>';
        });
    },

    async init() {
        this.setupEventListeners();
        this.loadInitialData();
    },

    async loadInitialData() {
        await Promise.all([
            this.loadTopCharts(),
            this.loadNewReleases(),
            this.loadCollection()
        ]);
    },

    async loadTopCharts() {
        // Get "New Releases" and their first track as the Top Charts
        const data = await this.fetchSpotify("browse/new-releases?limit=5");
        this.topTracks = [];
        for (const album of data.albums.items) {
            const tracks = await this.fetchSpotify(`albums/${album.id}/tracks?limit=1`);
            if (tracks.items.length) this.topTracks.push({...tracks.items[0], album});
        }
        this.renderTopCharts();
    },

    renderTopCharts() {
        const container = document.getElementById('topCharts');
        container.innerHTML = this.topTracks.map((track, index) => `
            <div class="chart-item" onclick="app.playTrackFromChart(${index})">
                <img src="${track.album.images[0]?.url || ''}" alt="${track.name}">
                <div class="chart-info">
                    <div class="chart-name">${track.name}</div>
                    <div class="chart-artist">${track.artists.map(a => a.name).join(', ')}</div>
                </div>
            </div>
        `).join('');
    },

    async loadNewReleases() {
        const data = await this.fetchSpotify("browse/new-releases?limit=8");
        this.albums = data.albums.items;
        this.renderNewReleases();
    },

    renderNewReleases() {
        const grid = document.getElementById('albumsGrid');
        grid.innerHTML = this.albums.map(album => `
            <div class="album-card" onclick="app.showAlbum('${album.id}')">
                <img class="album-cover" src="${album.images[0]?.url || ''}" alt="">
                <div class="album-title">${album.name}</div>
                <div class="album-artist">${album.artists.map(a => a.name).join(', ')}</div>
            </div>
        `).join('');
    },

    async search(query) {
        const data = await this.fetchSpotify(`search?q=${encodeURIComponent(query)}&type=track,album&limit=10`);
        this.topTracks = data.tracks.items;
        this.albums = data.albums.items;
        this.renderTopCharts();
        this.renderNewReleases();
    },

    async playTrackFromChart(index) {
        const track = this.topTracks[index];
        this.playPreview(track);
    },

    playPreview(track) {
        document.getElementById('playerTitle').textContent = track.name;
        document.getElementById('playerArtist').textContent = track.artists.map(a => a.name).join(', ');
        document.getElementById('playerCover').src = track.album.images[0]?.url || '';
        if (track.preview_url) {
            this.audio.src = track.preview_url;
            this.audio.play();
            this.isPlaying = true;
            document.getElementById('playIcon').innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        } else {
            this.audio.src = "";
            alert("No preview available for this track.");
        }
    },

    togglePlay() {
        if (this.audio.src === "") return;
        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
            document.getElementById('playIcon').innerHTML = '<path d="M8 5v14l11-7z"/>';
        } else {
            this.audio.play();
            this.isPlaying = true;
            document.getElementById('playIcon').innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        }
    },

    async showAlbum(id) {
        const album = await this.fetchSpotify(`albums/${id}`);
        this.showPlaylistView(album);
    },

    showPlaylistView(album) {
        document.getElementById('homeView').style.display = 'none';
        document.getElementById('collectionView').classList.remove('active');
        const playlistView = document.getElementById('playlistView');
        playlistView.classList.add('active');

        document.getElementById('playlistCover').src = album.images[0]?.url || '';
        document.getElementById('playlistTitle').textContent = album.name;
        document.getElementById('playlistMeta').textContent = `${album.artists.map(a => a.name).join(', ')} • ${album.tracks.total} songs`;

        const songList = document.getElementById('songList');
        songList.innerHTML = album.tracks.items.map((song, i) => `
            <div class="song-item" onclick="app.playSongFromAlbum('${song.id}', '${album.id}')">
                <img src="${album.images[0]?.url || ''}" alt="">
                <div class="song-details">
                    <div class="song-title">${song.name}</div>
                    <div class="song-category">${song.artists.map(a => a.name).join(', ')}</div>
                </div>
                <div class="song-duration">${app.formatTime(song.duration_ms/1000)}</div>
            </div>
        `).join('');
    },

    async playSongFromAlbum(trackId, albumId) {
        const track = await this.fetchSpotify(`tracks/${trackId}`);
        this.playPreview({...track, album: {images: track.album.images}});
    },

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    },

    switchView(view) {
        document.getElementById('homeView').style.display = 'none';
        document.getElementById('collectionView').classList.remove('active');
        document.getElementById('playlistView').classList.remove('active');
        if (view === 'home') document.getElementById('homeView').style.display = 'block';
        if (view === 'collection') document.getElementById('collectionView').classList.add('active');
    },

    async loadCollection() {
        const grid = document.getElementById('collectionGrid');
        grid.innerHTML = `<div class="loading">Your liked albums will appear here.</div>`;
    }
};
window.app = app; // so event handlers work
app.init();
}