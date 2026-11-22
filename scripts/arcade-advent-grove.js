// December 2026 visual Advent Grove. Read-only: awards, streaks and payments are server-owned.
export const ADVENT_MONTH = '2026-12';
export const ADVENT_DAYS = Object.freeze([
  'First Light','Partridge Perch','Gingerbread Grove','Holly Bells','Golden Rings',
  'Snowman’s Rest','Reindeer Lantern','Frosted Vines','Candy Cane Crossing',
  'Nutcracker Sentinel','Midnight Carol','Turtle Doves','Giftwood','Winter Lantern',
  'Drummer’s Branch','Mistletoe Magic','Snowflake Sentinel','Starry Canopy',
  'Cocoa Hearth','Garden Bot’s Workshop','Caroling Grove','Poinsettia Protector',
  'North Star','Christmas Eve Starlight','Tree Hero Christmas Tree','Boxing Day Glow',
  'Moonlit Frost','Winter Wishes','Evergreen Resolve','Golden Countdown',
  'Midnight Celebration',
]);
const keyOf = day => ADVENT_MONTH+'-'+String(day).padStart(2,'0');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const decoration = day => {
  const style = day===25 ? 0 : day===31 ? 1 : day%6;
  const cap = style===0 ? '<path d="M50 8l3 8 9 1-7 6 2 9-7-5-7 5 2-9-7-6 9-1Z" fill="#ffdd78" stroke="#f3b14c" stroke-width="1.5"/>'
    : style===1 ? '<path d="M50 8v18M41 17h18M44 11l12 12M56 11L44 23" stroke="#bcf1ee" stroke-width="2.5"/>'
    : style===2 ? '<path d="M45 9q-9 4-1 12q9 8 12 0q7-10-3-13Z" fill="#b66a2b" stroke="#f4d399" stroke-width="2"/><path d="M45 14h10M45 19h10" stroke="white" stroke-width="2"/>'
    : style===3 ? '<circle cx="50" cy="17" r="7" fill="#be4f62" stroke="#ffe4a7" stroke-width="2"/>'
    : style===4 ? '<circle cx="50" cy="17" r="7" fill="none" stroke="#f5c754" stroke-width="3"/>'
    : '<path d="M42 17q8-10 16 0q-8 13-16 0Z" fill="#e8f3ff" stroke="#a4dae5" stroke-width="2"/>';
  return cap + '<circle cx="27" cy="48" r="4" fill="#f4c24b" stroke="#fff0bf" stroke-width="1.5"/>'
    + '<circle cx="72" cy="46" r="4" fill="'+(day%2?'#dd6475':'#a6e1eb')+'" stroke="#fff0bf" stroke-width="1.5"/>'
    + '<circle cx="45" cy="65" r="3" fill="#e1ab52"/><circle cx="62" cy="66" r="3" fill="#f1d98e"/>';
};
export function adventTreeSVG(day, large=false) {
  const name = ADVENT_DAYS[day-1] || 'Holiday Tree';
  return '<svg class="advent-tree-svg'+(large?' advent-tree-svg--large':'')+'" viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+escape(name)+'">'
    + '<ellipse cx="50" cy="98" rx="32" ry="6" fill="#342d50" opacity=".6"/>'
    + '<path d="M44 96Q47 73 47 35L53 35Q53 74 56 96Q52 103 44 96Z" fill="#6c4386" stroke="#c7a162" stroke-width="2"/>'
    + '<path d="M50 77V29M50 55L21 31M50 48L79 26M50 70L24 52M50 67L77 50" stroke="#c6a35e" stroke-width="5" fill="none" stroke-linecap="round"/>'
    + '<path d="M50 77V29M50 55L21 31M50 48L79 26M50 70L24 52M50 67L77 50" stroke="#73c35d" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<g fill="#70c64c" stroke="#b8e783" stroke-width="1.5">'
    + '<path d="M50 31Q36 24 49 13Q62 24 50 31Z"/>'
    + '<path d="M24 33Q10 27 13 17Q30 18 33 36Z"/>'
    + '<path d="M76 30Q83 14 93 18Q94 34 73 38Z"/>'
    + '<path d="M27 51Q9 43 10 34Q26 32 37 52Z"/>'
    + '<path d="M73 50Q82 31 92 39Q93 52 69 57Z"/>'
    + '<path d="M43 44Q29 41 33 30Q48 30 50 46Z"/>'
    + '<path d="M58 42Q63 27 73 33Q75 44 57 48Z"/>'
    + '<path d="M38 67Q21 69 20 59Q33 53 48 65Z"/>'
    + '<path d="M62 67Q79 54 84 65Q81 75 58 71Z"/>'
    + '</g><g>'+decoration(day)+'</g>'
    + '<circle cx="50" cy="78" r="8" fill="#402452" stroke="#e8c66e" stroke-width="2"/>'
    + '<path d="M50 83V74M50 79L46 75M50 79L54 75" stroke="#a0db66" stroke-width="1.8" stroke-linecap="round"/>'
    + '</svg>';
}
export function adventDayStatus(day, snapshot, signedIn=true) {
  if (!signedIn || snapshot?.monthKey!==ADVENT_MONTH) return 'future';
  const key = keyOf(day);
  if (snapshot.checkedDates.includes(key)) return snapshot.recoveredDates.includes(key) ? 'recovered' : 'saved';
  if (day > Number(snapshot.dateKey.slice(-2))) return 'future';
  if (day===Number(snapshot.dateKey.slice(-2))) return 'today';
  if (!snapshot.checkedDates.length || key < snapshot.checkedDates[0]) return 'unvisited';
  return snapshot.missedDates.includes(key) ? 'missed' : 'unvisited';
}
export function mountAdventGrove({ card, doc = card?.ownerDocument }={}) {
  if (!card || !doc) return null;
  const section = doc.createElement('section');
  section.id = 'arcade-advent-grove';
  section.className = 'arcade-advent-grove';
  section.hidden = true;
  section.innerHTML = '<div class="advent-heading"><div><span>DECEMBER 2026</span><h4>Tree Hero’s Advent Grove</h4></div><p>One holiday tree for each saved check-in</p></div>'
    + '<p class="advent-freshness" role="status" aria-live="polite"></p>'
    + '<div class="advent-detail" data-advent-detail></div>'
    + '<div class="advent-calendar" data-advent-calendar aria-label="December Advent Grove calendar"></div>'
    + '<p class="advent-legend"><span><b class="advent-symbol is-saved">✓</b> Saved</span><span><b class="advent-symbol is-recovered">✓</b> Restored</span><span><b class="advent-symbol is-missed">•</b> Missed</span><span><b class="advent-symbol is-future">⌁</b> Unopened</span></p>';
  card.querySelector('.forest-landscape')?.after(section);
  let lastWallet=null, selected=null, lastState='';
  let latest=null, latestFresh=false, latestWallet=null;
  function render() {
    if (!latest || latest.monthKey !== ADVENT_MONTH || !latestWallet) { section.hidden=true; card.removeAttribute('data-advent-visible'); return; }
    section.hidden=false;card.dataset.adventVisible='true';
    const snapshot=latest;
    if (selected && !snapshot.checkedDates.includes(keyOf(selected))) selected=null;
    if (!selected) selected=Number(snapshot.checkedDates.at(-1)?.slice(-2)) || null;
    const stateKey=JSON.stringify([snapshot.wallet,snapshot.dateKey,snapshot.checkedDates,snapshot.recoveredDates,snapshot.missedDates,latestFresh,selected]);
    if (stateKey===lastState) return;
    lastState=stateKey;
    section.querySelector('.advent-freshness').textContent=latestFresh
      ? 'Tap any saved tree to view its holiday artwork.' : 'Showing last saved attendance while the Arcade refreshes.';
    const calendar=section.querySelector('[data-advent-calendar]');
    calendar.innerHTML=ADVENT_DAYS.map((name,index)=>{
      const day=index+1, status=adventDayStatus(day,snapshot,true), earned=status==='saved'||status==='recovered', pick=day===selected;
      const symbol=status==='recovered'?'<span class="advent-tile-marker is-recovered" aria-hidden="true">✓</span>'
        : status==='saved'?'<span class="advent-tile-marker is-saved" aria-hidden="true">✓</span>'
        : status==='missed'?'<span class="advent-tile-marker is-missed" aria-hidden="true">•</span>'
        : status==='future'?'<span class="advent-tile-marker is-future" aria-hidden="true">⌁</span>':'';
      return '<button type="button" class="advent-tile" data-advent-day="'+day+'" data-advent-status="'+status+'" aria-pressed="'+pick+'" aria-label="December '+day+': '+(earned?escape(name)+', '+(status==='recovered'?'restored':'saved'):status)+'"'+(earned?'':' disabled')+'>'
        +'<span class="advent-tile-number">'+day+'</span>'+(earned?adventTreeSVG(day):'<span class="advent-tile-closed" aria-hidden="true">'+(status==='missed'?'♨':status==='today'?'✦':'◇')+'</span>')
        +symbol+'</button>';
    }).join('');
    const detail=section.querySelector('[data-advent-detail]');
    if (selected) {
      const status=adventDayStatus(selected,snapshot,true);
      detail.innerHTML='<div class="advent-feature-art">'+adventTreeSVG(selected,true)+'</div><div class="advent-feature-copy">'
        +'<span>DECEMBER '+selected+' · '+(selected===25?'CHRISTMAS DAY REVEAL':'HOLIDAY REVEAL')+'</span>'
        +'<h5>'+escape(ADVENT_DAYS[selected-1])+'</h5>'
        +'<p>'+(status==='recovered'?'December '+selected+' check-in restored.':'Saved for December '+selected+'.')+'</p></div>';
    } else detail.innerHTML='<p>Complete a December check-in to reveal your first holiday tree.</p>';
  }
  section.addEventListener('click',event=>{
    const tile=event.target.closest?.('[data-advent-day]');
    if (!tile || tile.disabled) return;
    selected=Number(tile.dataset.adventDay);
    lastState='';render();
  });
  const controller={
    update(snapshot,{wallet=null,fresh=false}={}) {
      if (wallet!==lastWallet){selected=null;lastState='';lastWallet=wallet;}
      latest=snapshot;latestWallet=wallet;latestFresh=fresh;
      render();
    },
    destroy(){section.remove();card.removeAttribute('data-advent-visible');},
  };
  return controller;
}
