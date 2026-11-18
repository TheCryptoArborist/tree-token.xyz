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
  const priceAssets = {
    BTC:{name:'Bitcoin',symbol:'BINANCE:BTCUSDT',pair:'BTC/USDT',source:'https://www.tradingview.com/symbols/BTCUSDT/?exchange=BINANCE'},
    ETH:{name:'Ethereum',symbol:'BINANCE:ETHUSDT',pair:'ETH/USDT',source:'https://www.tradingview.com/symbols/ETHUSDT/?exchange=BINANCE'},
    SUI:{name:'Sui',symbol:'BINANCE:SUIUSDT',pair:'SUI/USDT',source:'https://www.tradingview.com/symbols/SUIUSDT/?exchange=BINANCE'},
    BNB:{name:'BNB',symbol:'BINANCE:BNBUSDT',pair:'BNB/USDT',source:'https://www.tradingview.com/symbols/BNBUSDT/?exchange=BINANCE'},
    TREE:{name:'TREE',pair:'TREE/USD',source:'https://app.noodles.fi/coins/0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
      embed:'https://noodles.fi/tv-widget?coin=0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf%3A%3Atree%3A%3ATREE&theme=dark'}
  };
  let selectedPrice='BTC',lastPrice='',priceLoadVersion=0;
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
  // New Liberty Standard's 2009-10-05 mid-market history: $1 USD = 1,309.03 BTC.
  // Keep the published ratio for arithmetic; its displayed USD inverse is rounded.
  const FIRST_QUOTED_BTC_PER_USD=1309.03;
  let selectedCycle='2022', btcQuote=null, btcQuotePending=false, btcQuoteAttempt=0, btcQuoteError='';
  const quoteTime = ms => new Intl.DateTimeFormat('en-US',{
    timeZone:'UTC',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).format(new Date(ms))+' UTC';
  const quoteIsFresh = (quote,now=Date.now()) => !!quote && quote.updatedAt<=now+5*60*1000 && now-quote.updatedAt<=BTC_PRICE_MAX_AGE_MS;
  // Official latest.json contains adjusted component scores in [0,1], not raw
  // indicator ratios. Keep the provider's published Confidence as the headline.
  const cbbiIndicators = [
    {
      key:'PiCycle', name:'Pi Cycle Top',
      description:'Compares recent and longer-term price trends for conditions seen around past Bitcoin cycle peaks.',
      detail:'It compares the 111-day average price with twice the 350-day average. A moving average smooths daily price swings. CBBI turns this relationship into its own cycle score.',
      source:'https://positivecrypto.medium.com/the-golden-ratio-multiplier-c2567401e12a'
    },
    {
      key:'RUPL', name:'RUPL / NUPL: paper profit or loss',
      description:'Estimates how much unrealized profit or loss Bitcoin holders have overall, before selling.',
      detail:'It compares current market value with estimated cost based on the price when coins last moved. Unrealized means the gain or loss is still on paper. Wallet transfers are not always purchases, so this is an estimate.',
      source:'https://research.glassnode.com/dissecting-bitcoins-unrealised-on-chain-profit-loss/'
    },
    {
      key:'RHODL', name:'RHODL Ratio: recently moved vs older coins',
      description:'Looks at the balance between the value of recently moved Bitcoin and coins held for longer.',
      detail:'It compares coins moved within the past week with coins last moved one to two years ago, using their value at last movement and an age adjustment. It does not count individual buyers or sellers.',
      source:'https://positivecrypto.medium.com/bitcoin-realized-hodl-ratio-9023db15a559'
    },
    {
      key:'Puell', name:'Puell Multiple: new Bitcoin issuance',
      description:'Compares the dollar value of newly mined Bitcoin each day with its average over the previous year.',
      detail:'Issuance means new BTC entering circulation as mining rewards. The measure uses a 365-day average. It does not subtract electricity and other mining costs; halvings also change how much new BTC is issued.',
      source:'https://studio.glassnode.com/charts/indicators.PuellMultiple?a=BTC'
    },
    {
      key:'2YMA', name:'2-Year Moving Average: long-term price trend',
      description:'Checks how far Bitcoin’s price has moved from its average over the previous two years.',
      detail:'A two-year moving average smooths shorter-term swings. CBBI compares the distance from that average with fitted historical cycle boundaries, then converts it into a score.',
      source:'https://github.com/Zaczero/CBBI/blob/main/metrics/two_year_moving_average.py'
    },
    {
      key:'Trolololo', name:'Trolololo Trend: long-term growth model',
      description:'Compares Bitcoin’s price with a mathematical model of its historical growth over time.',
      detail:'Trolololo is the model’s name. CBBI uses fitted growth trend lines to place price in historical context. These model lines can change and do not establish what Bitcoin should be worth.',
      source:'https://github.com/Zaczero/CBBI/blob/main/metrics/trolololo.py'
    },
    {
      key:'MVRV', name:'MVRV Z-Score: value vs estimated cost',
      description:'Checks how unusual the gap is between Bitcoin’s market value and the estimated cost of its coins.',
      detail:'The Z-score scales that gap by historical variation in market value. CBBI then converts it into the 0–100 score shown here. The On-Chain tab’s MVRV chart shows a different form: the original price-to-cost ratio.',
      source:'https://docs.glassnode.com/basic-api/endpoints/market'
    },
    {
      key:'ReserveRisk', name:'Reserve Risk: long-term holding behavior',
      description:'Compares Bitcoin’s price with a model of how long holders have kept their coins before moving them.',
      detail:'The model builds a record of continued holding from coin-age and spending data. It infers holder behavior; it cannot observe investors’ intentions or calculate your chance of losing money.',
      source:'https://www.kanaandkatana.com/valuation-depot-contents/2019/5/30/exploration-of-bitcoin-days-destroyed'
    },
    {
      key:'Woobull', name:'Woobull Top Cap / CVDD: price models',
      description:'Places Bitcoin’s price between two historical models based on market value and the movement of older coins.',
      detail:'Top Cap uses long-run average market value. CVDD means Cumulative Value Days Destroyed; it combines the value and age of coins when they move. These are experimental reference lines, not guaranteed price ceilings or floors.',
      source:'https://woocharts.com/bitcoin-price-models/'
    }
  ];
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

  function loadPrices(){
    const entry=priceAssets[selectedPrice],stage=$('mi-price-stage');
    if(!stage||!entry)return;
    const isTree=selectedPrice==='TREE';
    setPressed('[data-price-asset]','priceAsset',selectedPrice);
    $('mi-price-description').textContent=isTree?'TREE / USD · Noodles coin chart':entry.name+' · Binance spot market · '+entry.pair+' · TradingView';
    $('mi-price-source').href=entry.source;
    $('mi-price-source').textContent=isTree?'Open TREE’s tracked markets on Noodles':'Open '+entry.pair+' on TradingView';
    $('mi-price-reading').textContent=isTree?'TREE’s price history comes from Noodles’ coin-level view of its tracked markets, quoted in USD. Use the Noodles link to explore the markets behind the chart.':'Prices are quoted in USDT per '+selectedPrice+'. USDT is a dollar-linked stablecoin. Volume shows trading activity for this Binance spot pair.';
    if(lastPrice===selectedPrice)return;
    lastPrice=selectedPrice;
    const version=++priceLoadVersion;
    stage.replaceChildren();
    stage.setAttribute('aria-label',entry.name+' price chart supplied by '+(isTree?'Noodles':'TradingView'));
    const status=$('mi-price-status');
    status.textContent='Loading '+(isTree?'Noodles':'TradingView')+' chart…';
    if(isTree){
      const frame=document.createElement('iframe');
      frame.src=entry.embed;frame.title='TREE / USD price chart — Noodles';
      frame.className='mi-provider-iframe';frame.loading='lazy';frame.allowFullscreen=true;
      frame.referrerPolicy='strict-origin-when-cross-origin';
      frame.onload=()=>{if(version===priceLoadVersion)status.textContent='Chart controls and data are provided by Noodles.';};
      frame.onerror=()=>{if(version===priceLoadVersion)status.textContent='Noodles could not load here. Open the source link to view TREE’s chart.';};
      stage.appendChild(frame);return;
    }
    const host=document.createElement('div');host.className='tradingview-widget-container';
    host.style.height='100%';host.style.width='100%';
    const widget=document.createElement('div');widget.className='tradingview-widget-container__widget';
    widget.style.height='calc(100% - 32px)';widget.style.width='100%';host.appendChild(widget);
    const credit=document.createElement('div');credit.className='tradingview-widget-copyright';
    const creditLink=document.createElement('a');creditLink.href=entry.source;creditLink.target='_blank';creditLink.rel='noopener noreferrer nofollow';
    const symbolLabel=document.createElement('span');symbolLabel.className='blue-text';symbolLabel.textContent=entry.pair+' chart';creditLink.appendChild(symbolLabel);
    const trademark=document.createElement('span');trademark.className='trademark';trademark.textContent=' by TradingView';
    credit.append(creditLink,trademark);host.appendChild(credit);
    const script=document.createElement('script');script.async=true;script.type='text/javascript';
    script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.textContent=JSON.stringify({
      autosize:true,symbol:entry.symbol,interval:'D',timezone:'Etc/UTC',theme:'dark',style:'1',locale:'en',
      backgroundColor:'#050714',gridColor:'rgba(174,183,204,0.08)',hide_side_toolbar:true,
      hide_top_toolbar:false,hide_legend:false,hide_volume:false,allow_symbol_change:false,
      withdateranges:true,calendar:false,save_image:false,support_host:'https://www.tradingview.com'
    });
    script.onload=()=>{if(version===priceLoadVersion)status.textContent='Chart controls and data are provided by TradingView.';};
    script.onerror=()=>{if(version===priceLoadVersion)status.textContent='TradingView could not load here. Open the source link to view this market.';};
    host.appendChild(script);stage.appendChild(host);
  }
  $$('[data-price-asset]').forEach(button=>button.addEventListener('click',()=>{
    if(!Object.hasOwn(priceAssets,button.dataset.priceAsset))return;
    selectedPrice=button.dataset.priceAsset;loadPrices();
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
    if(!series||typeof series!=='object'||Array.isArray(series))return null;
    let ts=-1,val=null;
    for(const [key,number] of Object.entries(series)){
      const t=Number(key);
      if(Number.isSafeInteger(t) && t>0 && t<=ceiling && t>ts && Number.isFinite(number)){ts=t;val=number;}
    }
    return ts>0?{ts,value:val}:null;
  }
  function paintCBBIIndicators(){
    const panel=$('mi-cbbi-metrics');
    if(!panel)return;
    panel.replaceChildren();
    let available=0,older=0;
    for(const indicator of cbbiIndicators){
      const recent=cbbiNewest?latestFinite(cbbiData?.[indicator.key],cbbiNewest.ts):null;
      const valid=!!recent && recent.value>=0 && recent.value<=1;
      if(valid){available++;if(recent.ts<cbbiNewest.ts)older++;}
      const item=document.createElement('article');item.className='mi-indicator';
      const name=document.createElement('h5');name.textContent=indicator.name;
      const explanation=document.createElement('p');explanation.className='mi-indicator-description';explanation.textContent=indicator.description;
      const reading=document.createElement('div');
      const label=document.createElement('span');label.className='mi-indicator-score-label';label.textContent='CBBI component score';
      const number=document.createElement('span');number.className='mi-indicator-score';number.textContent=valid?(recent.value*100).toFixed(1)+' / 100':'Unavailable';
      reading.append(label,number);
      const track=document.createElement('div');track.className='mi-indicator-track';track.setAttribute('aria-hidden','true');
      const fill=document.createElement('span');fill.style.width=valid?(recent.value*100)+'%':'0%';
      if(valid)fill.style.backgroundColor='hsl('+(210*(1-recent.value))+', 65%, 65%)';track.appendChild(fill);
      const date=document.createElement('small');
      date.textContent=valid?fmtDate(recent.ts)+' UTC'+(recent.ts<cbbiNewest.ts?' · Older than overall score':'')+((Date.now()/1000-recent.ts)>7*86400?' · Over seven days old':''):'No verified score; the explanation still applies.';
      const details=document.createElement('details');details.className='mi-indicator-more';
      const summary=document.createElement('summary');summary.textContent='More about '+indicator.name.split(':')[0];
      const detail=document.createElement('p');detail.textContent=indicator.detail;
      const source=document.createElement('a');source.href=indicator.source;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Read the indicator explanation';
      details.append(summary,detail,source);item.append(name,explanation,reading,track,date,details);panel.appendChild(item);
    }
    $('mi-cbbi-component-status').textContent=cbbiNewest?available+' of '+cbbiIndicators.length+' component scores available'+(older?' · '+older+' dated earlier than the overall score.':'.')+' Dates refer to CBBI’s observations; upstream inputs may update at different times.':'The nine explanations remain available. No component readings have been verified.';
  }
  paintCBBIIndicators();
  function paintCBBI(){
    const message=$('mi-cbbi-message'), score=$('mi-cbbi-value'), stamp=$('mi-cbbi-date'),svg=$('mi-cbbi-graph');
    if(!cbbiData||!cbbiNewest)return;
    score.textContent=(cbbiNewest.value*100).toFixed(1)+' / 100';
    stamp.textContent='CBBI observation: '+fmtDate(cbbiNewest.ts)+' UTC';
    const age=(Date.now()/1000-cbbiNewest.ts)/86400;
    message.textContent=age>7?'The latest CBBI observation is over seven days old. These readings are outdated.':'Provider observation loaded. Lower scores are cooler; higher scores are hotter relative to past Bitcoin cycles.';
    const rows=Object.entries(cbbiData.Confidence||{}).map(([s,v])=>({ts:Number(s),v})).filter(x=>Number.isSafeInteger(x.ts)&&x.ts>0&&Number.isFinite(x.v)&&x.v>=0&&x.v<=1&&x.ts<=cbbiNewest.ts&&x.ts>=cbbiNewest.ts-chartRange*86400).sort((a,b)=>a.ts-b.ts);
    svg.replaceChildren();
    if(rows.length>1){
      const width=640,height=200,left=40,right=16,top=16,bottom=32,first=rows[0].ts,last=rows[rows.length-1].ts,points=rows.map(r=>{
        const x=left+(r.ts-first)/(last-first)*(width-left-right);
        const y=height-bottom-r.v*(height-top-bottom);
        return x.toFixed(1)+','+y.toFixed(1);
      }).join(' ');
      const NS='http://www.w3.org/2000/svg';
      for(const level of [0,0.5,1]) {
        const y=height-bottom-level*(height-top-bottom);
        const line=document.createElementNS(NS,'line');
        line.setAttribute('x1',String(left));line.setAttribute('x2',String(width-right));
        line.setAttribute('y1',String(y));line.setAttribute('y2',String(y));
        line.setAttribute('stroke','rgba(174,183,204,.24)');line.setAttribute('stroke-dasharray','4 6');
        svg.appendChild(line);
        const label=document.createElementNS(NS,'text');label.textContent=String(level*100);
        label.setAttribute('x',String(left-8));label.setAttribute('y',String(y+4));label.setAttribute('text-anchor','end');
        label.setAttribute('fill','#bad5cb');label.setAttribute('font-size','12');svg.appendChild(label);
      }
      const path=document.createElementNS(NS,'polyline');
      path.setAttribute('points',points);path.setAttribute('fill','none');
      path.setAttribute('stroke','#34d399');path.setAttribute('stroke-width','3');
      path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');
      svg.appendChild(path);
      for(const [timestamp,x,anchor] of [[first,left,'start'],[last,width-right,'end']]){
        const label=document.createElementNS(NS,'text');label.textContent=fmtDate(timestamp);
        label.setAttribute('x',String(x));label.setAttribute('y',String(height-7));label.setAttribute('text-anchor',anchor);
        label.setAttribute('fill','#bad5cb');label.setAttribute('font-size','12');svg.appendChild(label);
      }
      $('mi-cbbi-range').textContent=fmtDate(first)+'–'+fmtDate(last)+' UTC · '+rows.length+' observations · CBBI score, 0–100';
    }else $('mi-cbbi-range').textContent='Insufficient historical data for selected range.';
  }
  async function loadCBBI(){
    if(fetchedCBBI)return;
    fetchedCBBI=true;
    $('mi-cbbi-retry').disabled=true;
    $('mi-cbbi-message').textContent='Loading official CBBI historical data…';
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
    try{
      const res=await fetch('https://colintalkscrypto.com/cbbi/data/latest.json',{mode:'cors',cache:'no-store',signal:controller.signal});
      if(!res.ok)throw Error('HTTP '+res.status);
      const data=await res.json();
      if(!data||typeof data!=='object'||!data.Confidence||!data.Price)throw Error('Unexpected CBBI data format');
      const latest=latestFinite(data.Confidence,Math.floor(Date.now()/1000));
      if(!latest||latest.value<0||latest.value>1)throw Error('Invalid provider confidence value');
      cbbiData=data;cbbiNewest=latest;paintCBBI();paintCBBIIndicators();
    }catch(e){
      fetchedCBBI=false;cbbiData=null;cbbiNewest=null;
      $('mi-cbbi-value').textContent='Unavailable';
      $('mi-cbbi-date').textContent='No verified current reading';
      $('mi-cbbi-message').textContent='CBBI data could not be loaded. You can still read the guide below and use Refresh CBBI data to try again.';
      $('mi-cbbi-range').textContent='No data to chart';
      $('mi-cbbi-graph').replaceChildren();paintCBBIIndicators();
    }finally{clearTimeout(timer);$('mi-cbbi-retry').disabled=false;}
  }
  $$('[data-cbbi-range]').forEach(b=>b.addEventListener('click',()=>{
    chartRange=Number(b.dataset.cbbiRange)||365;
    setPressed('[data-cbbi-range]','cbbiRange',String(chartRange));
    if(cbbiData)paintCBBI();
  }));
  $('mi-cbbi-retry')?.addEventListener('click',()=>{fetchedCBBI=false;loadCBBI();});

  const compare=(year)=>{
    const first=year==='2009', b=reference[year];if(!first&&!b)return;
    selectedCycle=year;
    setPressed('[data-cycle]','cycle',year);
    $('mi-cycle-overview').hidden=first;
    if(b){
      $('mi-cycle-name').textContent=b[0];
      $('mi-cycle-peak').textContent=fmtMoney(b[1]);
      $('mi-cycle-low').textContent=fmtMoney(b[2]);
      $('mi-cycle-loss').textContent=b[3];
      $('mi-cycle-days').textContent=b[4];
      $('mi-cycle-caveat').textContent=b[5];
    }
    calculate();
  };
  $$('[data-cycle]').forEach(b=>b.addEventListener('click',()=>compare(b.dataset.cycle)));
  compare('2022');

  function calculate(){
    const first=selectedCycle==='2009', principal=Number($('mi-calc-principal').value);
    const entry=first?1/FIRST_QUOTED_BTC_PER_USD:reference[selectedCycle][2];
    const referenceLabel=selectedCycle==='2026'?'2026 reference':selectedCycle+' low';
    $('mi-calc-first-note').hidden=!first;
    $('mi-calc-heading').textContent=first?'What would an investment at Bitcoin’s first quoted price be worth today?':
      'What would an investment at the '+referenceLabel+' be worth today?';
    $('mi-calc-intro').textContent=first?
      'Use the documented 2009 quote as the starting point, then compare the BTC equivalent with the latest price below. Change your starting investment to explore the result.':
      'This assumes you bought Bitcoin at the selected historical reference and held the same amount of BTC until the price observation shown below. Change the year above or the amount you invested to compare.';
    $('mi-calc-entry-label').textContent=first?'BTC price · October 5, 2009':'BTC price at the '+referenceLabel;
    $('mi-calc-entry').textContent=first?'≈ '+entry.toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:8,maximumFractionDigits:8}):fmtMoney(entry);
    $('mi-calc-btc-label').textContent=first?'BTC equivalent at quoted rate':'BTC you could have bought';
    $('mi-calc-value-label').textContent=first?'Illustrative value at latest price':'Estimated value at latest price';
    $('mi-calc-assumptions').textContent=first?
      'Calculation: investment × 1,309.03 BTC per USD × latest BTC/USD price. Assumes the full investment could have been exchanged at the quoted rate and all BTC was held. Fees, taxes, interest and trading costs are excluded.':
      'Calculation: investment ÷ selected historical BTC price × latest BTC price. This is a hindsight comparison using the historical reference displayed above. Fees, taxes, interest and trading costs are excluded.';
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
    const holdings=first?principal*FIRST_QUOTED_BTC_PER_USD:principal/entry;
    const holdingsText=first?holdings.toLocaleString('en-US',{maximumFractionDigits:8}):holdings.toFixed(8);
    $('mi-calc-btc').textContent=holdingsText+' BTC';
    if(!fresh){
      $('mi-calc-result').textContent=(first?fmtMoney(principal)+' at the published 2009 rate corresponds to '+holdingsText+' BTC in this illustration. ':
        fmtMoney(principal)+' at the '+referenceLabel+' reference price would buy '+holdingsText+' BTC. ')+
        (btcQuotePending?'The latest value is being checked.':'Refresh the Bitcoin price to calculate its estimated value today.');
      return;
    }
    const value=holdings*btcQuote.usd, gain=value-principal, change=(btcQuote.usd/entry-1)*100;
    $('mi-calc-value').textContent=fmtMoney(value);
    $('mi-calc-gain').textContent=(gain>0?'+':'')+fmtMoney(gain);
    $('mi-calc-return').textContent=(change>0?'+':'')+change.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
    $('mi-calc-result').textContent=first?
      fmtMoney(principal)+' × 1,309.03 BTC per USD × '+fmtMoney(btcQuote.usd)+' per BTC = '+fmtMoney(value)+' illustrative value, assuming all BTC was held.':
      fmtMoney(principal)+' ÷ '+fmtMoney(entry)+' × '+fmtMoney(btcQuote.usd)+' = '+fmtMoney(value)+
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

  const tabIds=['sentiment','prices','rainbow','market','cbbi','onchain','cycles'];
  const activate=(id)=>{
    if(!tabIds.includes(id))return;
    for(const name of tabIds){
      const tab=$('mi-tab-'+name),pane=$('mi-pane-'+name),on=id===name;
      if(tab){tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;}
      if(pane)pane.hidden=!on;
    }
    document.dispatchEvent(new CustomEvent('tree-market-tab-change',{detail:{id}}));
    if(id==='prices')loadPrices();
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
