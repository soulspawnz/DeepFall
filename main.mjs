import { drawOriginal, drawRockford, spritesLoaded } from './sprites.mjs';
import { Game, CAVES as EXPEDITION_CAVES, WIDTH, HEIGHT, STEP } from './engine.mjs';
import { ORIGINAL_CAVES, decodeOriginal, nextOriginal } from './original-caves.mjs';
import { SIDAudio } from './audio.mjs';
import { setupFullscreen } from './fullscreen.mjs';
import {LiveRecording, loadLiveRuns, saveLiveRun, applyReplayAction,importLiveRun} from './live-replays.mjs';
import {mountLearning} from './learning-ui.mjs';

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
let recording=null;
let learningUI=null;
const library=document.createElement('section');
library.className='playtest-library';library.hidden=true;library.setAttribute('aria-label','Watch Playtests library');
document.querySelector('.sid-panel')?.before(library);
if(!library.isConnected)document.querySelector('main').append(library);
const libraryMessage=document.createElement('p');libraryMessage.className='replay-notice';libraryMessage.setAttribute('role','status');
function textElement(tag,text,parent){const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;}
function showLibrary(){
 library.replaceChildren();textElement('h3','Watch Playtests',library);
 textElement('p','Live wins are recorded automatically from the start of a fresh cave. Saved runs stay in this browser; export a recording to keep a separate copy. Pauses are omitted from playback. Rewinds are preserved.',library);
 library.append(libraryMessage);
 textElement('h4','Earlier live A / B results',library);
 textElement('p','These two wins were observed live before input recording existed. Their screenshots and results are saved below. They are result records, not playable replays.',library);
 const historical=document.createElement('div');historical.className='playtest-cards';library.append(historical);
 for(const result of [
  {id:'A',name:'Intro',diamonds:'12/12',score:236,time:'1:56',rewinds:2,note:'Exited the cave. Two Echo rewinds were used during the successful attempt. Earlier restarts are not included.'},
  {id:'B',name:'Rooms',diamonds:'10/10',score:282,time:'1:22',rewinds:0,note:'Exited the cave without using a rewind. Snap-digging helped clear blocked corridors.'}
 ]){
  const card=document.createElement('article');card.className='playtest-card';historical.append(card);
  textElement('h4',`Cave ${result.id} / ${result.name} — live win`,card);
  textElement('p',`Original campaign · difficulty 1 · Echo. ${result.diamonds} diamonds · ${result.score} points · ${result.time} remaining · ${result.rewinds} rewinds used.`,card);
  textElement('p',result.note,card);textElement('p','Replay unavailable: inputs were not recorded.',card);
  const a=document.createElement('a');a.href=`./docs/live-${result.id}-won.png`;a.target='_blank';a.rel='noopener';
  const img=document.createElement('img');img.src=a.href;img.alt=`Live Cave ${result.id} win screen`;img.loading='lazy';a.append(img);card.append(a);
 }
 textElement('p','C has not been cleared live. Best attempt so far: 19/24 diamonds, ended in death. A and B do not establish a full campaign completion.',library);
 textElement('h4','Recorded live wins',library);
 const importButton=textElement('button','IMPORT LIVE RECORDING',library),input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;library.append(input);
 importButton.addEventListener('click',()=>input.click());
 input.addEventListener('change',async()=>{const file=input.files[0];input.value='';if(!file)return;try{if(file.size>8*1024*1024)throw new Error('Choose a recording smaller than 8 MB.');const added=importLiveRun(localStorage,JSON.parse(await file.text()));libraryMessage.textContent=added?'Live recording imported and verified.':'This recording is already saved.';showLibrary();}catch(error){libraryMessage.textContent=`Import failed: ${error.message}`;}});
 let runs=[];try{runs=loadLiveRuns(localStorage);}catch{}
 if(!runs.length)textElement('p','No exact live-input recordings yet. Earlier screenshots are kept separately above.',library);
 const saved=document.createElement('div');saved.className='playtest-cards';library.append(saved);
 for(const run of runs){
  const card=document.createElement('article');card.className='playtest-card';saved.append(card);
  const name=run.campaign==='original'?ORIGINAL_CAVES[run.index].id:run.index+1;
  textElement('h4',`Cave ${name} · difficulty ${run.difficulty} · ${run.mode}`,card);
  textElement('p',`${run.result.diamonds} diamonds · ${run.result.score} points · ${run.result.rewindsUsed} rewinds used · ${run.recordedAt}`,card);
  const watch=textElement('button','REPLAY LIVE WIN',card);watch.addEventListener('click',()=>{replay={attempts:[{...run,input:run.actions}],index:0,tick:0,delay:0,live:true};beginReplay();});
  const download=textElement('button','EXPORT RECORDING',card);download.addEventListener('click',()=>{
   const url=URL.createObjectURL(new Blob([JSON.stringify(run,null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download=`deepfall-${run.campaign}-${run.index}-${run.difficulty}-live.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
 }
 textElement('h4','Automated test archive',library);
 textElement('p','300 automated attempts: 26 wins, 258 deaths, 16 timeouts. These are separate from live play. Each replay shows its recorded outcome.',library);
 const archive=textElement('button','WATCH AUTOMATED ARCHIVE',library);archive.addEventListener('click',startArchive);
 const close=textElement('button','CLOSE LIBRARY',library);close.addEventListener('click',()=>{library.hidden=true;});
}
const replayButton=document.createElement('button');
replayButton.id='watch-tests';replayButton.textContent='WATCH PLAYTESTS';
replayButton.className='quiet';
$('pause').parentElement.append(replayButton);
const replayCaption=document.createElement('p');replayCaption.className='replay-caption';replayCaption.hidden=true;replayCaption.setAttribute('aria-live','polite');replayButton.parentElement.after(replayCaption);
replayButton.addEventListener('click',async()=>{
 if(replay){replay=null;replayButton.textContent='WATCH PLAYTESTS';libraryMessage.textContent='Playback stopped.';replayCaption.textContent='Playback stopped.';game.pause();sync();return;}
 library.hidden=!library.hidden;
 if(!library.hidden){if(game.status==='playing')game.pause();sync();showLibrary();}
});
async function startArchive(){
 replayButton.disabled=true;
 try {
  const response=await fetch(new URL('./docs/playtest-original.json',import.meta.url));if(!response.ok)throw new Error('Replay data unavailable');
  const report=await response.json();replay={attempts:report.attempts,index:0,tick:0,delay:0};
  beginReplay();
 }catch(error){libraryMessage.textContent=error.message;}finally{replayButton.disabled=false;}
}
function beginReplay(){
 const attempt=replay.attempts[replay.index];
 campaign=attempt.campaign??'original';difficulty=attempt.difficulty;mode=attempt.mode??'classic';
 $('campaign').value=campaign;$('difficulty').value=String(difficulty);$('difficulty').disabled=campaign!=='original';
 newGame(attempt.index,true);game.start();replay.tick=0;replay.delay=0;
 replay.finished=false;
 for(const item of ['echo','classic']){$(item+'-mode').classList.toggle('selected',item===mode);$(item+'-mode').setAttribute('aria-pressed',String(item===mode));}
 replayButton.textContent=`STOP REPLAY ${replay.index+1}/${replay.attempts.length}`;
 const kind=attempt.replayKind==='baseline'?'Before learning':attempt.replayKind==='evaluation'?`Policy evaluation after ${attempt.learningAttempts} attempts`:attempt.replayKind==='training'?`Training attempt ${attempt.learningAttempts}`:attempt.replayKind==='partial'?'Best partial route (not an escape)':'Best learned run';
 replayCaption.hidden=false;replayCaption.textContent=replay.learned?`AI replay ${replay.index+1}/${replay.attempts.length} · ${kind} · recorded result: ${attempt.status}${attempt.reconstructed?' · verified reconstruction':''}`:replay.live?'Recorded live-input replay.':`Automated archive replay ${replay.index+1}/${replay.attempts.length} · recorded result: ${attempt.status}`;
 replayButton.title=replayCaption.textContent;
 libraryMessage.textContent=replay.live?'Playing an exact recorded live run, including rewind actions.':replay.learned?`AI replay after ${attempt.learningAttempts} training attempts. Recorded outcome: ${attempt.status}.`:`Automated attempt ${replay.index+1}/${replay.attempts.length}. Recorded outcome: ${attempt.status}.`;
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
  const fastTrappedTimer=keepReplay?Boolean(replay.attempts[replay.index].fastTrappedTimer):true;
  selected = index; game = new Game(index, mode, null, {campaign,difficulty,fastTrappedTimer}); held = []; snap = false;
  recording=keepReplay?null:new LiveRecording({campaign,index,difficulty,mode,fastTrappedTimer});
  viewWidth=game.bonus?20:WIDTH; viewHeight=game.bonus?12:HEIGHT;
  canvas.width=viewWidth*TILE; canvas.height=viewHeight*TILE;
  accumulator = 0; flash = 0;
  sidAudio.configure({profile:campaign});sidAudio.reset();
  $('sid-music').disabled=false;$('sid-music').textContent=sidAudio.settings.music?'MUSIC ON':'MUSIC OFF';
  $('sid-music').setAttribute('aria-pressed',String(sidAudio.settings.music));
  if(!sound)$('sid-readout').textContent=campaign==='original'?'reSID EMULATION / PAL / ORIGINAL GAMEPLAY EFFECTS':'reSID EMULATION / PAL / DEEPFALL SCORE';
  updateCaves(); sync();
  learningUI?.refresh();
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
  sidAudio.configure({ paused: document.hidden || game.status === 'paused', mood: document.hidden?'silent':game.status==='paused'?'pause':game.status==='dead'?'death':'play' });
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
  const statuses = { ready: campaign==='original'?'ORIGINAL CAVE · STANDING BY':'STANDING BY', playing: !game.born?'ENTERING THE CAVE':game.timerRate>1?`TRAPPED · TIMER ×${game.timerRate}`:game.collected >= game.target ? 'EXIT OPEN · FIND YOUR WAY OUT' : 'EXPEDITION IN PROGRESS', paused: 'EXPEDITION PAUSED', dead: game.bonus?'BONUS ATTEMPT OVER':'SIGNAL LOST', won: 'BACK ABOVE GROUND' };
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
      const [dx, dy] = directionKeys[direction] ?? directionNames[direction] ?? [0, 0];
      if(replay){
       const action=replay.attempts[replay.index].input[replay.tick++];
       if(!action){const limited=replay.learned&&replay.attempts[replay.index].status==='budget';game.pause();if(limited){replay.finished=true;replay.delay=0;libraryMessage.textContent='AI attempt reached its training limit.';}else{replay=null;replayButton.textContent='WATCH PLAYTESTS';libraryMessage.textContent='Replay ended before a terminal result.';}sync();break;}
       applyReplayAction(game,action);
      } else {const input={dx,dy,snap:snap||touchSnap};recording?.step(input);game.step(input);}
      sounds();
      if (game.status === 'won') {
       completed.add(completionKey()); updateCaves();
       const run=recording?.finish(game);recording=null;
       if(run)try{saveLiveRun(localStorage,run);libraryMessage.textContent='Live win saved. Open Watch Playtests to replay or export it.';}catch{libraryMessage.textContent='The win could not be saved in browser storage.';}
      }
      sync();
    }
  } else {
    accumulator = 0;
    if(replay&&game.status==='dead'&&replay.attempts[replay.index].input[replay.tick]?.rewind){
      applyReplayAction(game,replay.attempts[replay.index].input[replay.tick++]);sounds();sync();
    }
    if(replay&&(replay.finished||['dead','won'].includes(game.status))&&(replay.delay+=elapsed)>2){
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
  else if (!event.repeat && event.code === 'KeyZ') { if (!replay && game.rewind()) { recording?.rewind();sounds(); sync(); } }
});
document.addEventListener('keyup', event => { held = held.filter(code => code !== event.code); if (event.code === 'Space') snap = false; });
function unfocus() { held = []; snap = false; if (game.status === 'playing') game.pause(); sync(); }
window.addEventListener('blur', unfocus);
window.addEventListener('focus', sync);
document.addEventListener('visibilitychange', () => { if (document.hidden) unfocus(); else sync(); });
$('play').addEventListener('click', play);
$('pause').addEventListener('click', () => { game.pause(); sync(); });
$('restart').addEventListener('click', () => { newGame(); play(); });
$('rewind').addEventListener('click', () => { if (!replay && game.rewind()) { recording?.rewind();sounds(); sync(); canvas.focus({ preventScroll: true }); } });
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
for (const name of ['music', 'effects']) $('sid-' + name).addEventListener('click', async () => {
  const enabled = !sidAudio.settings[name]; sidAudio.configure({ [name]: enabled });
  $('sid-' + name).setAttribute('aria-pressed', String(enabled));
  $('sid-' + name).textContent = `${name.toUpperCase()} ${enabled ? 'ON' : 'OFF'}`;
  if(enabled&&!sound)await enableAudio();
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
setupFullscreen(); newGame();
learningUI=mountLearning({
 getContext:()=>({campaign,index:selected,difficulty}),
 pause:()=>{if(game.status==='playing'){game.pause();sync();}},
 onWatch:attempt=>{replay={attempts:Array.isArray(attempt)?attempt:[attempt],index:0,tick:0,delay:0,learned:true};beginReplay();canvas.focus({preventScroll:true});canvas.scrollIntoView({block:'center',behavior:'smooth'});}
});
requestAnimationFrame(loop);
