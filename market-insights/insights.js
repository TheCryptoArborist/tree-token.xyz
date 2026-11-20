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
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
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
    OTHERS:['CRYPTOCAP:OTHERS','OTHERS: TradingView’s market-cap index excluding the top 10. It tracks a selected basket outside the largest coins, not every smaller token.'],
    STABLECAP:['CRYPTOCAP:STABLE.C','Stablecoin Market Cap: the combined market value of up to 100 coins in TradingView’s Stablecoins category.'],
    BTCD:['CRYPTOCAP:BTC.D','Bitcoin dominance: Bitcoin capitalization as a percentage of TradingView’s tracked TOTAL capitalization.'],
    STABLED:['CRYPTOCAP:STABLE.C.D','Stablecoin dominance: stablecoins’ market value as a percentage of TradingView’s tracked crypto market.'],
    ETHD:['CRYPTOCAP:ETH.D','ETH Dominance: Ethereum’s market capitalization as a percentage of TradingView’s tracked TOTAL capitalization.'],
    DEFI:['CRYPTOCAP:TOTALDEFI','DeFi Market Cap: the combined market value of up to 125 coins in TradingView’s decentralized-finance category.'],
    GOLD:['TVC:GOLD','Gold: TradingView’s indicative U.S. dollar price per troy ounce, not its total market capitalization.','https://www.tradingview.com/symbols/GOLD/'],
    SILVER:['TVC:SILVER','Silver: TradingView’s indicative CFD price in U.S. dollars per troy ounce, not its total market capitalization.','https://www.tradingview.com/symbols/SILVER/'],
    GOLDSILVER:['TVC:GOLDSILVER','Gold/Silver Ratio — how many troy ounces of silver have the same value as one troy ounce of gold.','https://www.tradingview.com/symbols/TVC-GOLDSILVER/'],
    ALTSBTC:['CRYPTOCAP:TOTAL3ESBTC','Altcoins vs. BTC: market capitalization excluding BTC, ETH and stablecoins, divided by Bitcoin’s market capitalization.']
  };
  const marketGuides = {
    TOTAL:{group:'size',title:'TOTAL',
      shows:'The combined dollar market value of up to 125 ranked cryptocurrencies tracked by TradingView. Bitcoin, Ethereum and stablecoins are included.',
      rises:'The tracked market has a higher combined value. Prices, circulating supply and changes to the basket can all affect it.',
      falls:'The tracked market has a lower combined value. The dollar change is not the amount of money investors withdrew.',
      compare:'Check TOTAL2 and TOTAL3 to see the market without its largest coins, then BTC.D to see Bitcoin’s share.'},
    TOTAL2:{group:'size',title:'TOTAL2',
      shows:'The tracked crypto market’s combined dollar value after removing Bitcoin. Ethereum and stablecoins remain included.',
      rises:'The coins outside Bitcoin have a higher combined market value. Ethereum can have a large influence on this total.',
      falls:'Their combined market value is lower. This may reflect price changes, supply changes or changes to the included coins.',
      compare:'Compare TOTAL3 to remove Ethereum as well. ETH Dominance shows how large Ethereum is relative to the full tracked market.'},
    TOTAL3:{group:'size',title:'TOTAL3',
      shows:'The combined dollar value of the tracked crypto market after removing Bitcoin and Ethereum. Stablecoins are still included.',
      rises:'The remaining coins have a higher combined market value. Prices, circulating supply and which coins are included can all affect the total.',
      falls:'Their combined market value is lower. It does not establish how many dollars investors withdrew.',
      compare:'Compare TOTAL3ES to remove stablecoins, and Altcoins vs. BTC to see how that basket compares with Bitcoin’s market value.'},
    TOTAL3ES:{group:'size',title:'TOTAL3ES',
      shows:'The tracked crypto market’s dollar value excluding Bitcoin, Ethereum and stablecoins. This offers a view of the remaining altcoin basket.',
      rises:'That altcoin basket has a higher combined market value in dollars. This does not necessarily mean it is gaining relative to Bitcoin.',
      falls:'The basket’s combined dollar value is lower. A changing supply or list of included coins can also affect the reading.',
      compare:'Use Altcoins vs. BTC for the relative comparison, and TOTAL3 to see the effect of including stablecoins. Historical stablecoin exclusions have provider limitations.'},
    OTHERS:{group:'size',title:'OTHERS',
      shows:'TradingView’s market-cap index excluding the top 10. It follows selected coins outside the largest assets, rather than all small-cap tokens.',
      rises:'The included coins have a higher combined dollar value. A few larger coins within the basket can still drive the move.',
      falls:'Their combined dollar value is lower. Index membership and circulating supply can change as well as prices.',
      compare:'Compare TOTAL3ES for a broader altcoin view. Check individual price charts before assuming every smaller coin moved together.'},
    STABLECAP:{group:'size',title:'Stablecoin Market Cap',
      shows:'The combined dollar market value of up to 100 tracked stablecoins. Stablecoins aim to follow a currency or another reference asset.',
      rises:'The tracked stablecoins have more total market value. Token issuance, prices and changes to the included coins can contribute.',
      falls:'Their total market value is lower. Redemptions or price changes can contribute; it does not identify where money went.',
      compare:'Check Stablecoin Dominance for their share of crypto and TOTAL for overall market size. Stablecoin supply is not a promise of future buying.'},
    BTCD:{group:'dominance',title:'Bitcoin Dominance',
      shows:'Bitcoin’s market capitalization divided by TradingView’s TOTAL market capitalization, expressed as a percentage.',
      rises:'Bitcoin makes up a larger share of the tracked market. This can happen even if Bitcoin’s dollar price is falling.',
      falls:'Bitcoin makes up a smaller share. It does not by itself show that all altcoins are rising in dollar terms.',
      compare:'Check BTC’s price and TOTAL for dollar direction, then Altcoins vs. BTC for the basket that excludes Ethereum and stablecoins.'},
    STABLED:{group:'dominance',title:'Stablecoin Dominance',
      shows:'The tracked stablecoin market value divided by TOTAL, expressed as a percentage of the tracked crypto market.',
      rises:'Stablecoins account for a larger share. That can happen when other crypto prices fall, even if stablecoin market value stays flat.',
      falls:'Stablecoins account for a smaller share. Other crypto may be gaining value, stablecoin value may be falling, or both.',
      compare:'Use Stablecoin Market Cap and TOTAL together to see which side of the fraction is changing. Share alone cannot show traders’ intentions.'},
    ETHD:{group:'dominance',title:'ETH Dominance',
      shows:'Ethereum’s market capitalization divided by TradingView’s TOTAL market capitalization, expressed as a percentage. It measures ETH, not its whole ecosystem.',
      rises:'Ethereum accounts for a larger share of the tracked crypto market. Its dollar price could still be falling.',
      falls:'Ethereum accounts for a smaller share. This does not by itself show whether ETH’s dollar price is rising or falling.',
      compare:'Check the ETH price chart, BTC.D and TOTAL. Together they help distinguish Ethereum’s relative share from the direction of the wider market.'},
    DEFI:{group:'sectors',title:'DeFi Market Cap',
      shows:'The combined market value of up to 125 coins in TradingView’s decentralized-finance category. It values tokens; it is not total value locked in protocols.',
      rises:'The tracked DeFi tokens have a higher combined market value. Prices, circulating supply and category membership can all contribute.',
      falls:'Their combined market value is lower. This does not establish that deposits, users or protocol revenue fell.',
      compare:'Compare TOTAL3ES for wider altcoin conditions, then research individual projects’ usage and revenue to understand what sits behind token prices.'},
    GOLD:{group:'ratios',title:'Gold',
      shows:'TradingView’s indicative gold price in U.S. dollars per troy ounce. It is a price series, rather than the market value of all gold.',
      rises:'One troy ounce of gold costs more in U.S. dollars on this series.',
      falls:'One troy ounce costs less in U.S. dollars. This alone does not show how it performed against silver.',
      compare:'Compare Silver and the Gold/Silver Ratio. The ratio shows their relative value; retail bullion prices may differ from these indicative charts.'},
    SILVER:{group:'ratios',title:'Silver',
      shows:'TradingView’s indicative silver CFD price in U.S. dollars per troy ounce. It is a price series, rather than silver’s total market capitalization.',
      rises:'One troy ounce of silver has a higher quoted U.S. dollar price on this series.',
      falls:'One troy ounce has a lower quoted U.S. dollar price. A retail dealer’s price can differ.',
      compare:'Compare Gold and the Gold/Silver Ratio. A falling Gold/Silver Ratio means silver is gaining value relative to gold.'},
    GOLDSILVER:{group:'ratios',title:'Gold/Silver Ratio',
      shows:'Gold’s price divided by silver’s price. A reading of 80 means one troy ounce of gold has the same value as about 80 troy ounces of silver.',
      rises:'Gold gains value relative to silver: it takes more ounces of silver to match one ounce of gold.',
      falls:'Silver gains value relative to gold: it takes fewer ounces of silver to match one ounce of gold.',
      compare:'Check both Gold and Silver for their dollar direction. Silver can strengthen relative to gold while both dollar prices are falling.'},
    ALTSBTC:{group:'ratios',title:'Altcoins vs. BTC',
      shows:'TOTAL3ES divided by Bitcoin’s market capitalization: the tracked altcoin basket excluding BTC, ETH and stablecoins, compared with Bitcoin.',
      rises:'That altcoin basket’s market value gains relative to Bitcoin’s. Both sides could still be falling in dollar terms.',
      falls:'The basket’s market value loses ground relative to Bitcoin’s. This does not establish that every altcoin is falling.',
      compare:'Check TOTAL3ES and the BTC price chart for dollar direction. Supply and membership changes affect this ratio; it is not an investable portfolio’s return.'}
  };
  const marketGroupSelections={size:'TOTAL3',dominance:'BTCD',sectors:'DEFI',ratios:'GOLD'};
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
    '2018':['2018 bear-market bottom',19280,3232,'83.2%','364 days','Historical daily-price reference. Selecting the low uses hindsight; it does not show a signal available at the time.'],
    '2022':['2022 bear-market bottom',67562,15760,'76.7%','378 days','Historical daily-price reference. Selecting the low uses hindsight; it does not show a signal available at the time.'],
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
  let selectedMarket='TOTAL3', lastMarket='', marketLoadVersion=0, selectedOnchain='realized', lastOnchain='', fetchedCBBI=false, cbbiData=null, cbbiNewest=null, chartRange=365;
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
    const guide=marketGuides[selectedMarket];
    marketGroupSelections[guide.group]=selectedMarket;
    setPressed('[data-tv-symbol]','tvSymbol',selectedMarket);
    setPressed('[data-market-group]','marketGroup',guide.group);
    $$('[data-market-group-panel]').forEach(panel=>{panel.hidden=panel.dataset.marketGroupPanel!==guide.group;});
    $('mi-market-description').textContent=entry[1];
    $('mi-market-guide-title').textContent='Reading '+guide.title;
    for(const part of ['shows','rises','falls','compare'])$('mi-market-guide-'+part).textContent=guide[part];
    const source=entry[2] || 'https://www.tradingview.com/symbols/CRYPTOCAP-'+entry[0].split(':')[1]+'/';
    $('mi-market-source').href=source;
    $('mi-stablecoin-guide')?.toggleAttribute('hidden',selectedMarket!=='STABLED');
    $('mi-stablecoin-methodology')?.toggleAttribute('hidden',selectedMarket!=='STABLED');
    $('mi-gold-guide')?.toggleAttribute('hidden',selectedMarket!=='GOLD');
    $('mi-silver-guide')?.toggleAttribute('hidden',selectedMarket!=='SILVER');
    $('mi-goldsilver-guide')?.toggleAttribute('hidden',selectedMarket!=='GOLDSILVER');
    stage.setAttribute('aria-label','TradingView chart: '+entry[0]);
    if(lastMarket===selectedMarket)return;
    lastMarket=selectedMarket;
    const version=++marketLoadVersion;
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
    creditLink.href=source;
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
    $('mi-tv-status').textContent='Loading TradingView chart…';
    script.onerror=()=>{if(version===marketLoadVersion)$('mi-tv-status').textContent='This chart could not load. Open it on TradingView to continue.';};
    script.onload=()=>{if(version===marketLoadVersion)$('mi-tv-status').textContent='Interactive chart and dates supplied by TradingView.';};
    host.appendChild(script);stage.appendChild(host);
  }
  $$('[data-tv-symbol]').forEach(button=>button.addEventListener('click',()=>{
    if(!Object.hasOwn(tvSymbols,button.dataset.tvSymbol))return;
    selectedMarket=button.dataset.tvSymbol;loadMarket();recordView();
  }));
  $$('[data-market-group]').forEach(button=>button.addEventListener('click',()=>{
    if(!Object.hasOwn(marketGroupSelections,button.dataset.marketGroup))return;
    selectedMarket=marketGroupSelections[button.dataset.marketGroup];loadMarket();recordView();
  }));

  function loadPrices(){
    const entry=priceAssets[selectedPrice],stage=$('mi-price-stage');
    if(!stage||!entry)return;
    const isTree=selectedPrice==='TREE';
    setPressed('[data-price-asset]','priceAsset',selectedPrice);
    $('mi-price-description').textContent=isTree?'TREE · USD · Noodles':entry.name+' · Binance spot market · '+entry.pair+' · TradingView';
    $('mi-price-source').href=entry.source;
    $('mi-price-source').textContent=isTree?'Open TREE’s tracked markets on Noodles':'Open '+entry.pair+' on TradingView';
    $('mi-price-reading').textContent=isTree?'TREE’s price is quoted in USD using markets tracked by Noodles. Open Noodles to see the markets included in the chart.':'Prices are quoted in USDT per '+selectedPrice+'. USDT is a dollar-linked stablecoin. Volume shows trading activity for this Binance spot pair.';
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
    selectedPrice=button.dataset.priceAsset;loadPrices();recordView();
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
    if(!Object.hasOwn(onchain,button.dataset.onchain))return;
    selectedOnchain=button.dataset.onchain;loadOnchain();recordView();
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
      date.textContent=valid?fmtDate(recent.ts)+' UTC'+(recent.ts<cbbiNewest.ts?' · Older than overall score':'')+((Date.now()/1000-recent.ts)>7*86400?' · Over seven days old':''):'No score available.';
      const details=document.createElement('details');details.className='mi-indicator-more';
      const summary=document.createElement('summary');summary.textContent='More about '+indicator.name.split(':')[0];
      const detail=document.createElement('p');detail.textContent=indicator.detail;
      const source=document.createElement('a');source.href=indicator.source;source.target='_blank';source.rel='noopener noreferrer';source.textContent='View indicator source';
      details.append(summary,detail,source);item.append(name,explanation,reading,track,date,details);panel.appendChild(item);
    }
    $('mi-cbbi-component-status').textContent=cbbiNewest?available+' of '+cbbiIndicators.length+' component scores available'+(older?' · '+older+' dated earlier than the overall score.':'.')+' Dates show when CBBI recorded each score. The underlying data can update at different times.':'The nine explanations remain available. No component readings have been verified.';
  }
  paintCBBIIndicators();
  function paintCBBI(){
    const message=$('mi-cbbi-message'), score=$('mi-cbbi-value'), stamp=$('mi-cbbi-date'),svg=$('mi-cbbi-graph');
    if(!cbbiData||!cbbiNewest)return;
    score.textContent=(cbbiNewest.value*100).toFixed(1)+' / 100';
    stamp.textContent='CBBI observation: '+fmtDate(cbbiNewest.ts)+' UTC';
    const age=(Date.now()/1000-cbbiNewest.ts)/86400;
    message.textContent=age>7?'The latest CBBI observation is over seven days old. These readings are outdated.':'Latest available CBBI reading loaded.';
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
      $('mi-cycle-days-label').textContent=year==='2026'?'Observation cutoff':'Time from peak to low';
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
    return ['TREE MARKET INSIGHTS','Bitcoin research dashboard',score,'TradingView charts: TOTAL, TOTAL2, TOTAL3, TOTAL3ES, OTHERS, Stablecoin Market Cap, BTC.D, Stablecoin Dominance, ETH Dominance, DeFi Market Cap, Gold, Silver, Gold/Silver Ratio and Altcoins vs. BTC.','Cycle figures: historical references, not price forecasts.','Sources: TradingView · Axel Adler Jr. · ColinTalksCrypto CBBI','Explore on tree-token.xyz · Not financial advice.'].join('\n');
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
  const VIEW_STORAGE_KEY='tree-market-insights-view-v1';
  const defaultView={version:1,view:'sentiment',chart:'TOTAL3',asset:'BTC',onchain:'realized'};
  const rainbowAnchors=['#rainbow-chart','#rainbow-guide','#research-notes'];
  let selectedView='sentiment',storageAvailable=true,shareAttempt=0;

  // Save only this page's own controls. TradingView dates and settings remain
  // provider-owned; sentiment filters and calculator inputs are not serialized.
  function cleanView(raw,base=defaultView){
    const state={...base,version:1};
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return state;
    if(tabIds.includes(raw.view))state.view=raw.view;
    if(typeof raw.chart==='string'&&Object.hasOwn(tvSymbols,raw.chart))state.chart=raw.chart;
    if(typeof raw.asset==='string'&&Object.hasOwn(priceAssets,raw.asset))state.asset=raw.asset;
    if(typeof raw.onchain==='string'&&Object.hasOwn(onchain,raw.onchain))state.onchain=raw.onchain;
    return state;
  }
  function savedView(){
    let text;
    try{text=localStorage.getItem(VIEW_STORAGE_KEY);}
    catch{storageAvailable=false;return {...defaultView};}
    try{const state=JSON.parse(text);return state?.version===1?cleanView(state):{...defaultView};}
    catch{return {...defaultView};}
  }
  function currentView(){
    return {version:1,view:selectedView,chart:selectedMarket,asset:selectedPrice,onchain:selectedOnchain};
  }
  function rememberView(state){
    try{localStorage.setItem(VIEW_STORAGE_KEY,JSON.stringify(state));storageAvailable=true;}
    catch{storageAvailable=false;}
  }
  function viewURL(state){
    // Construct from our page path, never from arbitrary incoming query fields.
    const url=new URL(window.location.pathname,window.location.origin);
    url.searchParams.set('view',state.view);
    if(state.view==='market')url.searchParams.set('chart',state.chart);
    if(state.view==='prices')url.searchParams.set('asset',state.asset);
    if(state.view==='onchain')url.searchParams.set('onchain',state.onchain);
    url.hash='market-explorer';
    return url;
  }
  function viewName(state){
    if(state.view==='market')return marketGuides[state.chart].title;
    if(state.view==='prices')return state.asset+' price';
    if(state.view==='onchain')return onchain[state.onchain].chartTitle;
    return $('mi-tab-'+state.view)?.textContent.trim()||'research section';
  }
  function resetShare(){
    shareAttempt++;
    const chartView=['market','prices','onchain'].includes(selectedView);
    $('mi-copy-link').textContent=chartView?'Copy chart link':'Copy section link';
    $('mi-share-link-field').hidden=true;
    $('mi-share-status').textContent=storageAvailable?
      (chartView?'This chart choice and section are remembered here. Choose dates inside the chart.':'This section is remembered here. The link opens the section with its default controls.'):
      'This browser cannot save choices. Copy a link to return to this view.';
  }
  function recordView(mode='push',updateURL=true){
    const state=currentView();
    rememberView(state);resetShare();
    try{
      const next=viewURL(state);
      const method=mode==='replace'||next.href===window.location.href?'replaceState':'pushState';
      if(updateURL)window.history[method]({treeMarketView:state},'',next.href);
      else window.history.replaceState({treeMarketView:state},'');
    }catch{/* Chart selection and copyable links still work without History API access. */}
  }
  const activate=(id,record=true)=>{
    if(!tabIds.includes(id))return;
    selectedView=id;
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
    if(record)recordView();
  };
  $$('[data-mi-tab]').forEach(button=>{
    button.addEventListener('click',()=>activate(button.dataset.miTab));
    button.addEventListener('keydown',event=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const idx=tabIds.indexOf(button.dataset.miTab), next=event.key==='Home'?0:event.key==='End'?tabIds.length-1:(idx+(event.key==='ArrowRight'?1:-1)+tabIds.length)%tabIds.length;
      activate(tabIds[next]);$('mi-tab-'+tabIds[next])?.focus();
    });
  });
  function restoreView(){
    // A browser history entry restores all our controls. A fresh visit uses
    // saved choices, then lets each valid, explicit URL choice take precedence.
    const historyView=window.history.state?.treeMarketView;
    const base=historyView?.version===1?cleanView(historyView):savedView();
    const params=new URL(window.location.href).searchParams;
    const state=cleanView({view:params.get('view'),chart:params.get('chart'),asset:params.get('asset'),onchain:params.get('onchain')},base);
    if(!tabIds.includes(params.get('view'))){
      if(Object.hasOwn(tvSymbols,params.get('chart')))state.view='market';
      else if(Object.hasOwn(priceAssets,params.get('asset')))state.view='prices';
      else if(Object.hasOwn(onchain,params.get('onchain')))state.view='onchain';
    }
    const rainbow=rainbowAnchors.includes(window.location.hash);
    if(rainbow)state.view='rainbow';
    selectedMarket=state.chart;selectedPrice=state.asset;selectedOnchain=state.onchain;
    activate(state.view,false);
    recordView('replace',false);
    if(rainbow)document.getElementById(window.location.hash.slice(1))?.scrollIntoView({block:'start'});
  }
  $('mi-copy-link')?.addEventListener('click',async()=>{
    const state=currentView(),url=viewURL(state).href,attempt=++shareAttempt;
    const sectionOnly=!['market','prices','onchain'].includes(state.view);
    try{
      if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      if(attempt!==shareAttempt)return;
      $('mi-share-link-field').hidden=true;
      $('mi-share-status').textContent='Copied link to '+viewName(state)+(sectionOnly?' section.':' chart.');
    }catch{
      if(attempt!==shareAttempt)return;
      const field=$('mi-share-link-field');field.value=url;field.hidden=false;
      $('mi-share-status').textContent='Automatic copying is unavailable. Copy the selected link below to '+viewName(state)+'.';
      field.focus();field.select();
    }
  });
  // Let native anchors create their normal history entries. Reveal first so
  // the browser can scroll to the existing Rainbow guide and chart targets.
  $$('a[href="#rainbow-chart"], a[href="#rainbow-guide"], a[href="#research-notes"]').forEach(link => {
    link.addEventListener('click',()=>activate('rainbow',false));
  });
  window.addEventListener('popstate',restoreView);
  window.addEventListener('hashchange',restoreView);
  restoreView();
})();
