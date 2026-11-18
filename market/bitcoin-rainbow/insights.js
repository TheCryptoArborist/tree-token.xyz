/* TREE Market Insights: isolated, read-only UI. Values are provider-owned or
   explicitly labeled historical observations/hypothetical calculations.
   No wallet connection, transactions, secrets or Netlify Function calls. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  // Progressive enhancement: all guide sections remain readable without JS.
  // Guide tabs are independent of the Market Explorer and never reload its iframe.
  const rainbowTabs = $$('[data-rb-tab]');
  const rainbowGuide = $('rb-guide-tabs');
  if (rainbowGuide && rainbowTabs.length) {
    const selectGuide = name => {
      rainbowTabs.forEach(tab => {
        const selected = tab.dataset.rbTab === name;
        const panel = $('rb-panel-' + tab.dataset.rbTab);
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panel.hidden = !selected;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        panel.tabIndex = 0;
      });
    };
    rainbowTabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectGuide(tab.dataset.rbTab));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? rainbowTabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + rainbowTabs.length) % rainbowTabs.length;
        selectGuide(rainbowTabs[next].dataset.rbTab);
        rainbowTabs[next].focus();
      });
    });
    selectGuide('bands');
    rainbowGuide.hidden = false;
  }
  const fmtMoney = v => Number.isFinite(v) ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v) : '—';
  const fmtDate = s => new Date(s*1000).toLocaleDateString('en-US',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'});
  const tvSymbols = {
    TOTAL:['CRYPTOCAP:TOTAL','Top-125 crypto market capitalization, including Bitcoin, Ethereum and stablecoins.'],
    TOTAL2:['CRYPTOCAP:TOTAL2','Top-125 cryptocurrency capitalization, excluding Bitcoin.'],
    TOTAL3:['CRYPTOCAP:TOTAL3','Top-125 cryptocurrency capitalization, excluding Bitcoin and Ethereum; stablecoins remain included.'],
    TOTAL3ES:['CRYPTOCAP:TOTAL3ES','Top-125 crypto capitalization excluding BTC, ETH, and stablecoins. Earlier stablecoin exclusions have methodological limits.'],
    BTCD:['CRYPTOCAP:BTC.D','Bitcoin dominance: Bitcoin capitalization as a percentage of TradingView’s tracked TOTAL capitalization.']
  };
  const onchain = {
    mvrv: {
      embed:'https://axeladlerjr.com/charts/bitcoin-mvrv-ratio/embed.html',
      source:'https://axeladlerjr.com/charts/bitcoin-mvrv-ratio/',
      chartTitle:'MVRV ratio', title:'MVRV: price compared with estimated cost',
      description:'MVRV means Market Value to Realized Value. It compares Bitcoin’s market price with realized price (the estimated holder cost). A reading of 1 means those prices are equal; the reading is a ratio, not a dollar price.',
      reading:'Read MVRV on the right-hand axis. Bitcoin’s dollar price uses the left-hand axis. Above 1 means price is above estimated cost; below 1 means it is below.'
    },
    realized: {
      embed:'https://axeladlerjr.com/charts/bitcoin-realized-price/embed.html',
      source:'https://axeladlerjr.com/charts/bitcoin-realized-price/',
      chartTitle:'Realized Price', title:'Realized Price: estimated cost in dollars',
      description:'Each amount of BTC is valued at the market price when it last moved, then those values are averaged across the supply. This estimates holder cost; it cannot show exactly what every owner paid.',
      reading:'Compare Bitcoin’s market-price line with the realized-price line on the same date. The gap shows how far market price is above or below the estimated cost.'
    }
  };
  const reference = {
    '2018':['2018 bear-market bottom',19280,3232,'83.2%','364 days','2018 prices are historical. This particular BlockchainCenter Rainbow Chart had not yet been published; no real-time signal is implied.'],
    '2022':['2022 bear-market bottom',67562,15760,'76.7%','378 days','Comparisons use reported daily observations, not a proven first Rainbow-band entry date. The 2022 formula changed in November.'],
    '2026':['2026 low observed by July 1',124777,58534,'53.1%','Reference through July 1, 2026','The date is a historical snapshot, not a prediction or confirmation of the final 2026 bottom.']
  };
  // Public indicative BTC/USD feed. Its time is a provider feed-update timestamp,
  // not an exchange trade time. Fetching never replaces that timestamp with now.
  const BTC_PRICE_URL='https://mempool.space/api/v1/prices';
  const BTC_PRICE_REFRESH_MS=5*60*1000, BTC_PRICE_MAX_AGE_MS=2*60*60*1000;
  let selectedCycle='2022', btcQuote=null, btcQuotePending=false, btcQuoteAttempt=0, btcQuoteError='';
  const quoteTime = ms => new Intl.DateTimeFormat('en-US',{
    timeZone:'UTC',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).format(new Date(ms))+' UTC';
  const quoteIsFresh = (quote,now=Date.now()) => !!quote && quote.updatedAt<=now+5*60*1000 && now-quote.updatedAt<=BTC_PRICE_MAX_AGE_MS;
  const indicatorNames=['Pi','RUPL','RHODL','Puell','2Y','Trolololo','MVRV','Reserve','TopCap'];
  let selectedMarket='TOTAL3', lastMarket='', selectedOnchain='realized', lastOnchain='', fetchedCBBI=false, cbbiData=null, cbbiNewest=null, chartRange=365;
  const setPressed=(selector,datasetKey,current)=>{
    $$(selector).forEach(el=>{
      const active=el.dataset[datasetKey]===current;
      el.classList.toggle('selected',active);
      el.setAttribute('aria-pressed',String(active));
    });
  };

  function loadMarket() {
    const stage=$('mi-tv-stage');
    if(!stage)return;
    const entry=tvSymbols[selectedMarket];
    setPressed('[data-tv-symbol]','tvSymbol',selectedMarket);
    $('mi-market-description').textContent=entry[1];
    if(lastMarket===selectedMarket)return;
    lastMarket=selectedMarket;
    stage.replaceChildren();
    const host=document.createElement('div');
    host.className='tradingview-widget-container';
    host.style.height='100%';host.style.width='100%';
    const widget=document.createElement('div');
    widget.className='tradingview-widget-container__widget';
    widget.style.height='calc(100% - 32px)'; widget.style.width='100%';
    host.appendChild(widget);
    const credit=document.createElement('div'); credit.className='tradingview-widget-copyright';
    const creditLink=document.createElement('a');
    creditLink.href='https://www.tradingview.com/symbols/CRYPTOCAP-'+(selectedMarket==='BTCD'?'BTC.D':selectedMarket)+'/';
    creditLink.target='_blank';creditLink.rel='noopener noreferrer';
    creditLink.textContent='Chart by TradingView';
    credit.appendChild(creditLink);host.appendChild(credit);
    const script=document.createElement('script');
    script.async=true;script.type='text/javascript';
    script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.textContent=JSON.stringify({
      autosize:true,symbol:entry[0],interval:'D',timezone:'Etc/UTC',
      theme:'dark',style:'1',locale:'en',backgroundColor:'#050714',
      gridColor:'rgba(174,183,204,0.08)',hide_side_toolbar:true,
      hide_top_toolbar:false,hide_legend:false,hide_volume:true,
      allow_symbol_change:false,withdateranges:true,calendar:false,
      save_image:false,support_host:'https://www.tradingview.com'
    });
    $('mi-tv-status').textContent='Loading provider-hosted chart…';
    script.onerror=()=>{$('mi-tv-status').textContent='TradingView script unavailable; no prices are substituted.';};
    script.onload=()=>{$('mi-tv-status').textContent='Interactive chart and dates supplied by TradingView.';};
    host.appendChild(script);stage.appendChild(host);
  }
  $$('[data-tv-symbol]').forEach(button=>button.addEventListener('click',()=>{
    if(!tvSymbols[button.dataset.tvSymbol])return;
    selectedMarket=button.dataset.tvSymbol;loadMarket();
  }));

  function loadOnchain() {
    const entry=onchain[selectedOnchain],stage=$('mi-onchain-stage');
    if(!stage||!entry)return;
    setPressed('[data-onchain]','onchain',selectedOnchain);
    $('mi-onchain-title').textContent=entry.title;
    $('mi-onchain-description').textContent=entry.description;
    $('mi-onchain-reading').textContent=entry.reading;
    $('mi-onchain-credit').href=entry.source;
    $$('[data-onchain-guide]').forEach(guide=>{guide.hidden=guide.dataset.onchainGuide!==selectedOnchain;});
    if(lastOnchain===selectedOnchain)return;
    lastOnchain=selectedOnchain;
    stage.replaceChildren();
    const frame=document.createElement('iframe');
    frame.src=entry.embed;frame.title='Historical Bitcoin '+entry.chartTitle+' chart — Axel Adler Jr.';
    frame.loading='lazy';frame.className='mi-provider-iframe';
    frame.referrerPolicy='strict-origin-when-cross-origin';
    stage.appendChild(frame);
  }
  $$('[data-onchain]').forEach(button=>button.addEventListener('click',()=>{
    if(!onchain[button.dataset.onchain])return;
    selectedOnchain=button.dataset.onchain;loadOnchain();
  }));

  function latestFinite(series,ceiling=Infinity){
    if(!series||typeof series!=='object')return null;
    let ts=-1,val=null;
    for(const [key,number] of Object.entries(series)){
      const t=Number(key);
      if(t<=ceiling && t>ts && Number.isFinite(number)){ts=t;val=number;}
    }
    return ts>0?{ts,value:val}:null;
  }
  function paintCBBI(){
    const message=$('mi-cbbi-message'), score=$('mi-cbbi-value'), stamp=$('mi-cbbi-date'),svg=$('mi-cbbi-graph');
    if(!cbbiData||!cbbiNewest)return;
    score.textContent=(cbbiNewest.value*100).toFixed(1)+' / 100';
    stamp.textContent='CBBI observation: '+fmtDate(cbbiNewest.ts)+' UTC';
    const age=(Date.now()/1000-cbbiNewest.ts)/86400;
    message.textContent=age>7?'Provider’s most recent score is over seven days old; treat this observation as stale.':'CBBI composite confidence: higher scores indicate stronger historical cycle-overheating conditions, not a price target.';
    const rows=Object.entries(cbbiData.Confidence||{}).map(([s,v])=>({ts:Number(s),v:Number(v)})).filter(x=>Number.isFinite(x.v)&&x.ts<=cbbiNewest.ts&&x.ts>=cbbiNewest.ts-chartRange*86400).sort((a,b)=>a.ts-b.ts);
    svg.replaceChildren();
    if(rows.length>1){
      const width=640,height=185,pad=16,points=rows.map((r,i)=>{
        const x=pad+i/(rows.length-1)*(width-2*pad);
        const y=height-pad-(Math.max(0,Math.min(1,r.v))*(height-2*pad));
        return x.toFixed(1)+','+y.toFixed(1);
      }).join(' ');
      const NS='http://www.w3.org/2000/svg';
      for(const level of [0,0.5,1]) {
        const y=height-pad-level*(height-2*pad);
        const line=document.createElementNS(NS,'line');
        line.setAttribute('x1',String(pad));line.setAttribute('x2',String(width-pad));
        line.setAttribute('y1',String(y));line.setAttribute('y2',String(y));
        line.setAttribute('stroke','rgba(174,183,204,.24)');line.setAttribute('stroke-dasharray','4 6');
        svg.appendChild(line);
      }
      const path=document.createElementNS(NS,'polyline');
      path.setAttribute('points',points);path.setAttribute('fill','none');
      path.setAttribute('stroke','#34d399');path.setAttribute('stroke-width','3');
      path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');
      svg.appendChild(path);
      $('mi-cbbi-range').textContent='Observed confidence, last '+chartRange+' days · '+rows.length+' data points · 0–100 scale';
    }else $('mi-cbbi-range').textContent='Insufficient historical data for selected range.';
    const panel=$('mi-cbbi-metrics');panel.replaceChildren();
    for(const [key,series] of Object.entries(cbbiData)){
      if(key==='Price'||key==='Confidence'||!series||typeof series!=='object')continue;
      const recent=latestFinite(series,cbbiNewest.ts);
      if(!recent)continue;
      const item=document.createElement('article');item.className='mi-indicator';
      const name=document.createElement('strong');name.textContent=key;
      const number=document.createElement('span');number.textContent=Number(recent.value).toLocaleString('en-US',{maximumFractionDigits:4});
      const detail=document.createElement('small');detail.textContent=fmtDate(recent.ts)+' UTC · provider units; not normalized score';
      item.append(name,number,detail);panel.appendChild(item);
    }
  }
  async function loadCBBI(){
    if(fetchedCBBI)return;
    fetchedCBBI=true;
    $('mi-cbbi-message').textContent='Loading official CBBI historical data…';
    try{
      const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
      let res;
      try{res=await fetch('https://colintalkscrypto.com/cbbi/data/latest.json',{mode:'cors',cache:'no-store',signal:controller.signal});}
      finally{clearTimeout(timer);}
      if(!res.ok)throw Error('HTTP '+res.status);
      const data=await res.json();
      if(!data||typeof data!=='object'||!data.Confidence||!data.Price)throw Error('Unexpected CBBI data format');
      const latest=latestFinite(data.Confidence,Math.floor(Date.now()/1000));
      if(!latest||latest.value<0||latest.value>1)throw Error('Invalid provider confidence value');
      cbbiData=data;cbbiNewest=latest;paintCBBI();
    }catch(e){
      fetchedCBBI=false;
      $('mi-cbbi-value').textContent='Unavailable';
      $('mi-cbbi-date').textContent='No verified current reading';
      $('mi-cbbi-message').textContent='The official feed could not be read in this browser. It may block cross-origin requests, be offline, or time out. No score has been estimated or substituted.';
      $('mi-cbbi-range').textContent='No data to chart';
      $('mi-cbbi-metrics').replaceChildren();
    }
  }
  $$('[data-cbbi-range]').forEach(b=>b.addEventListener('click',()=>{
    chartRange=Number(b.dataset.cbbiRange)||365;
    setPressed('[data-cbbi-range]','cbbiRange',String(chartRange));
    if(cbbiData)paintCBBI();
  }));
  $('mi-cbbi-retry')?.addEventListener('click',()=>{fetchedCBBI=false;loadCBBI();});

  const compare=(year)=>{
    const b=reference[year];if(!b)return;
    selectedCycle=year;
    setPressed('[data-cycle]','cycle',year);
    $('mi-cycle-name').textContent=b[0];
    $('mi-cycle-peak').textContent=fmtMoney(b[1]);
    $('mi-cycle-low').textContent=fmtMoney(b[2]);
    $('mi-cycle-loss').textContent=b[3];
    $('mi-cycle-days').textContent=b[4];
    $('mi-cycle-caveat').textContent=b[5];
    calculate();
  };
  $$('[data-cycle]').forEach(b=>b.addEventListener('click',()=>compare(b.dataset.cycle)));
  compare('2022');

  function calculate(){
    const principal=Number($('mi-calc-principal').value), entry=reference[selectedCycle][2];
    const referenceLabel=selectedCycle==='2026'?'2026 reference':selectedCycle+' low';
    $('mi-calc-heading').textContent='What would an investment at the '+referenceLabel+' be worth today?';
    $('mi-calc-entry-label').textContent='BTC price at the '+referenceLabel;
    $('mi-calc-entry').textContent=fmtMoney(entry);
    $('mi-calc-quote').textContent=btcQuote?fmtMoney(btcQuote.usd):'Unavailable';
    const status=$('mi-calc-price-status'), fresh=quoteIsFresh(btcQuote);
    if(btcQuote){
      const stamp='Provider feed updated '+quoteTime(btcQuote.updatedAt)+'. ';
      status.textContent=stamp+(!fresh?'This estimate is over two hours old; current-value results are unavailable.':
        btcQuoteError?'Refresh failed; the calculation uses the last successfully loaded estimate.':
        btcQuotePending?'Refreshing the price estimate…':'Checked '+quoteTime(btcQuote.fetchedAt)+'.');
      status.dataset.state=!fresh||btcQuoteError?'error':btcQuotePending?'loading':'ready';
    }else{
      status.textContent=btcQuotePending?'Loading the latest available BTC/USD estimate…':
        btcQuoteError||'A current price estimate loads when you open Cycle Tools.';
      status.dataset.state=btcQuotePending?'loading':btcQuoteError?'error':'idle';
    }
    for(const id of ['mi-calc-btc','mi-calc-value','mi-calc-gain','mi-calc-return']) $(id).textContent='—';
    if(!Number.isFinite(principal)||principal<.01||principal>1e9){
      $('mi-calc-result').textContent='Enter a starting investment from $0.01 to $1 billion.';
      return;
    }
    const holdings=principal/entry;
    $('mi-calc-btc').textContent=holdings.toFixed(8)+' BTC';
    if(!fresh){
      $('mi-calc-result').textContent=fmtMoney(principal)+' at the '+referenceLabel+' reference price would buy '+holdings.toFixed(8)+' BTC. '+
        (btcQuotePending?'The latest value is being checked.':'Refresh the Bitcoin price to calculate its estimated value today.');
      return;
    }
    const value=holdings*btcQuote.usd, gain=value-principal, change=(btcQuote.usd/entry-1)*100;
    $('mi-calc-value').textContent=fmtMoney(value);
    $('mi-calc-gain').textContent=(gain>0?'+':'')+fmtMoney(gain);
    $('mi-calc-return').textContent=(change>0?'+':'')+change.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
    $('mi-calc-result').textContent=fmtMoney(principal)+' ÷ '+fmtMoney(entry)+' × '+fmtMoney(btcQuote.usd)+' = '+fmtMoney(value)+
      ' estimated value at the quoted price, assuming you held all the BTC.';
  }
  async function loadBitcoinPrice(force=false){
    if(btcQuotePending)return;
    const now=Date.now(), cooldown=force?60*1000:BTC_PRICE_REFRESH_MS;
    if(btcQuoteAttempt && now-btcQuoteAttempt<cooldown){calculate();return;}
    btcQuoteAttempt=now;btcQuotePending=true;btcQuoteError='';
    $('mi-calc-refresh').disabled=true;
    calculate();
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(BTC_PRICE_URL,{mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error('Price HTTP '+response.status);
      const data=await response.json(), usd=Number(data?.USD), seconds=Number(data?.time), updatedAt=seconds*1000;
      if(!Number.isFinite(usd)||usd<=0||usd>1e9||!Number.isInteger(seconds)||seconds<=0||updatedAt>Date.now()+5*60*1000){
        throw Error('Invalid price observation');
      }
      btcQuote={usd,updatedAt,fetchedAt:Date.now()};
    }catch{
      btcQuoteError='The latest Bitcoin price could not be loaded. You can try refreshing again in one minute.';
    }finally{
      clearTimeout(timer);btcQuotePending=false;
      $('mi-calc-refresh').disabled=false;
      calculate();
    }
  }
  $('mi-calc-principal')?.addEventListener('input',calculate);
  $('mi-calc-refresh')?.addEventListener('click',()=>loadBitcoinPrice(true));
  const refreshVisibleBitcoinPrice=()=>{
    if(!document.hidden && !$('mi-pane-cycles').hidden)loadBitcoinPrice();
  };
  // Only this visible browser panel polls; no scheduled server job is added.
  setInterval(refreshVisibleBitcoinPrice,BTC_PRICE_REFRESH_MS);
  document.addEventListener('visibilitychange',refreshVisibleBitcoinPrice);

  function reportText(){
    const score=cbbiNewest?'CBBI: '+(cbbiNewest.value*100).toFixed(1)+'/100 ('+fmtDate(cbbiNewest.ts)+' UTC; provider observation).':'CBBI: current observation not verified.';
    return ['TREE MARKET INSIGHTS','Bitcoin research dashboard',score,'Crypto market-cap charts: TOTAL, TOTAL2, TOTAL3, TOTAL3ES and BTC.D (TradingView).','Cycle figures: historical references, not price forecasts.','Sources: TradingView · Axel Adler Jr. · ColinTalksCrypto CBBI','Explore on tree-token.xyz · Not financial advice.'].join('\n');
  }
  $('mi-copy-report')?.addEventListener('click',async()=>{
    const button=$('mi-copy-report');
    try{await navigator.clipboard.writeText(reportText());button.textContent='Copied';}
    catch{button.textContent='Copy unavailable in this browser';}
  });
  $('mi-download-report')?.addEventListener('click',()=>{
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const gradient=ctx.createLinearGradient(0,0,1080,1080);
    gradient.addColorStop(0,'#030f13');gradient.addColorStop(1,'#091b24');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1080);
    ctx.fillStyle='#34d399';ctx.fillRect(70,70,10,126);
    ctx.fillStyle='#ffd166';ctx.font='bold 48px system-ui';ctx.fillText('TREE MARKET INSIGHTS',100,122);
    ctx.fillStyle='#f4fbff';ctx.font='bold 74px system-ui';ctx.fillText('BITCOIN CYCLE',75,280);ctx.fillText('RESEARCH',75,367);
    ctx.fillStyle='#aeb7cc';ctx.font='32px system-ui';ctx.fillText('Historical context, not price prediction',75,442);
    ctx.fillStyle='#34d399';ctx.font='bold 42px system-ui';ctx.fillText('CBBI COMPOSITE',75,556);
    ctx.fillStyle='#ffd166';ctx.font='bold 76px system-ui';
    ctx.fillText(cbbiNewest?(cbbiNewest.value*100).toFixed(1)+'/100':'Data unavailable',75,655);
    ctx.fillStyle='#b6ccd0';ctx.font='26px system-ui';
    ctx.fillText(cbbiNewest?('Observed '+fmtDate(cbbiNewest.ts)+' (UTC)'):'No verified CBBI observation',75,705);
    ctx.fillStyle='#e5f7f2';ctx.font='bold 32px system-ui';
    ctx.fillText('BTC Rainbow · TradingView Markets · On-chain',75,813);
    ctx.fillStyle='#8fa7a8';ctx.font='25px system-ui';
    ctx.fillText('Sources: ColinTalksCrypto, TradingView, Axel Adler Jr.',75,895);
    ctx.fillText('tree-token.xyz  •  Educational use only',75,952);
    canvas.toBlob(blob=>{
      if(!blob)return;
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='tree-bitcoin-market-insights.png';
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    },'image/png');
  });

  const tabIds=['sentiment','rainbow','market','cbbi','onchain','cycles'];
  const activate=(id)=>{
    if(!tabIds.includes(id))return;
    for(const name of tabIds){
      const tab=$('mi-tab-'+name),pane=$('mi-pane-'+name),on=id===name;
      if(tab){tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;}
      if(pane)pane.hidden=!on;
    }
    document.dispatchEvent(new CustomEvent('tree-market-tab-change',{detail:{id}}));
    if(id==='market')loadMarket();
    if(id==='onchain')loadOnchain();
    if(id==='cbbi')loadCBBI();
    if(id==='cycles')loadBitcoinPrice();
  };
  $$('[data-mi-tab]').forEach(button=>{
    button.addEventListener('click',()=>activate(button.dataset.miTab));
    button.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const idx=tabIds.indexOf(button.dataset.miTab), next=event.key==='Home'?0:event.key==='End'?tabIds.length-1:(idx+(event.key==='ArrowRight'?1:-1)+tabIds.length)%tabIds.length;
      activate(tabIds[next]);$('mi-tab-'+tabIds[next])?.focus();
    });
  });
  // Preserve the existing Rainbow shortcut and direct links after moving the
  // chart into the Explorer. Reveal the panel before the anchor scroll occurs.
  const rainbowAnchors = ['#rainbow-chart', '#rainbow-guide', '#research-notes'];
  const revealRainbowAnchor = () => {
    if (!rainbowAnchors.includes(window.location.hash)) return;
    activate('rainbow');
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({block:'start'});
  };
  $$('a[href="#rainbow-chart"], a[href="#rainbow-guide"], a[href="#research-notes"]').forEach(link => {
    link.addEventListener('click', () => activate('rainbow'));
  });
  window.addEventListener('hashchange', revealRainbowAnchor);
  if (rainbowAnchors.includes(window.location.hash)) revealRainbowAnchor();
  else activate('sentiment');
})();
