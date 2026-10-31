import { ORIGINAL_BYTES } from './original-data.mjs';

const NAMES = ['Intro', 'Rooms', 'Maze', 'Butterflies', 'Guards', 'Firefly dens', 'Amoeba', 'Enchanted wall', 'Greed', 'Tracks', 'Crowd', 'Walls', 'Apocalypse', 'Zigzag', 'Funnel', 'Enchanted boxes', 'Intermission 1', 'Intermission 2', 'Intermission 3', 'Intermission 4'];
const HINTS = ['Collect the quota, then find the exit.', 'Move boulders to reach the diamonds.', 'Every diamond counts in this maze.', 'Crush butterflies to make diamonds.', 'Watch the fireflies guarding the diamonds.', 'Each firefly guards a diamond.', 'Enclose the amoeba to turn it into diamonds.', 'Feed falling rocks into the magic wall.', 'Plenty of diamonds. Plenty of falling rocks.', 'Follow the tracks and avoid the fireflies.', 'Make room in a cave packed with boulders.', 'Use an explosion to open the brick walls.', 'Bring butterflies and amoeba together.', 'Spend your boulders carefully.', 'The magic wall waits beneath the funnel.', 'Blast into the rooms, then use their magic walls.', 'A small cave and a single attempt.', 'Plan the diagonal rock falls.', 'Work quickly around the fireflies.', 'Feed the magic walls from above.'];
const ORDER = [0, 1, 2, 3, 16, 4, 5, 6, 7, 17, 8, 9, 10, 11, 18, 12, 13, 14, 15, 19];
const PALETTE = ['#000000','#ffffff','#984b43','#79c1c8','#9b51a5','#68ae5c','#52429d','#c9d684','#9b6739','#6a5400','#c37b75','#636363','#8a8a8a','#a3e599','#8a7bce','#adadad'];

export const ORIGINAL_CAVES = ORDER.map(rawIndex => ({
  id: rawIndex < 16 ? String.fromCharCode(65 + rawIndex) : `I${rawIndex - 15}`,
  name: NAMES[rawIndex], subtitle: HINTS[rawIndex], rawIndex,
  original: true, bonus: rawIndex >= 16, tint: PALETTE[ORIGINAL_BYTES[rawIndex][20]],
}));

// The C64's portable two-byte cave PRNG. Its first updated byte is used
// for threshold tests; all 40 columns are consumed before steel is overlaid.
export function nextCaveRandom(seeds) {
  const bit = (seeds[0] & 1) << 7;
  const half = seeds[1] >> 1;
  let value = seeds[1] + ((seeds[1] & 1) << 7);
  value = (value & 255) + (value > 255 ? 1 : 0) + 19;
  const carry = value > 255 ? 1 : 0;
  seeds[1] = value & 255;
  value = seeds[0] + carry + bit;
  seeds[0] = ((value & 255) + (value > 255 ? 1 : 0) + half) & 255;
  return seeds[0];
}

export function decodeOriginal(index, difficulty = 1) {
  if (!Number.isInteger(index) || !ORIGINAL_CAVES[index] || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw new RangeError('Invalid cave or difficulty');
  const meta = ORIGINAL_CAVES[index], bytes = ORIGINAL_BYTES[meta.rawIndex];
  const codes = Array.from({length:22}, () => Array(40).fill(0));
  const seeds = [0, bytes[3 + difficulty]];
  for(let y=1;y<=20;y++) for(let x=0;x<40;x++) {
    const value = nextCaveRandom(seeds); let tile = 1;
    for(let item=0;item<4;item++) if(value < bytes[28+item]) tile = bytes[24+item];
    codes[y][x] = tile;
  }
  const put = (x,y,tile) => { if(x<0 || x>=40 || y<0 || y>=22) throw new Error('Cave command outside its map'); codes[y][x]=tile; };
  function rectangle(x,y,w,h,tile,fill) {
    for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) {
      if(yy===y || yy===y+h-1 || xx===x || xx===x+w-1) put(xx,yy,tile);
      else if(fill !== undefined) put(xx,yy,fill);
    }
  }
  rectangle(0,0,40,22,7);
  const vectors = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  let cursor = 32;
  while(bytes[cursor] !== 255) {
    if(cursor >= bytes.length) throw new Error('Unterminated cave');
    const command=bytes[cursor++], tile=command & 63, shape=command >> 6;
    const x=bytes[cursor++], y=bytes[cursor++]-2;
    if(shape===0) put(x,y,tile);
    else if(shape===1) {
      const length=bytes[cursor++], direction=bytes[cursor++];
      const [dx,dy]=vectors[direction];
      for(let n=0;n<length;n++) put(x+n*dx,y+n*dy,tile);
    } else {
      const width=bytes[cursor++], height=bytes[cursor++];
      rectangle(x,y,width,height,tile,shape===2 ? bytes[cursor++] : undefined);
    }
  }
  let player;
  const facings = [], falling = [];
  const symbols = {0:' ',1:'.',2:'+',3:'M',4:'X',5:'X',7:'#',16:'O',18:'O',20:'*',22:'*',37:'I',56:'I',58:'a'};
  const grid = codes.map((row,y)=>row.map((tile,x)=>{
    if(tile===37 || tile===56) { if(player) throw new Error('Multiple entrances'); player={x,y}; }
    if(tile===18 || tile===22) falling.push(`${x},${y}`);
    if(tile>=8 && tile<=11) { facings.push([`${x},${y}`,[3,0,1,2][tile-8]]); return 'f'; }
    if(tile>=48 && tile<=51) { facings.push([`${x},${y}`,[3,0,1,2][tile-48]]); return 'b'; }
    if(symbols[tile]===undefined) throw new Error(`Unsupported original object ${tile}`);
    return symbols[tile];
  }));
  if(!player) throw new Error('Cave has no entrance');
  return { ...meta, grid, codes, player, facings, falling, difficulty,
    target:bytes[8+difficulty], time:bytes[13+difficulty], magicTime:bytes[1], amoebaTime:bytes[1],
    diamondValue:bytes[2], extraDiamondValue:bytes[3], colors:bytes.slice(19,22), seed:bytes[3+difficulty],
  };
}

export function nextOriginal(index, difficulty) {
  return index < 19 ? {index:index+1,difficulty} : {index:0,difficulty:Math.min(5,difficulty+1)};
}
