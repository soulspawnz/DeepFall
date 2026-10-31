// Pixel geometry from the pinned C64 sprite atlas; only the palette is changed.
export const atlas = document.createElement('canvas');
export let spritesReady = false;
export const spritesLoaded = new Promise((resolve, reject) => {
  const source = new Image();
  source.onload = () => {
    atlas.width=source.width; atlas.height=source.height;
    const c=atlas.getContext('2d',{willReadFrequently:true}); c.drawImage(source,0,0);
    const pixels=c.getImageData(0,0,atlas.width,atlas.height);
    for(let i=0;i<pixels.data.length;i+=4) {
      const light=Math.round(.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2]);
      pixels.data[i]=Math.round(light*.32); pixels.data[i+1]=light; pixels.data[i+2]=Math.round(light*.42);
    }
    c.putImageData(pixels,0,0); spritesReady=true; resolve();
  };
  source.onerror=()=>reject(new Error('Original sprite atlas could not load'));
  source.src=new URL('./vendor/original-media/sprites.png',import.meta.url).href;
});
export function drawOriginal(ctx,tile,x,y,frame,game) {
  if(!spritesReady)return;
  let col=0,row=6;
  if(tile==='I'&&game.birthRemaining>0&&game.birthRemaining<=3){row=0;col=4-game.birthRemaining;}
  else if(tile==='#')col=1;
  else if(tile==='X'||tile==='I')col=game.collected>=game.target||tile==='I'?1+Math.floor(frame/5)%2:1;
  else if(tile==='+'){col=3;}
  else if(tile==='M'){col=game.magic.active&&game.magic.remaining>0?4+frame%4:3;}
  else if(tile==='O'){row=7;col=0;}
  else if(tile==='.'){row=7;col=1;}
  else if(tile==='e'||tile==='d'){row=7;col=[3,4,5,4,3][Math.min(4,game.blasts.get(`${x},${y}`)?.age??0)];}
  else if(tile==='a'){row=8;col=frame%8;}
  else if(tile==='f'){row=9;col=frame%8;}
  else if(tile==='*'){row=10;col=frame%8;}
  else if(tile==='b'){row=11;col=frame%8;}
  ctx.drawImage(atlas,col*32,row*32,32,32,x*16,y*16,16,16);
}
export function drawRockford(ctx,x,y,frame,direction) {
  if(!spritesReady)return;
  const row=direction===null?1:direction<0?4:5;
  ctx.drawImage(atlas,(frame%8)*32,row*32,32,32,x*16,y*16,16,16);
}
