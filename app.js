// ═══════════════════════════════════════════════════════════════════
// Gerenciador de Séries e Filmes
// ═══════════════════════════════════════════════════════════════════

const KEY = 'gerenciador_series_v1';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w185';

// Estado: séries e filmes acompanhados
let state = { shows: [], movies: [] };

function byId(id) { return document.getElementById(id) }
function esc(t) { return String(t ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", "&#039;") }

function save() {
 localStorage.setItem(KEY, JSON.stringify(state));
 if (typeof scheduleSyncAfterChange === 'function') scheduleSyncAfterChange();
}

function load() {
 const s = localStorage.getItem(KEY);
 if (s) { try { state = JSON.parse(s) } catch { } }
 if (!state.shows) state.shows = [];
 if (!state.movies) state.movies = [];
}

function getCloudPayload() { return { shows: state.shows, movies: state.movies } }
function getCloudCounts(p) { return `${(p.shows || []).length} séries\n${(p.movies || []).length} filmes` }
function applyCloudPayload(p) { state = { shows: p.shows || [], movies: p.movies || [] }; save(); renderAll() }

function tmdbConfigured() {
 return window.TMDB_API_KEY && !window.TMDB_API_KEY.includes('SUA-CHAVE');
}

// ─── TMDB API ──────────────────────────────────────────────────────
async function tmdbFetch(path) {
 if (!tmdbConfigured()) { alert('Configure sua TMDB_API_KEY no arquivo config.js.'); return null }
 const sep = path.includes('?') ? '&' : '?';
 const res = await fetch(`${TMDB_BASE}${path}${sep}api_key=${window.TMDB_API_KEY}&language=pt-BR`);
 if (!res.ok) throw new Error('Erro na consulta TMDB');
 return res.json();
}

async function searchTMDB() {
 const query = byId('searchInput').value.trim();
 if (!query) return;
 const type = document.querySelector('input[name="searchType"]:checked').value;
 try {
  const data = await tmdbFetch(`/search/${type}?query=${encodeURIComponent(query)}`);
  if (!data) return;
  renderSearchResults(data.results || [], type);
 } catch (err) {
  byId('searchResults').innerHTML = `<div class="empty">Erro ao buscar: ${esc(err.message)}</div>`;
 }
}

byId('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchTMDB() });

function renderSearchResults(results, type) {
 if (!results.length) { byId('searchResults').innerHTML = '<div class="empty">Nenhum resultado encontrado.</div>'; return }
 byId('searchResults').innerHTML = results.slice(0, 20).map(r => {
  const title = r.name || r.title || 'Sem título';
  const year = (r.first_air_date || r.release_date || '').slice(0, 4);
  const poster = r.poster_path ? `${TMDB_IMG}${r.poster_path}` : '';
  const added = type === 'tv' ? state.shows.some(s => s.tmdbId === r.id) : state.movies.some(m => m.tmdbId === r.id);
  return `<div class="show-card" onclick="${type === 'tv' ? `addShow(${r.id})` : `addMovie(${r.id})`}">
   ${poster ? `<img src="${poster}" alt="${esc(title)}">` : '<div style="width:80px;height:120px;background:#e8eef8;border-radius:10px;display:flex;align-items:center;justify-content:center">🎬</div>'}
   <div class="show-card-info">
    <h3>${esc(title)}</h3>
    <p>${year ? year + ' • ' : ''}${type === 'tv' ? 'Série' : 'Filme'}</p>
    <p>${esc((r.overview || '').slice(0, 100))}${(r.overview || '').length > 100 ? '...' : ''}</p>
    ${added ? '<span class="status-tag status-assistindo">Já adicionado</span>' : '<span class="status-tag status-pendente">Toque para adicionar</span>'}
   </div>
  </div>`;
 }).join('');
}

// ─── Adicionar Série ───────────────────────────────────────────────
async function addShow(tmdbId) {
 if (state.shows.some(s => s.tmdbId === tmdbId)) { alert('Série já adicionada.'); return }
 try {
  const data = await tmdbFetch(`/tv/${tmdbId}`);
  if (!data) return;
  const show = {
   tmdbId: data.id,
   name: data.name,
   poster: data.poster_path || '',
   overview: (data.overview || '').slice(0, 300),
   status: data.status, // Returning Series, Ended, Canceled
   totalSeasons: data.number_of_seasons || 0,
   totalEpisodes: data.number_of_episodes || 0,
   firstAir: data.first_air_date || '',
   seasons: [],
   addedAt: new Date().toISOString()
  };
  // Buscar temporadas e episódios
  for (let i = 1; i <= show.totalSeasons; i++) {
   try {
    const sData = await tmdbFetch(`/tv/${tmdbId}/season/${i}`);
    if (sData && sData.episodes) {
     show.seasons.push({
      number: i,
      name: sData.name || `Temporada ${i}`,
      episodes: sData.episodes.map(ep => ({
       number: ep.episode_number,
       name: ep.name || `Episódio ${ep.episode_number}`,
       airDate: ep.air_date || '',
       watched: false
      }))
     });
    }
   } catch { }
  }
  state.shows.push(show);
  save();
  renderAll();
  alert(`"${show.name}" adicionada com ${show.seasons.length} temporada(s).`);
 } catch (err) { alert('Erro ao adicionar série: ' + err.message) }
}

// ─── Adicionar Filme ───────────────────────────────────────────────
async function addMovie(tmdbId) {
 if (state.movies.some(m => m.tmdbId === tmdbId)) { alert('Filme já adicionado.'); return }
 try {
  const data = await tmdbFetch(`/movie/${tmdbId}`);
  if (!data) return;
  const movie = {
   tmdbId: data.id,
   title: data.title,
   poster: data.poster_path || '',
   overview: (data.overview || '').slice(0, 300),
   releaseDate: data.release_date || '',
   runtime: data.runtime || 0,
   watched: false,
   addedAt: new Date().toISOString()
  };
  state.movies.push(movie);
  save();
  renderAll();
  alert(`"${movie.title}" adicionado à lista.`);
 } catch (err) { alert('Erro ao adicionar filme: ' + err.message) }
}

// ─── Classificação das Séries ──────────────────────────────────────
function getShowStatus(show) {
 const total = show.seasons.reduce((s, sea) => s + sea.episodes.length, 0);
 const watched = show.seasons.reduce((s, sea) => s + sea.episodes.filter(e => e.watched).length, 0);
 if (total === 0) return 'assistindo';
 if (watched === total) {
  return (show.status === 'Ended' || show.status === 'Canceled') ? 'finalizado' : 'emdia';
 }
 // Se assistiu todos os episódios disponíveis até agora
 const today = new Date().toISOString().slice(0, 10);
 const availableEps = show.seasons.reduce((s, sea) => s + sea.episodes.filter(e => !e.airDate || e.airDate <= today).length, 0);
 const watchedAvailable = show.seasons.reduce((s, sea) => s + sea.episodes.filter(e => e.watched && (!e.airDate || e.airDate <= today)).length, 0);
 if (availableEps > 0 && watchedAvailable === availableEps) return 'emdia';
 return 'assistindo';
}

function getShowProgress(show) {
 const total = show.seasons.reduce((s, sea) => s + sea.episodes.length, 0);
 const watched = show.seasons.reduce((s, sea) => s + sea.episodes.filter(e => e.watched).length, 0);
 return { total, watched, pending: total - watched };
}

function getPendingEpisodes(show) {
 const today = new Date().toISOString().slice(0, 10);
 let pending = 0;
 show.seasons.forEach(sea => {
  sea.episodes.forEach(ep => {
   if (!ep.watched && (!ep.airDate || ep.airDate <= today)) pending++;
  });
 });
 return pending;
}

// ─── Renderização: Assistindo ──────────────────────────────────────
function renderAssistindo() {
 const shows = state.shows.filter(s => getShowStatus(s) === 'assistindo');
 const totalPending = shows.reduce((s, show) => s + getPendingEpisodes(show), 0);
 byId('totalAssistindo').textContent = shows.length;
 byId('totalPendentes').textContent = totalPending;
 byId('assistindoList').innerHTML = shows.length ? shows.map(s => renderShowCard(s, 'assistindo')).join('') : '<div class="empty">Nenhuma série em andamento.</div>';
}

function renderEmDia() {
 const shows = state.shows.filter(s => getShowStatus(s) === 'emdia');
 byId('totalEmDia').textContent = shows.length;
 byId('emDiaList').innerHTML = shows.length ? shows.map(s => renderShowCard(s, 'emdia')).join('') : '<div class="empty">Nenhuma série em dia.</div>';
}

function renderFinalizados() {
 const shows = state.shows.filter(s => getShowStatus(s) === 'finalizado');
 byId('totalFinalizados').textContent = shows.length;
 byId('finalizadosList').innerHTML = shows.length ? shows.map(s => renderShowCard(s, 'finalizado')).join('') : '<div class="empty">Nenhuma série finalizada.</div>';
}

function renderShowCard(show, statusType) {
 const prog = getShowProgress(show);
 const pending = getPendingEpisodes(show);
 const poster = show.poster ? `${TMDB_IMG}${show.poster}` : '';
 const statusLabels = { assistindo: 'Assistindo', emdia: 'Em dia', finalizado: 'Finalizado' };
 return `<div class="show-card" onclick="openShowDetail(${show.tmdbId})">
  ${poster ? `<img src="${poster}" alt="${esc(show.name)}">` : '<div style="width:80px;height:120px;background:#ede9fe;border-radius:10px;display:flex;align-items:center;justify-content:center">📺</div>'}
  <div class="show-card-info">
   <h3>${esc(show.name)}</h3>
   <p>${prog.watched}/${prog.total} episódios assistidos${pending > 0 ? ` • <strong>${pending} pendente(s)</strong>` : ''}</p>
   <p>${show.totalSeasons} temporada(s) • ${show.firstAir ? show.firstAir.slice(0, 4) : ''}</p>
   <span class="status-tag status-${statusType}">${statusLabels[statusType]}</span>
  </div>
 </div>`;
}

// ─── Renderização: Filmes ──────────────────────────────────────────
function renderFilmes() {
 const pendentes = state.movies.filter(m => !m.watched);
 const assistidos = state.movies.filter(m => m.watched);
 byId('totalFilmesPendentes').textContent = pendentes.length;
 byId('totalFilmesAssistidos').textContent = assistidos.length;

 let html = '';
 if (pendentes.length) {
  html += '<h3 style="margin:0 0 10px;color:#64748b">Para assistir</h3>';
  html += pendentes.map(m => renderMovieCard(m)).join('');
 }
 if (assistidos.length) {
  html += '<h3 style="margin:16px 0 10px;color:#64748b">Assistidos</h3>';
  html += assistidos.map(m => renderMovieCard(m)).join('');
 }
 if (!state.movies.length) html = '<div class="empty">Nenhum filme adicionado. Use a aba Buscar.</div>';
 byId('filmesList').innerHTML = html;
}

function renderMovieCard(movie) {
 const poster = movie.poster ? `${TMDB_IMG}${movie.poster}` : '';
 return `<div class="show-card" onclick="toggleMovie(${movie.tmdbId})">
  ${poster ? `<img src="${poster}" alt="${esc(movie.title)}">` : '<div style="width:80px;height:120px;background:#ede9fe;border-radius:10px;display:flex;align-items:center;justify-content:center">🎬</div>'}
  <div class="show-card-info">
   <h3>${esc(movie.title)}</h3>
   <p>${movie.releaseDate ? movie.releaseDate.slice(0, 4) : ''}${movie.runtime ? ' • ' + movie.runtime + ' min' : ''}</p>
   <p>${esc((movie.overview || '').slice(0, 80))}${(movie.overview || '').length > 80 ? '...' : ''}</p>
   <span class="status-tag ${movie.watched ? 'status-assistido' : 'status-pendente'}">${movie.watched ? '✓ Assistido' : 'Pendente'}</span>
  </div>
 </div>`;
}

function toggleMovie(tmdbId) {
 const m = state.movies.find(x => x.tmdbId === tmdbId);
 if (!m) return;
 m.watched = !m.watched;
 save(); renderFilmes();
}

function removeMovie(tmdbId) {
 if (!confirm('Remover este filme da lista?')) return;
 state.movies = state.movies.filter(m => m.tmdbId !== tmdbId);
 save(); renderFilmes();
}

// ─── Modal de Detalhes da Série ────────────────────────────────────
function openShowDetail(tmdbId) {
 const show = state.shows.find(s => s.tmdbId === tmdbId);
 if (!show) return;
 byId('seriesModalTitle').textContent = show.name;

 let html = '';
 html += `<p class="show-overview">${esc(show.overview)}</p>`;
 html += `<p class="show-meta">${show.totalSeasons} temporada(s) • ${show.totalEpisodes} episódios • ${show.status || ''}</p>`;
 html += `<div class="actions" style="margin-bottom:14px">
  <button onclick="markAllSeasons(${show.tmdbId},true)">✓ Marcar tudo como assistido</button>
  <button class="secondary" onclick="markAllSeasons(${show.tmdbId},false)">Desmarcar tudo</button>
  <button class="secondary" onclick="updateShowData(${show.tmdbId})">↻ Atualizar dados</button>
  <button class="secondary" style="background:#fee2e2;color:#991b1b" onclick="removeShow(${show.tmdbId})">Remover série</button>
 </div>`;

 show.seasons.forEach(sea => {
  const watched = sea.episodes.filter(e => e.watched).length;
  const total = sea.episodes.length;
  html += `<div class="season-header" onclick="toggleSeasonView(this)">
   <h3>${esc(sea.name)}</h3>
   <span class="season-progress">${watched}/${total}</span>
  </div>`;
  html += `<div class="season-actions">
   <button onclick="markSeason(${show.tmdbId},${sea.number},true)">Marcar todos</button>
   <button class="secondary" onclick="markSeason(${show.tmdbId},${sea.number},false)">Desmarcar todos</button>
  </div>`;
  html += '<div class="episode-list">';
  sea.episodes.forEach(ep => {
   html += `<div class="episode-item ${ep.watched ? 'watched' : ''}">
    <input type="checkbox" ${ep.watched ? 'checked' : ''} onchange="toggleEpisode(${show.tmdbId},${sea.number},${ep.number})">
    <div class="ep-info">
     <strong>E${String(ep.number).padStart(2, '0')} — ${esc(ep.name)}</strong>
     <p>${ep.airDate || 'Data não informada'}</p>
    </div>
   </div>`;
  });
  html += '</div>';
 });

 byId('seriesModalContent').innerHTML = html;
 byId('seriesModal').classList.add('show');
}

function closeSeriesModal() { byId('seriesModal').classList.remove('show') }

function toggleSeasonView(header) {
 // Poderia colapsar, mas mantém simples
}

function toggleEpisode(showId, seasonNum, epNum) {
 const show = state.shows.find(s => s.tmdbId === showId);
 if (!show) return;
 const season = show.seasons.find(s => s.number === seasonNum);
 if (!season) return;
 const ep = season.episodes.find(e => e.number === epNum);
 if (!ep) return;
 ep.watched = !ep.watched;
 save(); openShowDetail(showId); renderAll();
}

function markSeason(showId, seasonNum, watched) {
 const show = state.shows.find(s => s.tmdbId === showId);
 if (!show) return;
 const season = show.seasons.find(s => s.number === seasonNum);
 if (!season) return;
 season.episodes.forEach(ep => ep.watched = watched);
 save(); openShowDetail(showId); renderAll();
}

function removeShow(tmdbId) {
 if (!confirm('Remover esta série e todo o progresso?')) return;
 state.shows = state.shows.filter(s => s.tmdbId !== tmdbId);
 save(); closeSeriesModal(); renderAll();
}

function markAllSeasons(showId, watched) {
 const show = state.shows.find(s => s.tmdbId === showId);
 if (!show) return;
 show.seasons.forEach(sea => sea.episodes.forEach(ep => ep.watched = watched));
 save(); openShowDetail(showId); renderAll();
}

// ─── Atualizar dados da série (novos episódios) ────────────────────
async function updateShowData(tmdbId) {
 const show = state.shows.find(s => s.tmdbId === tmdbId);
 if (!show) return;
 try {
  const data = await tmdbFetch(`/tv/${tmdbId}`);
  if (!data) return;
  show.name = data.name;
  show.poster = data.poster_path || show.poster;
  show.overview = (data.overview || '').slice(0, 300);
  show.status = data.status;
  show.totalSeasons = data.number_of_seasons || show.totalSeasons;
  show.totalEpisodes = data.number_of_episodes || show.totalEpisodes;

  // Atualizar/adicionar temporadas novas
  for (let i = 1; i <= show.totalSeasons; i++) {
   try {
    const sData = await tmdbFetch(`/tv/${tmdbId}/season/${i}`);
    if (!sData || !sData.episodes) continue;
    const existing = show.seasons.find(s => s.number === i);
    if (existing) {
     // Adicionar episódios novos mantendo watched dos existentes
     sData.episodes.forEach(ep => {
      const existingEp = existing.episodes.find(e => e.number === ep.episode_number);
      if (!existingEp) {
       existing.episodes.push({
        number: ep.episode_number,
        name: ep.name || `Episódio ${ep.episode_number}`,
        airDate: ep.air_date || '',
        watched: false
       });
      } else {
       existingEp.name = ep.name || existingEp.name;
       existingEp.airDate = ep.air_date || existingEp.airDate;
      }
     });
    } else {
     show.seasons.push({
      number: i,
      name: sData.name || `Temporada ${i}`,
      episodes: sData.episodes.map(ep => ({
       number: ep.episode_number,
       name: ep.name || `Episódio ${ep.episode_number}`,
       airDate: ep.air_date || '',
       watched: false
      }))
     });
    }
   } catch { }
  }
  save(); openShowDetail(tmdbId); renderAll();
  alert('Dados atualizados.');
 } catch (err) { alert('Erro ao atualizar: ' + err.message) }
}

// ─── Verificar Novidades ───────────────────────────────────────────
async function checkNewEpisodes() {
 const today = new Date().toISOString().slice(0, 10);
 const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
 let novidades = [];

 // Para séries que estão "assistindo" ou "em dia", verificar eps recentes
 const activeShows = state.shows.filter(s => {
  const st = getShowStatus(s);
  return st === 'assistindo' || st === 'emdia';
 });

 activeShows.forEach(show => {
  show.seasons.forEach(sea => {
   sea.episodes.forEach(ep => {
    if (ep.airDate && ep.airDate >= sevenDaysAgo && ep.airDate <= today && !ep.watched) {
     novidades.push({ show: show.name, showId: show.tmdbId, season: sea.number, episode: ep.number, name: ep.name, airDate: ep.airDate });
    }
   });
  });
 });

 novidades.sort((a, b) => b.airDate.localeCompare(a.airDate));

 if (!novidades.length) {
  byId('novidadesList').innerHTML = '<div class="empty">Nenhum episódio novo nos últimos 7 dias para suas séries.</div>';
  // Tentar atualizar dados das séries ativas
  if (activeShows.length && tmdbConfigured()) {
   if (confirm('Deseja atualizar os dados das séries para verificar novos episódios?')) {
    for (const show of activeShows.slice(0, 5)) {
     await updateShowData(show.tmdbId);
    }
    checkNewEpisodes();
   }
  }
  return;
 }

 byId('novidadesList').innerHTML = novidades.map(n =>
  `<div class="novidade-item" onclick="openShowDetail(${n.showId})">
   <h4>${esc(n.show)}</h4>
   <p>S${String(n.season).padStart(2, '0')}E${String(n.episode).padStart(2, '0')} — ${esc(n.name)}</p>
   <p>Exibido em ${n.airDate}</p>
  </div>`
 ).join('');

 // Notificação se suportada
 if ('Notification' in window && Notification.permission === 'granted' && novidades.length) {
  new Notification('Novos episódios!', { body: `${novidades.length} episódio(s) novo(s) nas suas séries.`, icon: 'icon-192.png' });
 }
}

// Pedir permissão de notificação
function requestNotificationPermission() {
 if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
 }
}

// ─── Tabs ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
 document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
 document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
 b.classList.add('active');
 byId(b.dataset.tab).classList.add('active');
 if (b.dataset.tab === 'sincronizacao') renderCloudPanel();
});

// ─── Render All ────────────────────────────────────────────────────
function renderAll() {
 renderAssistindo();
 renderEmDia();
 renderFinalizados();
 renderFilmes();
}

// ─── Inicialização ─────────────────────────────────────────────────
load();
renderAll();
renderCloudPanel();
requestNotificationPermission();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

// Inicializar sync
if (!navigator.onLine) { updateSyncStatus('offline') }
loadSyncQueue();
