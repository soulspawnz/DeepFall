import { drawOriginal, drawRockford, spritesLoaded } from './sprites.mjs';
import { Game, CAVES as EXPEDITION_CAVES, WIDTH, HEIGHT, STEP } from './engine.mjs';
import { ORIGINAL_CAVES, decodeOriginal, nextOriginal } from './original-caves.mjs';
import { SIDAudio } from './audio.mjs';
import { setupFullscreen } from './fullscreen.mjs';

const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const TILE = 16;
let campaign = 'original', difficulty = 1, selected = 0, mode = 'classic';
let game = new Game(0, mode, null, {campaign,difficulty});
let viewWidth=WIDTH, viewHeight=HEIGHT;
let held = [], snap = false, touchSnap = false, last = 0, accumulator = 0, flash = 0;
let sound = false;
const sidAudio = new SIDAudio(updateAudio);
const completed = new Set();
let replay=null;
const replayButton=document.createElement('button');
replayButton.id='watch-tests';replayButton.textContent='WATCH PLAYTESTS';
replayButton.className='quiet';
$('pause').parentElement.append(replayButton);
replayButton.addEventListener('click',async()=>{
 if(replay){replay=null;replayButton.textContent='WATCH PLAYTESTS';game.pause();sync();return;}
 replayButton.disabled=true;
 try {
  const response=await fetch(new URL('./docs/playtest-original.json',import.meta.url));if(!response.ok)throw new Error('Replay data unavailable');
  const report=await response.json();replay={attempts:report.attempts,index:0,tick:0,delay:0};
  beginReplay();
 }catch(error){replayButton.textContent=error.message;}finally{replayButton.disabled=false;}
});
function beginReplay(){
 const attempt=replay.attempts[replay.index];
 campaign='original';difficulty=attempt.difficulty;mode='classic';
 $('campaign').value='original';$('difficulty').value=String(difficulty);$('difficulty').disabled=false;
 newGame(attempt.index,true);game.start();replay.tick=0;replay.delay=0;
 for(const item of ['echo','classic']){$(item+'-mode').classList.toggle('selected',item==='classic');$(item+'-mode').setAttribute('aria-pressed',String(item==='classic'));}
 replayButton.textContent=`STOP REPLAY ${replay.index+1}/300`;
}
const caves = () => campaign==='original' ? ORIGINAL_CAVES : EXPEDITION_CAVES;
const caveInfo = index => campaign==='original' ? decodeOriginal(index,difficulty) : EXPEDITION_CAVES[index];
const completionKey = (index=selected) => `${campaign}:${difficulty}:${index}`;
const directionKeys = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0],
};
const directionNames = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function sounds() {
  const events = [...new Set(game.events)];
  sidAudio.configure({scene:{active:game.status==='playing',amoeba:game.born&&game.grid.some(row=>row.includes('a')),magic:game.magic.active&&game.magic.remaining>0,remaining:game.remaining}});
  sidAudio.effects(events);
  if (events.includes('death') || events.includes('blast')) flash = .7;
  else if (events.includes('rewind')) flash = .35;
  game.events = [];
}

function newGame(index = selected, keepReplay=false) {
  if(replay&&!keepReplay){replay=null;replayButton.textContent='WATCH PLAYTESTS';}
  selected = index; game = new Game(index, mode, null, {campaign,difficulty}); held = []; snap = false;
  viewWidth=game.bonus?20:WIDTH; viewHeight=game.bonus?12:HEIGHT;
  canvas.width=viewWidth*TILE; canvas.height=viewHeight*TILE;
  accumulator = 0; flash = 0;
  sidAudio.configure({profile:campaign,music:campaign==='deepfall'});sidAudio.reset();
  $('sid-music').disabled=campaign==='original';$('sid-music').textContent=campaign==='original'?'MUSIC OFF':'MUSIC ON';
  $('sid-music').setAttribute('aria-pressed',String(campaign==='deepfall'));
  if(!sound)$('sid-readout').textContent=campaign==='original'?'reSID EMULATION / PAL / ORIGINAL GAMEPLAY EFFECTS':'reSID EMULATION / PAL / DEEPFALL SCORE';
  updateCaves(); sync();
}
function advance() {
  if(campaign==='original') {
    const next=nextOriginal(selected,difficulty); difficulty=next.difficulty;
    $('difficulty').value=String(difficulty); newGame(next.index);
  } else newGame((selected+1)%caves().length);
}
function play() {
  if (game.status === 'won' || (game.status==='dead' && game.bonus)) {
    advance(); game.start();
  } else if (game.status === 'dead') { newGame(); game.start(); }
  else if (game.status === 'paused') game.pause();
  else game.start();
  accumulator = 0; canvas.focus({ preventScroll: true });
  sync();
}
function updateCaves() {
  $('caves').replaceChildren(...caves().map((meta, i) => {
    const cave=caveInfo(i);
    const button = document.createElement('button');
    button.className = `cave-button${selected === i ? ' active' : ''}${cave.bonus?' bonus-cave':''}`;
    button.setAttribute('aria-pressed', String(selected === i));
    button.innerHTML = `<span class="cave-index">${cave.id ?? String(i+1).padStart(2,'0')}</span><span><strong>${cave.name}</strong><small>${cave.target} GEMS · ${cave.time} SEC${cave.bonus?' · BONUS':''}</small></span><span class="cave-arrow">${completed.has(completionKey(i)) ? '✓' : selected === i ? '↗' : '·'}</span>`;
    button.addEventListener('click', () => newGame(i));
    return button;
  }));
  const active=$('caves').querySelector('.active');
  if(active) $('caves').scrollTop=active.offsetTop-$('caves').firstElementChild.offsetTop;
}
function sync() {
  sidAudio.configure({ paused: game.status === 'paused' || document.hidden });
  const cave=caveInfo(selected);
  $('cave-number').textContent = campaign==='original' ? `${cave.id} / LEVEL ${difficulty}` : `${String(selected+1).padStart(2,'0')} / 03`;
  $('cave-name').textContent = cave.name.toUpperCase();
  $('diamonds').textContent = String(game.collected).padStart(2, '0');
  $('target').textContent = game.target;
  const seconds = Math.ceil(game.remaining);
  $('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('timer').style.color = seconds < 30 ? '#eb9c76' : '';
  $('score').textContent = String(game.score).padStart(6, '0');
  $('charges').textContent = game.rewinds;
  $('rewind').disabled = mode !== 'echo' || !game.rewinds || !game.history.length || game.status === 'won';
  $('pause').disabled = !['playing', 'paused'].includes(game.status);
  $('pause').textContent = game.status === 'paused' ? '▷ RESUME' : 'Ⅱ PAUSE';
  $('overlay').hidden = game.status === 'playing';
  const statuses = { ready: campaign==='original'?'ORIGINAL CAVE · STANDING BY':'STANDING BY', playing: !game.born?'ENTERING THE CAVE':game.collected >= game.target ? 'EXIT OPEN · FIND YOUR WAY OUT' : 'EXPEDITION IN PROGRESS', paused: 'EXPEDITION PAUSED', dead: game.bonus?'BONUS ATTEMPT OVER':'SIGNAL LOST', won: 'BACK ABOVE GROUND' };
  $('status-text').textContent = statuses[game.status];
  if (game.status === 'playing') return;
  const allDone = campaign==='deepfall' && caves().every((_,i)=>completed.has(completionKey(i)));
  const views = {
    ready: [campaign==='original'?`BOULDER DASH I · ${cave.bonus?'BONUS':`CAVE ${cave.id}`} · LEVEL ${difficulty}`:`${40 + selected * 35} METRES BELOW THE SURFACE`, campaign==='original'?`${cave.name}.<br>${game.target} diamonds. One exit.`:'Trust your instincts.<br>Watch the ceiling.', cave.subtitle, 'ENTER THE CAVE', game.bonus?'ONE BONUS ATTEMPT · CONTINUE IF YOU FALL':'ARROWS / WASD TO MOVE'],
    paused: ['TAKE A BREATH', 'The mountain<br>can wait.', 'Your expedition is paused. Everything stays right here.', 'KEEP DIGGING', 'P TO RESUME'],
    dead: [game.bonus?'BONUS ATTEMPT OVER':'THE UNDERGROUND DOES NOT FORGIVE', game.bonus?'Keep going.<br>The next cave awaits.':'A little wiser.<br>A little deeper.', game.reason + (mode === 'echo' && game.rewinds && game.history.length ? ' Press Z to take it back.' : ''), game.bonus?'CONTINUE':'TRY AGAIN', (game.bonus?'R TO RETRY BONUS':'R TO RESTART') + (mode === 'echo' ? ' · Z TO REWIND' : '')],
    won: [allDone ? 'EXPEDITION COMPLETE' : 'YOU MADE IT OUT', allDone ? 'Every cave.<br>Every consequence.' : 'Another cave.<br>Another story.', `${game.collected} diamonds recovered. ${game.score} points. ${allDone ? 'The mountain will be here when you return.' : campaign==='original'&&selected===19?`Next: Cave A, difficulty ${Math.min(5,difficulty+1)}.`:cave.subtitle}`, allDone ? 'EXPLORE AGAIN' : 'NEXT DESCENT', 'ENTER TO CONTINUE'],
  };
  const [label, title, copy, action, hint] = views[game.status];
  $('overlay-label').textContent = label; $('overlay-title').innerHTML = title;
  $('overlay-copy').textContent = copy;
  $('play').innerHTML = `${action} <span>↵</span>`;
  $('overlay-hint').textContent = hint;
}

function draw(now) {
 ctx.imageSmoothingEnabled=false;ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
 const frame=Math.floor(now/50);
 for(let y=0;y<viewHeight;y++)for(let x=0;x<viewWidth;x++)drawOriginal(ctx,game.tile(x,y),x,y,frame,game);
 const direction=directionKeys[held.at(-1)]??directionNames[held.at(-1)];
 if(game.born&&game.playerAlive)drawRockford(ctx,game.player.x,game.player.y,frame,direction?.[0]??null);
}
spritesLoaded.catch(error=>{ $('status-text').textContent=error.message; });
function loop(now) {
  const elapsed = Math.min((now - last) / 1000, .2); last = now;
  if (game.status === 'playing') {
    accumulator += elapsed;
    while (accumulator >= STEP && game.status === 'playing') {
      accumulator -= STEP;
      const direction = held.at(-1);
      const [dx, dy] = replay ? replay.attempts[replay.index].input[replay.tick++]??[0,0] : directionKeys[direction] ?? directionNames[direction] ?? [0, 0];
      game.step({ dx, dy, snap: snap || touchSnap }); sounds();
      if (game.status === 'won') { completed.add(completionKey()); updateCaves(); }
      sync();
    }
  } else {
    accumulator = 0;
    if(replay&&['dead','won'].includes(game.status)&&(replay.delay+=elapsed)>2){
      if(++replay.index<replay.attempts.length)beginReplay();
      else{replay=null;replayButton.textContent='WATCH PLAYTESTS';}
    }
  }
  flash = Math.max(0, flash - elapsed);
  draw(now); requestAnimationFrame(loop);
}

document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  // Keep keyboard activation of the page's ordinary buttons accessible.
  if (event.target.tagName === 'BUTTON' && ['Space', 'Enter'].includes(event.code)) return;
  if (directionKeys[event.code]) {
    event.preventDefault();
    if (!held.includes(event.code)) held.push(event.code);
    if (game.status === 'ready') play();
  } else if (event.code === 'Space') { event.preventDefault(); snap = true; if (game.status === 'ready') play(); }
  else if (!event.repeat && event.code === 'Enter') { event.preventDefault(); if (game.status !== 'playing') play(); }
  else if (!event.repeat && event.code === 'KeyP') { game.pause(); sync(); }
  else if (!event.repeat && event.code === 'KeyR') { newGame(); play(); }
  else if (!event.repeat && event.code === 'KeyZ') { if (game.rewind()) { sounds(); sync(); } }
});
document.addEventListener('keyup', event => { held = held.filter(code => code !== event.code); if (event.code === 'Space') snap = false; });
function unfocus() { held = []; snap = false; if (game.status === 'playing') game.pause(); sync(); }
window.addEventListener('blur', unfocus);
window.addEventListener('focus', sync);
document.addEventListener('visibilitychange', () => { if (document.hidden) unfocus(); else sync(); });
$('play').addEventListener('click', play);
$('pause').addEventListener('click', () => { game.pause(); sync(); });
$('restart').addEventListener('click', () => { newGame(); play(); });
$('rewind').addEventListener('click', () => { if (game.rewind()) { sounds(); sync(); canvas.focus({ preventScroll: true }); } });
async function enableAudio() {
  $('sound').disabled = true;
  $('sid-state').textContent = 'STARTING SID';
  try {
    await sidAudio.enable(); sound = true;
    $('sound').textContent = 'SOUND ON'; $('sound').setAttribute('aria-pressed', 'true');
    $('sid-state').textContent = `MOS ${sidAudio.settings.model} / PAL / MONO`;
    return true;
  } catch (error) {
    sound = false; $('sound').textContent = 'RETRY AUDIO';
    $('sound').setAttribute('aria-pressed', 'false');
    $('sid-state').textContent = `AUDIO ERROR: ${error.message}`;
    return false;
  } finally { $('sound').disabled = false; }
}
function updateAudio(data) {
  if (data.error) {
    sound = false; $('sound').textContent = 'AUDIO ERROR';
    $('sound').setAttribute('aria-pressed', 'false');
    $('sid-state').textContent = data.error; return;
  }
  if (!sound) return;
  $('sid-state').textContent = `MOS ${data.model} / PAL / MONO`;
  $('sid-meter').value = data.peak ?? 0;
  $('sid-readout').textContent = `${data.writes} REG WRITES / ${data.effects} FX / LAST: ${data.lastEffect.toUpperCase()}`;
}
$('sound').addEventListener('click', async () => {
  if (sound) {
    sidAudio.disable(); sound = false;
    $('sound').textContent = 'SOUND OFF'; $('sound').setAttribute('aria-pressed', 'false');
    $('sid-state').textContent = 'SID MUTED'; $('sid-meter').value = 0;
  } else await enableAudio();
});
$('sid-demo').addEventListener('click', async () => {
  if (!sound && !(await enableAudio())) return;
  if (game.status === 'paused') { game.pause(); sync(); }
  sidAudio.demo();
});
$('sid-model').addEventListener('change', () => sidAudio.configure({ model: $('sid-model').value }));
for (const name of ['music', 'effects']) $('sid-' + name).addEventListener('click', () => {
  const enabled = !sidAudio.settings[name]; sidAudio.configure({ [name]: enabled });
  $('sid-' + name).setAttribute('aria-pressed', String(enabled));
  $('sid-' + name).textContent = `${name.toUpperCase()} ${enabled ? 'ON' : 'OFF'}`;
});
$('sid-volume').addEventListener('input', () => sidAudio.configure({ master: Number($('sid-volume').value) / 100 * .6 }));
$('campaign').addEventListener('change',()=>{
  campaign=$('campaign').value; $('difficulty').disabled=campaign!=='original'; newGame(0);
});
$('difficulty').addEventListener('change',()=>{difficulty=Number($('difficulty').value);newGame();});
for (const nextMode of ['echo', 'classic']) $(nextMode + '-mode').addEventListener('click', () => {
  if (mode === nextMode) return;
  mode = nextMode;
  for (const item of ['echo', 'classic']) {
    $(item + '-mode').classList.toggle('selected', item === mode);
    $(item + '-mode').setAttribute('aria-pressed', String(item === mode));
  }
  $('mode-description').textContent = mode === 'echo' ? 'A second chance in the dark. Three short rewinds per cave, and a warning beneath falling rocks.' : 'Just you and the mountain. No rewinds, no warnings. Every move has weight.';
  newGame();
});
document.querySelectorAll('[data-dir]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); button.setPointerCapture(event.pointerId);
    const dir = button.dataset.dir;
    if (!held.includes(dir)) held.push(dir);
    if (game.status === 'ready') play();
  });
  const release = () => { held = held.filter(code => code !== button.dataset.dir); };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
});
$('snap-touch').addEventListener('click', () => {
  touchSnap = !touchSnap; $('snap-touch').setAttribute('aria-pressed', String(touchSnap));
  $('snap-touch').textContent = touchSnap ? 'SNAP DIG ON' : 'SNAP DIG';
});
setupFullscreen(); newGame(); requestAnimationFrame(loop);
