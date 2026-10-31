export const WIDTH = 40;
export const HEIGHT = 22;
export const STEP = 0.12;
export const CAVES = [
  { name: 'First light', subtitle: 'Learn the weight of the world.', target: 12, time: 150, seed: 741, tint: '#aabc72' },
  { name: 'The hollow', subtitle: 'Some things down here are awake.', target: 18, time: 170, seed: 903, tint: '#78b6bc' },
  { name: 'Afterglow', subtitle: 'Leave nothing but an echo.', target: 24, time: 190, seed: 1207, tint: '#b79bcb' },
];

function random(seed) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}

export function makeCave(index) {
  const rand = random(CAVES[index].seed);
  const grid = Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH }, (_, x) => {
    if (!x || !y || x === WIDTH - 1 || y === HEIGHT - 1) return '#';
    const n = rand();
    return n < 0.12 ? 'O' : n < 0.19 ? '*' : '.';
  }));
  // A continuous, diggable switchback guarantees a route through every original cave.
  for (const y of [3, 8, 13, 18]) {
    for (let x = 2; x <= 37; x++) grid[y][x] = x % 3 === 0 ? '*' : '.';
    for (let x = 2; x <= 37; x++) grid[y - 1][x] = '.';
  }
  for (let y = 3; y <= 18; y++) {
    const x = y <= 8 || y >= 13 ? 37 : 2;
    grid[y][x] = '.';
    grid[y][x === 37 ? 36 : 3] = '.';
  }
  // Brick shelves are rounded supports: rocks roll off their edges when dug out.
  for (const y of [6, 11, 16]) {
    for (let x = 8; x < 31; x++) grid[y][x] = x % 8 === 0 ? '.' : '+';
    for (let x = 9; x < 30; x += 5) grid[y - 1][x] = 'O';
  }
  for (let y = 1; y <= 4; y++) for (let x = 1; x <= 5; x++) grid[y][x] = '.';
  grid[3][2] = ' ';
  grid[3][3] = '*';
  grid[18][37] = 'X';
  if (index > 0) {
    // Optional enemy pocket: its steel shell protects the main route until opened.
    for (let y = 9; y <= 12; y++) for (let x = 14; x <= 24; x++) {
      grid[y][x] = y === 9 || y === 12 || x === 14 || x === 24 ? '#' : ' ';
    }
    grid[11][14] = '.';
    grid[10][19] = index === 1 ? 'f' : 'b';
  }
  return { grid, player: { x: 2, y: 3 } };
}

const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const key = (x, y) => `${x},${y}`;
const isLoose = tile => tile === 'O' || tile === '*';
const isEnemy = tile => tile === 'f' || tile === 'b';

export class Game {
  constructor(index = 0, mode = 'echo', fixture = null, options = {}) {
    const layout = fixture ?? (options.campaign === 'original' ? decodeOriginal(index, options.difficulty ?? 1) : makeCave(index));
    const cave = layout.original ? layout : CAVES[index];
    this.index = index;
    this.mode = mode;
    this.original = Boolean(layout.original);
    this.bonus = Boolean(layout.bonus);
    this.difficulty = layout.difficulty ?? options.difficulty ?? 1;
    this.grid = layout.grid.map(row => [...row]);
    this.player = { ...layout.player };
    this.target = layout.target ?? cave.target;
    this.remaining = layout.time ?? cave.time;
    this.diamondValue = layout.diamondValue ?? 10;
    this.extraDiamondValue = layout.extraDiamondValue ?? 20;
    this.collected = 0;
    this.score = 0;
    this.tick = 0;
    this.status = 'ready';
    this.reason = '';
    this.falling = new Set(layout.falling ?? []);
    this.facings = new Map(layout.facings ?? []);
    this.blasts = new Map();
    this.magic = { active:false, remaining:layout.magicTime ?? 0 };
    this.amoeba = { dead:null, slow:layout.amoebaTime ?? 0, max:layout.amoebaMax ?? 200 };
    this.randomState = layout.randomState ?? ((layout.seed ?? 741) + index * 8191 + 1);
    this.birthRemaining = layout.birth ?? (this.original ? Math.ceil(2 / STEP) + 4 : 0);
    this.born = this.birthRemaining === 0;
    this.playerAlive = true;
    this.history = [];
    this.rewinds = 3;
    this.events = [];
  }
  tile(x, y) { return this.grid[y]?.[x] ?? '#'; }
  occupied(x, y) { return this.born && this.playerAlive && this.player.x === x && this.player.y === y; }
  empty(x, y) { return this.tile(x, y) === ' ' && !this.occupied(x, y); }
  set(x, y, tile) { this.grid[y][x] = tile; }
  start() { if (this.status === 'ready') this.status = 'playing'; }
  pause() {
    if (this.status === 'playing') this.status = 'paused';
    else if (this.status === 'paused') this.status = 'playing';
  }
  lose(reason) {
    if (this.status !== 'playing') return;
    this.status = 'dead'; this.reason = reason; this.events.push('death');
    if (this.original) this.playerAlive = false;
  }
  snapshot() {
    return {
      grid: this.grid.map(row => [...row]), player: { ...this.player },
      collected: this.collected, score: this.score, tick: this.tick,
      remaining: this.remaining, falling: [...this.falling], facings: [...this.facings],
      blasts:[...this.blasts].map(([cell,blast])=>[cell,{...blast}]),
      magic:{...this.magic}, amoeba:{...this.amoeba}, randomState:this.randomState,
      born:this.born, birthRemaining:this.birthRemaining, playerAlive:this.playerAlive,
    };
  }
  rewind() {
    if (this.mode !== 'echo' || !this.rewinds || !this.history.length || !['playing', 'dead', 'paused'].includes(this.status)) return false;
    const offset = Math.max(0, this.history.length - 16);
    const state = this.history[offset];
    this.history = this.history.slice(0, offset);
    Object.assign(this, state);
    this.falling = new Set(state.falling);
    this.facings = new Map(state.facings);
    this.blasts = new Map(state.blasts);
    this.status = 'playing'; this.reason = ''; this.rewinds--;
    this.events = ['rewind'];
    return true;
  }
  move(dx, dy, snap) {
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    const x = this.player.x + dx, y = this.player.y + dy;
    const tile = this.tile(x, y);
    if(this.original && tile==='*' && !snap && this.falling.has(key(x,y))) return;
    if (tile === 'O' && dy === 0 && this.empty(x + dx, y) && !this.falling.has(key(x, y))) {
      if (snap && !this.original) return;
      if (this.original && this.random(8) !== 0) return;
      this.set(x + dx, y, 'O'); this.set(x, y, ' ');
      this.events.push('push');
    } else if (tile === '.' || tile === '*') {
      this.set(x, y, ' ');
      this.falling.delete(key(x,y));
      if (tile === '*') {
        this.collected++; this.score += this.collected <= this.target ? this.diamondValue : this.extraDiamondValue;
        this.events.push('gem');
        if (this.collected === this.target) this.events.push('unlock');
      } else this.events.push('dig');
    } else if (tile === 'X' && this.collected >= this.target && !snap) {
      this.player = { x, y }; this.status = 'won';
      this.score += Math.ceil(this.remaining); this.events.push('win'); return;
    } else if (tile !== ' ') return;
    else if(this.original) this.events.push('step');
    if (!snap) this.player = { x, y };
  }
  random(limit) {
    let n=this.randomState; n^=n<<13; n^=n>>>17; n^=n<<5;
    this.randomState=n>>>0; return Math.floor(this.randomState / 4294967296 * limit);
  }
  explode(x, y, diamonds) {
    if(this.original) return this.originalExplosion(x,y,diamonds);
    const affected = [];
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
      if (this.tile(xx, yy) === '#') continue;
      if (this.occupied(xx, yy)) this.lose('Caught in the blast.');
      this.set(xx, yy, diamonds ? '*' : ' ');
      this.falling.delete(key(xx, yy));
      affected.push(key(xx, yy));
    }
    this.events.push('blast');
    return affected;
  }
  originalExplosion(x,y,diamonds) {
    const affected=[], pending=[{x,y,diamonds}], centers=new Set();
    while(pending.length) {
      const center=pending.shift(), centerKey=key(center.x,center.y);
      if(centers.has(centerKey)) continue;
      centers.add(centerKey);
      for(let yy=center.y-1;yy<=center.y+1;yy++) for(let xx=center.x-1;xx<=center.x+1;xx++) {
        const tile=this.tile(xx,yy), cell=key(xx,yy);
        if(['#','X','I','e','d'].includes(tile)) continue;
        if((xx!==center.x || yy!==center.y) && isEnemy(tile)) {
          pending.push({x:xx,y:yy,diamonds:tile==='b'}); continue;
        }
        if(this.occupied(xx,yy)) { this.lose('Caught in the blast.'); pending.push({x:xx,y:yy,diamonds:false}); }
        this.set(xx,yy,center.diamonds?'d':'e');
        this.blasts.set(cell,{age:0,result:center.diamonds?'*':' '});
        this.falling.delete(cell); this.facings.delete(cell); affected.push(cell);
      }
    }
    this.events.push('blast'); return affected;
  }
  step(input = {}) {
    if (this.status !== 'playing') return;
    this.events = [];
    if (this.mode === 'echo') {
      this.history.push(this.snapshot());
      if (this.history.length > 48) this.history.shift();
    }
    this.tick++;
    if(this.birthRemaining>0 && --this.birthRemaining===0) {
      this.born=true; this.set(this.player.x,this.player.y,' ');
      if(this.original)this.events.push('birth');
    }
    if(!this.original) this.move(input.dx ?? 0, input.dy ?? 0, Boolean(input.snap));
    if (this.status !== 'playing') return;
    const moved = new Set(), nextFalling = new Set(), nextFacings = new Map();
    for(const [cell,blast] of this.blasts) {
      if(++blast.age>=5) {
        const [x,y]=cell.split(',').map(Number); this.set(x,y,blast.result); this.blasts.delete(cell);
      }
      moved.add(cell);
    }
    let playerMoved=false, amoebaSize=0, amoebaEnclosed=true;
    for (let y = 0; y < this.grid.length; y++) for (let x = 0; x < this.grid[y].length; x++) {
      if(this.original && this.occupied(x,y) && !playerMoved) {
        this.move(input.dx ?? 0,input.dy ?? 0,Boolean(input.snap)); playerMoved=true;
        if(this.status==='won') return;
      }
      if (moved.has(key(x, y))) continue;
      const tile = this.tile(x, y);
      if (isLoose(tile)) {
        const wasFalling = this.falling.has(key(x, y));
        const below = this.tile(x, y + 1);
        if(this.original && !wasFalling && this.empty(x,y+1)) {
          nextFalling.add(key(x,y)); this.falling.add(key(x,y)); continue;
        }
        if (wasFalling && this.occupied(x, y + 1)) { this.lose('A falling rock found you.'); continue; }
        if (wasFalling && isEnemy(below)) {
          for (const cell of this.explode(x, y + 1, below === 'b')) moved.add(cell);
          continue;
        }
        if(this.original && wasFalling && below==='M') {
          if(this.magic.remaining>0) {
            this.magic.active=true; this.set(x,y,' '); this.falling.delete(key(x,y));
            if(this.empty(x,y+2)) {
              this.set(x,y+2,tile==='O'?'*':'O'); moved.add(key(x,y+2)); nextFalling.add(key(x,y+2)); this.falling.add(key(x,y+2));
            }
          }
          continue;
        }
        let nx = x, ny = y;
        if (this.empty(x, y + 1)) ny++;
        else if (['O', '*', '+'].includes(below) && (!this.original || !this.falling.has(key(x,y+1)))) {
          for (const direction of [-1, 1]) {
            if (this.empty(x + direction, y) && this.empty(x + direction, y + 1)) { nx += direction; break; }
          }
        }
        if (nx !== x || ny !== y) {
          this.set(x, y, ' '); this.set(nx, ny, tile);
          this.falling.delete(key(x,y)); this.falling.add(key(nx,ny));
          nextFalling.add(key(nx, ny)); moved.add(key(nx, ny));
        } else if (wasFalling) { this.events.push(this.original?(tile==='O'?'rockLand':'diamondLand'):'land'); this.falling.delete(key(x,y)); }
      } else if (isEnemy(tile)) {
        if (directions.some(([dx, dy]) => this.occupied(x + dx, y + dy) || (this.original && this.tile(x+dx,y+dy)==='a'))) {
          for (const cell of this.explode(x, y, tile === 'b')) moved.add(cell);
          continue;
        }
        const facing = this.facings.get(key(x, y)) ?? 0;
        const turn = tile === 'f' ? 3 : 1;
        const preferred = (facing + turn) % 4;
        let direction = preferred;
        let [dx, dy] = directions[direction];
        if (!this.empty(x + dx, y + dy)) {
          direction = facing; [dx, dy] = directions[direction];
        }
        if (this.empty(x + dx, y + dy)) {
          this.set(x, y, ' '); this.set(x + dx, y + dy, tile);
          moved.add(key(x + dx, y + dy)); nextFacings.set(key(x + dx, y + dy), direction);
        } else nextFacings.set(key(x, y), (facing + (tile === 'f' ? 1 : 3)) % 4);
      } else if(tile==='a') {
        if(this.amoeba.dead) { this.set(x,y,this.amoeba.dead); moved.add(key(x,y)); continue; }
        amoebaSize++;
        if(directions.some(([dx,dy])=>[' ','.'].includes(this.tile(x+dx,y+dy)) && !this.occupied(x+dx,y+dy))) amoebaEnclosed=false;
        const grow=this.random(this.amoeba.slow>0?128:4)<(this.amoeba.slow>0?3:1);
        const [dx,dy]=directions[this.random(4)];
        if(this.born && grow && [' ','.'].includes(this.tile(x+dx,y+dy)) && !this.occupied(x+dx,y+dy)) {
          this.set(x+dx,y+dy,'a'); moved.add(key(x+dx,y+dy));
        }
      }
    }
    // Explosions may replace a cell processed earlier in the scan.
    this.falling = new Set([...nextFalling].filter(cell => {
      const [x, y] = cell.split(',').map(Number); return isLoose(this.tile(x, y));
    }));
    this.facings = nextFacings;
    if(amoebaSize>0 && !this.amoeba.dead) {
      if(amoebaEnclosed) this.amoeba.dead='*';
      else if(amoebaSize>this.amoeba.max) this.amoeba.dead='O';
    }
    if(this.born) this.amoeba.slow=Math.max(0,this.amoeba.slow-STEP);
    if(this.magic.active) {
      this.magic.remaining=Math.max(0,this.magic.remaining-STEP);
      if(this.magic.remaining===0) this.magic.active=false;
    }
    if(this.born) this.remaining = Math.max(0, this.remaining - STEP);
    if (this.remaining <= 0) this.lose('The cave ran out of time.');
  }
}
import { decodeOriginal } from './original-caves.mjs';

