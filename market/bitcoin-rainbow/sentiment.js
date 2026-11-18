/* TREE Market Insights — read-only CryptoKeyhole Fear & Greed panel.
 * Provider: https://cryptokeyhole.com/fear-and-greed-index/api/
 * Public feed, CC BY 4.0 with visible attribution. No secrets or Netlify functions.
 * No guessed scores, invented historical prices, or automated orders.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const ROOT = 'https://cryptokeyhole.com';
  const API = ROOT + '/api/v1/fear-and-greed';
  const sources = {
    sui: { coin: 'sui', name: 'SUI', page: ROOT + '/fear-and-greed-index/sui/' },
    btc: { coin: 'btc', name: 'Bitcoin', page: ROOT + '/fear-and-greed-index/btc/' },
    market: { coin: 'market', name: 'Crypto market', page: ROOT + '/fear-and-greed-index/' }
  };
  const colors = { 'extreme-fear': '#e76b77', fear: '#f1a365', neutral: '#efd36e', greed: '#7cda9f', 'extreme-greed': '#34d399' };
  const state = {
    active: 'sui',
    range: 30,
    showMA: false,
    response: Object.create(null),
    loadedLimit: Object.create(null),
    pending: Object.create(null),
    initialized: false,
    lastRequest: Object.create(null),
    staleHours: 6
  };
  const validScore = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  const fmtDate = iso => {
    if (!iso || !Number.isFinite(Date.parse(iso))) return 'Unknown date';
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
  };
  const fmtTime = iso => {
    if (!iso || !Number.isFinite(Date.parse(iso))) return 'Date unavailable';
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', hour12: false }).format(new Date(iso)) + ' UTC';
  };
  const formatPoints = delta => Number.isFinite(delta) ? (delta > 0 ? '+' : '') + delta.toFixed(0) + ' pts' : 'Not available';
  const bandLabel = band => ({
    'extreme-fear': 'Extreme Fear', fear: 'Fear', neutral: 'Neutral', greed: 'Greed', 'extreme-greed': 'Extreme Greed'
  }[band] || 'Unclassified');
  const bandFromScore = value => value < 25 ? 'extreme-fear' : value < 45 ? 'fear' : value <= 55 ? 'neutral' : value <= 75 ? 'greed' : 'extreme-greed';
  const ageHours = iso => (Date.now() - Date.parse(iso)) / 3_600_000;
  const clean = value => Number.isFinite(Number(value)) ? Number(value) : NaN;
  const observationDate = data => {
    if (typeof data?.asOf === 'string' && Number.isFinite(Date.parse(data.asOf))) return data.asOf;
    if (Number.isFinite(Number(data?.timestamp))) return new Date(Number(data.timestamp) * 1000).toISOString();
    return null;
  };
  const required = data => {
    if (!data || typeof data !== 'object' || !validScore(data.value)) return false;
    const date = observationDate(data);
    return date && ageHours(date) >= -1 && typeof data.label === 'string';
  };
  const setStatus = (message, type = 'info') => {
    const target = $('mi-sentiment-status');
    if (!target) return;
    target.textContent = message;
    target.dataset.state = type;
  };
  const dataFor = asset => state.response[asset] || null;
  const officialUrl = (asset, limit) => API + '?coin=' + encodeURIComponent(asset) + '&limit=' + limit;
  const latestHistory = data => Array.isArray(data?.history) ? data.history.filter(row =>
    row && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && validScore(row.value) &&
    row.date <= new Date().toISOString().slice(0, 10)
  ).sort((a, b) => a.date.localeCompare(b.date)) : [];

  async function request(asset, limit, { force = false } = {}) {
    if (!sources[asset]) throw Error('Unknown asset');
    const previous = state.response[asset];
    if (!force && previous && state.loadedLimit[asset] >= limit) return previous;
    const key = asset + ':' + limit;
    if (state.pending[key]) return state.pending[key];
    const task = (async () => {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 12000);
      try {
        const res = await fetch(officialUrl(asset, limit), { signal: ctrl.signal, mode: 'cors', credentials: 'omit', cache: 'default' });
        if (!res.ok) throw Error('HTTP ' + res.status);
        const raw = await res.json();
        if (!required(raw)) throw Error('Invalid provider observation');
        if (asset !== 'market' && raw.coin && String(raw.coin).toLowerCase() !== asset) throw Error('Unexpected asset in response');
        if (limit > 20 && !Array.isArray(raw.history)) throw Error('No historical series supplied');
        state.response[asset] = raw;
        state.loadedLimit[asset] = limit;
        state.lastRequest[asset] = Date.now();
        return raw;
      } finally {
        clearTimeout(timeout);
        delete state.pending[key];
      }
    })();
    state.pending[key] = task;
    return task;
  }
  function updateCards() {
    for (const asset of ['sui', 'btc', 'market']) {
      const card = $('mi-sentiment-card-' + asset);
      const score = $('mi-sentiment-card-score-' + asset);
      const label = $('mi-sentiment-card-label-' + asset);
      const date = $('mi-sentiment-card-date-' + asset);
      if (!card || !score || !label || !date) continue;
      const data = dataFor(asset);
      const active = asset === state.active;
      card.setAttribute('aria-pressed', String(active));
      card.classList.toggle('selected', active);
      if (!data) {
        score.textContent = '—';
        label.textContent = 'Reading unavailable';
        date.textContent = 'Not verified';
        card.style.removeProperty('--mi-sentiment-band');
        continue;
      }
      const band = colors[data.band] ? data.band : bandFromScore(data.value);
      score.textContent = String(data.value);
      label.textContent = bandLabel(band);
      date.textContent = fmtTime(observationDate(data));
      card.style.setProperty('--mi-sentiment-band', colors[band]);
    }
    const sui = dataFor('sui'), btc = dataFor('btc');
    const spread = $('mi-sentiment-spread');
    if (spread) spread.textContent = sui && btc ?
      'SUI − BTC sentiment: ' + formatPoints(sui.value - btc.value) + ' (separately timestamped observations)' :
      'SUI vs BTC comparison available after both readings load.';
  }
  function updateDetails() {
    const data = dataFor(state.active);
    const source = sources[state.active];
    $('mi-sentiment-selected-name').textContent = source.name + ' sentiment';
    $('mi-sentiment-source-link').href = source.page;
    const summary = $('mi-sentiment-summary');
    if (!data) {
      $('mi-sentiment-number').textContent = '—';
      $('mi-sentiment-label').textContent = 'Unavailable';
      $('mi-sentiment-asof').textContent = 'No verified observation';
      $('mi-sentiment-previous').textContent = 'Yesterday: — · Seven days ago: —';
      $('mi-sentiment-meter').style.left = '0%';
      summary.textContent = 'Source data unavailable. No sentiment score is inferred.';
      $('mi-sentiment-components').replaceChildren();
      $('mi-sentiment-breakdown').textContent = 'No component observations available.';
      $('mi-sentiment-chart-meta').textContent = 'No historical data loaded';
      $('mi-sentiment-svg').replaceChildren();
      $('mi-sentiment-recent').replaceChildren();
      $('mi-sentiment-episodes').textContent = 'Unavailable';
      return;
    }
    const obs = observationDate(data), hours = ageHours(obs);
    const band = colors[data.band] ? data.band : bandFromScore(data.value);
    $('mi-sentiment-number').textContent = String(data.value);
    $('mi-sentiment-label').textContent = bandLabel(band);
    $('mi-sentiment-label').style.color = colors[band];
    $('mi-sentiment-meter').style.left = Math.max(0, Math.min(100, data.value)) + '%';
    $('mi-sentiment-asof').textContent = 'As of ' + fmtTime(obs) +
      (data.status === 'open' ? ' · Partial / intraday' : data.status === 'closed' ? ' · Final UTC day' : '') +
      (data.delayed ? ' · Provider reports delayed input' : '');
    const previous = data.previous || {};
    const yesterday = validScore(previous.yesterday?.value) ? data.value - previous.yesterday.value : NaN;
    const lastWeek = validScore(previous.lastWeek?.value) ? data.value - previous.lastWeek.value : NaN;
    $('mi-sentiment-previous').textContent = 'Vs yesterday: ' + formatPoints(yesterday) +
      ' · Vs 7 days ago: ' + formatPoints(lastWeek);
    summary.textContent = (hours > state.staleHours ? 'Warning: the latest provider observation is older than six hours. ' : '') +
      (data.status === 'open' ? 'Today’s reading is provisional and can change as new hourly data arrives. ' :
      'This reading is marked final for its UTC day. ') +
      (state.active === 'sui' ? 'SUI token sentiment is not a measurement of TREE token sentiment or on-chain Sui activity.' :
       state.active === 'market' ? 'The market score is CryptoKeyhole’s own weighted composite, not the Alternative.me index.' :
       'Bitcoin sentiment is measured by CryptoKeyhole’s asset-specific methodology.');
    renderComponents(data);
    renderHistory(data);
  }
  function renderComponents(data) {
    const mount = $('mi-sentiment-components');
    mount.replaceChildren();
    const rows = Array.isArray(data.components) ? data.components.filter(x =>
      x && typeof x.name === 'string' && validScore(x.score) && Number.isFinite(Number(x.weight)) &&
      Number(x.weight) >= 0 && Number(x.weight) <= 100
    ) : [];
    if (!rows.length) {
      $('mi-sentiment-breakdown').textContent = 'Component data unavailable from the provider.';
      return;
    }
    $('mi-sentiment-breakdown').textContent = rows.length + ' available components · source-supplied scores and weights';
    rows.sort((a, b) => Number(b.weight) - Number(a.weight));
    for (const row of rows) {
      const item = document.createElement('div');
      item.className = 'mi-sentiment-component';
      const top = document.createElement('div');
      top.className = 'mi-sentiment-component-top';
      const name = document.createElement('strong'); name.textContent = row.name;
      const details = document.createElement('span');
      details.textContent = Math.round(row.score) + '/100 · ' + Number(row.weight).toFixed(0) + '% weight';
      top.append(name, details);
      const track = document.createElement('div'); track.className = 'mi-sentiment-component-track';
      const fill = document.createElement('div'); fill.className = 'mi-sentiment-component-fill';
      fill.style.width = row.score + '%';
      fill.style.background = colors[bandFromScore(row.score)];
      track.appendChild(fill);
      item.append(top, track);
      mount.appendChild(item);
    }
  }
  function drawChart(points, allPoints) {
    const svg = $('mi-sentiment-svg');
    svg.replaceChildren();
    if (points.length < 2) {
      $('mi-sentiment-chart-meta').textContent = 'Not enough observations for this range.';
      return;
    }
    const NS = 'http://www.w3.org/2000/svg';
    const W = 700, H = 230, x0 = 34, x1 = 680, y0 = 19, y1 = 194;
    const start = Date.parse(points[0].date + 'T00:00:00Z');
    const finish = Date.parse(points.at(-1).date + 'T00:00:00Z');
    const x = date => x0 + (Date.parse(date + 'T00:00:00Z') - start) / Math.max(1, finish - start) * (x1 - x0);
    const y = v => y1 - (v / 100) * (y1 - y0);
    const make = (tag, attrs) => {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
      return el;
    };
    for (const value of [0, 25, 50, 75, 100]) {
      const line = make('line', {x1:x0,x2:x1,y1:y(value),y2:y(value),stroke:'rgba(165,192,198,.20)','stroke-dasharray':'4 6'});
      svg.appendChild(line);
      const label = make('text',{x:2,y:y(value)+4,fill:'#a7bac1','font-size':12});
      label.textContent = String(value);svg.appendChild(label);
    }
    const line = make('polyline',{
      points:points.map(p=>x(p.date).toFixed(1)+','+y(p.value).toFixed(1)).join(' '),
      fill:'none',stroke:'#38e3ae','stroke-width':3.3,'stroke-linecap':'round','stroke-linejoin':'round'
    });
    svg.appendChild(line);
    if (state.showMA) {
      const sums = new Map();
      let sum = 0;
      for (let i = 0; i < allPoints.length; i++) {
        sum += allPoints[i].value;
        if (i >= 100) sum -= allPoints[i - 100].value;
        if (i >= 99) sums.set(allPoints[i].date, sum / 100);
      }
      const ma = points.filter(p => sums.has(p.date));
      if (ma.length >= 2) svg.appendChild(make('polyline',{
        points:ma.map(p=>x(p.date).toFixed(1)+','+y(sums.get(p.date)).toFixed(1)).join(' '),
        fill:'none',stroke:'#ffda70','stroke-width':2,'stroke-dasharray':'8 6'
      }));
    }
    // Every point is inspectable via SVG native tooltips; label end points for touch.
    const last = points.at(-1);
    const dot = make('circle',{cx:x(last.date),cy:y(last.value),r:5,fill:'#ffda70',stroke:'#06141c','stroke-width':2});
    const title = make('title');
    title.textContent = last.date + ' UTC · ' + last.value + '/100 · ' + bandLabel(colors[last.band] ? last.band : bandFromScore(last.value));
    dot.appendChild(title);svg.appendChild(dot);
    for (const p of points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 40)) === 0)) {
      const marker = make('circle',{cx:x(p.date),cy:y(p.value),r:5,fill:'transparent'});
      const tip = make('title');tip.textContent = p.date + ' UTC · ' + p.value + '/100';
      marker.appendChild(tip);svg.appendChild(marker);
    }
    const axis = make('text',{x:x0,y:H-10,fill:'#a7bac1','font-size':12});
    axis.textContent = fmtDate(points[0].date + 'T00:00:00Z');
    svg.appendChild(axis);
    const axisEnd = make('text',{x:x1,y:H-10,fill:'#a7bac1','font-size':12,'text-anchor':'end'});
    axisEnd.textContent = fmtDate(last.date + 'T00:00:00Z');svg.appendChild(axisEnd);
    $('mi-sentiment-chart-meta').textContent =
      points.length + ' provider observations · ' + fmtDate(points[0].date+'T00:00:00Z') +
      '–' + fmtDate(last.date+'T00:00:00Z') + (state.showMA ? ' · dashed line: trailing 100-day average' : '');
  }
  function renderHistory(data) {
    const rows = latestHistory(data);
    const selected = rows.slice(-state.range);
    drawChart(selected, rows);
    const recent = $('mi-sentiment-recent');recent.replaceChildren();
    for(const day of rows.slice(-7).reverse()) {
      const li = document.createElement('li');
      li.textContent = fmtDate(day.date+'T00:00:00Z') + ': ' + day.value + '/100 ' +
        (typeof day.label === 'string' ? day.label : bandLabel(bandFromScore(day.value))) +
        (day.status === 'open' ? ' (partial)' : '');
      recent.appendChild(li);
    }
    const frequencies = {'extreme-fear':0,fear:0,neutral:0,greed:0,'extreme-greed':0};
    for(const day of selected) frequencies[colors[day.band] ? day.band : bandFromScore(day.value)]++;
    $('mi-sentiment-episodes').textContent = selected.length ?
      'Within the displayed '+selected.length+' observations: ' +
      Object.entries(frequencies).map(([band,count])=>bandLabel(band)+' '+count+' day'+(count===1?'':'s')).join(' · ') + '.' :
      'No valid observations in this period.';
  }
  async function load(asset, limit, force = false) {
    try {
      await request(asset, limit, {force});
    } catch (error) {
      if(!dataFor(asset)) {
        $('mi-sentiment-card-label-'+asset).textContent = 'Unavailable';
        setStatus('Could not retrieve the official '+sources[asset].name+' sentiment feed. Check connection or retry. No fallback estimates are shown.','error');
      } else {
        setStatus('Refresh failed; last successful observation remains labeled with its original timestamp.','warning');
      }
    } finally {
      updateCards();
      if(asset === state.active) updateDetails();
    }
  }
  async function activate(asset) {
    if (!sources[asset]) return;
    state.active = asset;
    updateCards();
    updateDetails();
    const have = state.loadedLimit[asset] || 0;
    if (have < 366) {
      setStatus('Loading full '+sources[asset].name+' historical sentiment series…');
      await load(asset, 366);
    } else {
      const data = dataFor(asset);
      const old = data ? ageHours(observationDate(data)) > state.staleHours : true;
      setStatus(old ? 'Observation is older than six hours; refresh to check for new data.' :
        'Provider observation loaded. '+(data.status === 'open'?'Current UTC day is provisional.':'UTC daily observation is final.'),old?'warning':'ok');
    }
  }
  async function initial() {
    if(state.initialized) return;
    state.initialized = true;
    setStatus('Fetching official SUI, Bitcoin and crypto-market sentiment…');
    updateCards();
    // The SUI history loads only once, while BTC and Market initially use 8 rows.
    await Promise.allSettled([
      load('sui',366),load('btc',8),load('market',8)
    ]);
    await activate(state.active);
  }

  $$('[data-sentiment-asset]').forEach(button=>button.addEventListener('click',()=>activate(button.dataset.sentimentAsset)));
  $$('[data-sentiment-range]').forEach(button=>button.addEventListener('click',()=>{
    const range = Number(button.dataset.sentimentRange);
    if(![7,30,90,365].includes(range))return;
    state.range = range;
    $('[data-sentiment-range]').forEach(el=>{ el.setAttribute('aria-pressed',String(el===button)); el.classList.toggle('selected',el===button); });
    const data=dataFor(state.active);
    if(data && state.loadedLimit[state.active]>=range) renderHistory(data);
    else activate(state.active);
  }));
  $('mi-sentiment-ma')?.addEventListener('change',event=>{
    state.showMA=Boolean(event.target.checked);
    if(dataFor(state.active))renderHistory(dataFor(state.active));
  });
  $('mi-sentiment-refresh')?.addEventListener('click',async()=>{
    setStatus('Refreshing the source readings…');
    await Promise.allSettled(['sui','btc','market'].map(asset => load(asset, Math.max(asset === 'sui' ? 366 : 8, state.loadedLimit[asset] || 0), true)));
    setStatus('Refresh attempted. Check each card’s as-of date and any unavailable readings.');
  });
  const summaryText=()=>{
    const names=['sui','btc','market'];
    const lines=['TREE Market Insights — Fear & Greed','Source: CryptoKeyhole (CC BY 4.0)'];
    for(const asset of names) {
      const data=dataFor(asset);
      lines.push(sources[asset].name+': '+(data ?
        data.value+'/100 '+bandLabel(colors[data.band] ? data.band : bandFromScore(data.value))+
        ' · '+fmtTime(observationDate(data))+' ('+(data.status==='open'?'provisional':'final')+')' :
        'no verified reading'));
    }
    lines.push('SUI token sentiment is not TREE sentiment. Different providers use different methodologies.');
    lines.push('tree-token.xyz · Historical context, not financial advice.');
    return lines.join('\n');
  };
  $('mi-sentiment-copy')?.addEventListener('click',async()=>{
    const btn=$('mi-sentiment-copy');
    try {
      await navigator.clipboard.writeText(summaryText());
      btn.textContent='Copied';
    } catch {
      btn.textContent='Copy unavailable: browser permission required';
    }
  });
  $('mi-sentiment-share')?.addEventListener('click',()=>{
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1080;
    const cx=canvas.getContext('2d');if(!cx)return;
    const gradient=cx.createLinearGradient(0,0,1080,1080);
    gradient.addColorStop(0,'#050714');gradient.addColorStop(1,'#0a2b29');
    cx.fillStyle=gradient;cx.fillRect(0,0,1080,1080);
    cx.fillStyle='#34d399';cx.fillRect(68,78,9,120);
    cx.fillStyle='#ffd166';cx.font='bold 48px system-ui';cx.fillText('TREE MARKET INSIGHTS',100,125);
    cx.fillStyle='#edf9f5';cx.font='bold 68px system-ui';cx.fillText('CRYPTO FEAR',70,256);cx.fillText('& GREED',70,343);
    const boxes=[['sui','SUI'],['btc','BITCOIN'],['market','CRYPTO MARKET']];
    for(let i=0;i<boxes.length;i++){
      const [coin,label]=boxes[i],d=dataFor(coin),yy=438+i*147;
      cx.fillStyle='rgba(10,33,36,.92)';cx.fillRect(68,yy,944,130);
      cx.fillStyle='#34d399';cx.font='bold 30px system-ui';cx.fillText(label,100,yy+44);
      cx.fillStyle='#f4fbff';cx.font='bold 52px system-ui';
      cx.fillText(d?d.value+'/100':'Unavailable',100,yy+103);
      cx.fillStyle='#aeb7cc';cx.font='24px system-ui';
      cx.fillText(d?bandLabel(colors[d.band]?d.band:bandFromScore(d.value)):'No verified data',470,yy+98);
    }
    const main=dataFor('sui');
    cx.fillStyle='#aeb7cc';cx.font='25px system-ui';
    cx.fillText('SUI as of: '+(main?fmtTime(observationDate(main)):'unavailable'),72,927);
    cx.font='22px system-ui';
    cx.fillText('Source: CryptoKeyhole · CC BY 4.0 · cryptokeyhole.com',72,971);
    cx.fillText('tree-token.xyz · Educational only · Not a forecast',72,1008);
    canvas.toBlob(blob=>{
      if(!blob)return;
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.download='tree-market-fear-greed.png';a.href=url;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    },'image/png');
  });

  document.addEventListener('tree-market-tab-change',event=>{
    if(event.detail?.id === 'sentiment')initial();
  });
  // Defer scripts initialize in DOM order: if this is the default selected tab,
  // the earlier tab activation event happened before our listener registered.
  if ($('mi-tab-sentiment')?.getAttribute('aria-selected') === 'true') initial();
})();