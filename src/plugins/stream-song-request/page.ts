export const page = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#111511">
    <title>Song requests</title>
    <style>
      :root { color-scheme: dark; --ink: #f1f1e9; --muted: #a4aaa0; --panel: #1a201a; --line: #333b32; --lime: #d1f27a; --coral: #ff8069; font-family: "Trebuchet MS", "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; color: var(--ink); background: radial-gradient(ellipse at 90% 0%, #26321f 0, transparent 42%), #111511; }
      header { min-height: 76px; border-bottom: 1px solid var(--line); display: flex; align-items: center; padding: 0 max(24px, calc((100vw - 940px) / 2)); gap: 14px; }
      .mark { width: 38px; height: 38px; display: grid; place-items: center; color: #111511; background: var(--lime); font-size: 21px; font-weight: 900; }
      .brand { font-size: 14px; letter-spacing: 0; font-weight: 700; }
      .brand small { display: block; margin-top: 3px; color: var(--muted); font-size: 11px; font-weight: 400; }
      main { width: min(940px, calc(100% - 40px)); margin: 54px auto 80px; }
      h1 { margin: 0; font-size: 32px; letter-spacing: 0; font-weight: 700; }
      .intro { margin: 8px 0 28px; color: var(--muted); font-size: 14px; }
      form { display: flex; gap: 10px; }
      input { min-width: 0; height: 48px; border: 1px solid var(--line); border-radius: 4px; padding: 0 14px; color: var(--ink); background: #191e19; font: inherit; }
      #query { flex: 1; }
      input:focus { outline: 2px solid var(--lime); outline-offset: 1px; }
      button { min-height: 44px; border: 0; border-radius: 4px; padding: 0 18px; color: #111511; background: var(--lime); font: inherit; font-weight: 700; cursor: pointer; }
      button:disabled { cursor: wait; opacity: .55; }
      .name-row { margin: 14px 0 0; }
      #nickname { width: min(100%, 360px); }
      #status { min-height: 22px; margin: 20px 0 8px; color: var(--muted); font-size: 13px; }
      #results { border-top: 1px solid var(--line); }
      .track { min-height: 86px; display: grid; grid-template-columns: 64px minmax(0, 1fr) auto auto; gap: 15px; align-items: center; border-bottom: 1px solid var(--line); padding: 10px 0; }
      .thumb { width: 64px; height: 64px; object-fit: cover; background: var(--panel); border-radius: 3px; }
      .track-title { overflow: hidden; color: var(--ink); font-size: 14px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
      .track-meta { overflow: hidden; margin-top: 6px; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
      .duration { color: var(--muted); font-size: 12px; white-space: nowrap; }
      .track button { min-height: 36px; padding: 0 12px; font-size: 12px; }
      .toast { position: fixed; right: 20px; bottom: 20px; max-width: min(420px, calc(100vw - 40px)); padding: 13px 16px; border-left: 3px solid var(--coral); background: #20271f; box-shadow: 0 8px 30px #0008; font-size: 13px; }
      [hidden] { display: none !important; }
      @media (max-width: 580px) { header { padding: 0 20px; } main { margin-top: 36px; } h1 { font-size: 27px; } form { align-items: stretch; } form > button { padding: 0 13px; } .track { grid-template-columns: 52px minmax(0, 1fr) auto; gap: 10px; } .thumb { width: 52px; height: 52px; } .duration { display: none; } .track button { padding: 0 10px; } }
    </style>
  </head>
  <body>
    <header><div class="mark" aria-hidden="true">♫</div><div class="brand">YT MUSIC <small id="brand-subtitle">COMMUNITY QUEUE</small></div></header>
    <main>
      <h1 id="heading">Request a song</h1>
      <p class="intro" id="intro">Find a track and add it to the stream queue.</p>
      <form id="search-form"><input id="query" type="search" maxlength="100" required autocomplete="off" placeholder="Search songs or artists" aria-label="Search songs or artists"><button id="search-button" type="submit">Search</button></form>
      <div class="name-row" id="name-row" hidden><input id="nickname" maxlength="32" autocomplete="nickname" placeholder="Your name" aria-label="Your name"></div>
      <p id="status" role="status" aria-live="polite"></p>
      <section id="results" aria-label="Search results"></section>
    </main>
    <div class="toast" id="toast" role="status" hidden></div>
    <script>
      const root = '/' + '__ACCESS_TOKEN__';
      const labels = navigator.language.toLowerCase().startsWith('es')
        ? { title: 'Pide una canción', intro: 'Busca música y añádela a la cola del stream.', search: 'Buscar', placeholder: 'Buscar canciones o artistas', name: 'Tu nombre', searching: 'Buscando…', empty: 'No se encontraron canciones.', add: 'Añadir', added: 'Añadida a la cola', adding: 'Añadiendo…', required: 'Escribe tu nombre para continuar.', failed: 'No se pudo completar la solicitud.' }
        : { title: 'Request a song', intro: 'Find a track and add it to the stream queue.', search: 'Search', placeholder: 'Search songs or artists', name: 'Your name', searching: 'Searching…', empty: 'No songs found.', add: 'Add', added: 'Added to the queue', adding: 'Adding…', required: 'Enter your name to continue.', failed: 'The request could not be completed.' };
      document.documentElement.lang = labels.title === 'Pide una canción' ? 'es' : 'en';
      document.title = labels.title;
      document.querySelector('#heading').textContent = labels.title;
      document.querySelector('#intro').textContent = labels.intro;
      document.querySelector('#search-button').textContent = labels.search;
      document.querySelector('#query').placeholder = labels.placeholder;
      document.querySelector('#nickname').placeholder = labels.name;
      const form = document.querySelector('#search-form');
      const query = document.querySelector('#query');
      const results = document.querySelector('#results');
      const status = document.querySelector('#status');
      const toast = document.querySelector('#toast');
      const nickname = document.querySelector('#nickname');
      let requireNickname = true;
      let blockExplicit = false;
      let toastTimer;
      const textOf = value => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (Array.isArray(value.runs)) return value.runs.map(run => run.text || '').join('');
        return value.simpleText || '';
      };
      const explicit = value => JSON.stringify(value).toLowerCase().includes('explicit');
      const findTracks = data => {
        const tracks = new Map();
        const walk = value => {
          if (!value || typeof value !== 'object') return;
          if (Array.isArray(value)) { value.forEach(walk); return; }
          const renderer = value.musicResponsiveListItemRenderer || value.videoRenderer;
          if (renderer) {
            const id = renderer.playlistItemData?.videoId || renderer.videoId || renderer.navigationEndpoint?.watchEndpoint?.videoId;
            const columns = renderer.flexColumns || [];
            const title = textOf(columns[0]?.musicResponsiveListItemFlexColumnRenderer?.text || renderer.title);
            const artist = textOf(columns[1]?.musicResponsiveListItemFlexColumnRenderer?.text || renderer.shortBylineText || renderer.ownerText);
            const thumbnails = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || renderer.thumbnail?.thumbnails || renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
            const image = thumbnails.at(-1)?.url;
            const duration = textOf(renderer.fixedColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text || renderer.lengthText);
            if (typeof id === 'string' && title && !tracks.has(id) && !(blockExplicit && explicit(renderer))) tracks.set(id, { id, title, artist, image, duration });
          }
          Object.values(value).forEach(walk);
        };
        walk(data);
        return [...tracks.values()].slice(0, 50);
      };
      const showToast = message => {
        toast.textContent = message;
        toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
      };
      const request = async (path, body) => {
        const response = await fetch(root + '/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || labels.failed);
        return data;
      };
      const renderTracks = tracks => {
        results.replaceChildren();
        if (!tracks.length) { status.textContent = labels.empty; return; }
        status.textContent = '';
        tracks.forEach(track => {
          const row = document.createElement('article');
          row.className = 'track';
          const image = document.createElement('img');
          image.className = 'thumb';
          image.alt = '';
          if (typeof track.image === 'string' && track.image.startsWith('https://')) image.src = track.image;
          const info = document.createElement('div');
          const title = document.createElement('div');
          title.className = 'track-title';
          title.textContent = track.title;
          const artist = document.createElement('div');
          artist.className = 'track-meta';
          artist.textContent = track.artist || 'YouTube Music';
          info.append(title, artist);
          const duration = document.createElement('span');
          duration.className = 'duration';
          duration.textContent = track.duration;
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = labels.add;
          button.addEventListener('click', async () => {
            if (requireNickname && !nickname.value.trim()) { nickname.focus(); showToast(labels.required); return; }
            button.disabled = true;
            button.textContent = labels.adding;
            try {
              await request('queue', { videoId: track.id, nickname: nickname.value.trim() });
              button.textContent = labels.added;
              showToast(labels.added);
            } catch (error) {
              button.disabled = false;
              button.textContent = labels.add;
              showToast(error.message || labels.failed);
            }
          });
          row.append(image, info, duration, button);
          results.append(row);
        });
      };
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!query.value.trim()) return;
        document.querySelector('#search-button').disabled = true;
        status.textContent = labels.searching;
        results.replaceChildren();
        try { renderTracks(findTracks(await request('search', { query: query.value.trim() }))); }
        catch (error) { status.textContent = error.message || labels.failed; }
        finally { document.querySelector('#search-button').disabled = false; }
      });
      fetch(root + '/api/config').then(response => response.json()).then(config => {
        requireNickname = !!config.requireNickname;
        blockExplicit = !!config.blockExplicit;
        document.querySelector('#name-row').hidden = !requireNickname;
      }).catch(() => {});
      try { nickname.value = localStorage.getItem('stream-song-request-name') || ''; } catch {}
      nickname.addEventListener('change', () => { try { localStorage.setItem('stream-song-request-name', nickname.value.trim()); } catch {} });
    </script>
  </body>
</html>`;
