// Original vector artwork, cached at 3x resolution. Presentation only.
const cache=new Map(),SIZE=48;
function polygon(c,points,fill,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.45;c.stroke();}}
function disc(c,x,y,r,fill){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();}
function gradient(c,a,b){const g=c.createLinearGradient(1,0,15,16);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
function sprite(type,variant=0,frame=0){
 const key=`${type}:${variant}:${frame}`;if(cache.has(key))return cache.get(key);
 const image=document.createElement('canvas');image.width=image.height=SIZE;const c=image.getContext('2d');c.scale(3,3);
 c.fillStyle='#071415';c.fillRect(0,0,16,16);
 // Quiet mineral flecks provide orientation in cleared corridors.
 c.fillStyle='#102224';c.fillRect((variant*5+3)%14+1,(variant*3+7)%14+1,.7,.7);
 if(type==='.' ){
  c.fillStyle=gradient(c,'#414735','#242d27');c.fillRect(0,0,16,16);
  for(let i=0;i<9;i++){const x=(i*7+variant*3)%16,y=(i*11+variant*5)%16;disc(c,x,y,i%2?.45:.8,i%2?'#59604a':'#1b2a24');}
  c.strokeStyle='#1a2823';c.lineWidth=.6;c.beginPath();c.moveTo(0,10+variant);c.lineTo(5,7);c.lineTo(10,9);c.lineTo(16,5);c.stroke();
 }else if(type==='#'){
  c.fillStyle=gradient(c,'#536b6b','#203637');c.fillRect(.35,.35,15.3,15.3);
  polygon(c,[[.5,.5],[15.5,.5],[13,3],[3,3],[3,13],[.5,15.5]],'#76908a');
  polygon(c,[[15.5,.5],[15.5,15.5],[.5,15.5],[3,13],[13,13],[13,3]],'#172d30');
  c.fillStyle='#30484a';c.fillRect(3.6,3.6,8.8,8.8);for(const x of [2,14])for(const y of [2,14])disc(c,x,y,.5,'#a5b6a1');
 }else if(type==='+'||type==='M'){
  const magic=type==='M',pulse=(frame%8)/8;
  c.fillStyle=magic?'#192b3c':'#162c30';c.fillRect(0,0,16,16);
  for(let row=0;row<2;row++)for(let col=-1;col<2;col++){
   const x=col*10+(row?5:0);c.fillStyle=gradient(c,magic?'#577c9a':'#517075',magic?'#26374d':'#294447');c.fillRect(x+.5,row*8+.5,9,7);
   c.fillStyle=magic?`rgba(112,244,222,${.25+pulse*.5})`:'#76908b';c.fillRect(x+1,row*8+1,8,.6);
  }
  if(magic){c.strokeStyle=`rgba(169,150,255,${.35+pulse*.5})`;c.lineWidth=.7;c.beginPath();c.moveTo(2,12);c.lineTo(7,3);c.lineTo(6,10);c.lineTo(13,4);c.stroke();}
 }else if(type==='O'){
  disc(c,8,9,7,'#020b0f');
  polygon(c,[[2,5],[5,1.6],[11,1.2],[14.5,5.5],[14,11],[10.3,14],[4,13.5],[1,9]],gradient(c,'#a2aca1','#364b4e'),'#172d31');
  polygon(c,[[2,5],[5,1.6],[11,1.2],[8,6],[4,8]],'#bac1ac');
  polygon(c,[[8,6],[11,1.2],[14.5,5.5],[14,11],[10,10]],'#697e7b');
  polygon(c,[[4,8],[8,6],[10,10],[7,13],[4,13.5]],'#718482');
  c.strokeStyle='#344b4e';c.lineWidth=.45;c.beginPath();c.moveTo(5,3);c.lineTo(7,7);c.lineTo(11,8);c.stroke();
  disc(c,4+variant,11,.55,'#657d4c');
 }else if(type==='*'){
  const turn=Math.sin(frame*Math.PI/4)*1.3,glow=c.createRadialGradient(8,8,1,8,8,9);glow.addColorStop(0,'#2a7560');glow.addColorStop(1,'#071415');c.fillStyle=glow;c.fillRect(0,0,16,16);
  polygon(c,[[3,5],[6,2],[11,2],[14,5],[8,14]],'#59e4b5','#b9ffe4');
  polygon(c,[[3,5],[8+turn,5],[8,14]],'#28a48f');polygon(c,[[8+turn,5],[14,5],[8,14]],'#b5ffe1');
  polygon(c,[[3,5],[6,2],[8+turn,5]],'#e1fff2');polygon(c,[[6,2],[11,2],[8+turn,5]],'#81e9c1');
  if(frame%4===0){c.fillStyle='#eaffef';c.fillRect(12,1,1,4);c.fillRect(10.5,2.5,4,1);}
 }else if(type==='a'){
  c.fillStyle='#0c3027';c.fillRect(0,0,16,16);
  for(let i=0;i<5;i++){const x=3+(i*7+variant*2)%11,y=3+(i*5+variant)%10,r=2.5+Math.sin((frame+i)*Math.PI/4)*.5;disc(c,x,y,r,'#32845a');disc(c,x-.5,y-.7,r*.56,'#6bc57b');disc(c,x-.8,y-1,r*.2,'#bbef98');}
 }else if(type==='b'||type==='f'){
  const wing=2.5+Math.sin(frame*Math.PI/4)*1.6,butterfly=type==='b';
  c.save();c.translate(8,8);c.rotate(butterfly?.2:-.2);
  for(const sign of [-1,1]){c.save();c.scale(sign,1);polygon(c,[[1,-2],[6,-wing-2],[5,3],[1,5]],gradient(c,butterfly?'#baa4ff':'#ffe27e',butterfly?'#5265bc':'#d77d35'),'#071415');c.restore();}
  disc(c,0,-3,1.7,butterfly?'#d9e8fc':'#fff2b5');c.fillStyle=butterfly?'#33415f':'#70472f';c.fillRect(-1,-2,2,7);disc(c,-.6,-3.4,.35,'#15202a');disc(c,.6,-3.4,.35,'#15202a');c.restore();
 }else if(type==='X'||type==='I'){
  c.fillStyle=gradient(c,'#546563','#1f3738');c.fillRect(1,0,14,16);c.fillStyle='#081b1d';c.fillRect(3,2,10,14);
  if(variant===1||type==='I'){
   const g=c.createRadialGradient(8,9,1,8,9,8);g.addColorStop(0,'#b5ffd3');g.addColorStop(.5,'#47bc8f');g.addColorStop(1,'#0e3c32');c.fillStyle=g;c.fillRect(4,3,8,13);
   c.strokeStyle='#d0ffe1';c.lineWidth=.6;c.beginPath();c.moveTo(6,9);c.lineTo(10,9);c.lineTo(8.5,7.5);c.moveTo(10,9);c.lineTo(8.5,10.5);c.stroke();
  }else{c.fillStyle='#30494c';c.fillRect(4,3,8,13);c.fillStyle='#b9b898';c.fillRect(10,9,1,2);}
 }else if(type==='e'||type==='d'){
  const radius=3+frame*1.8,g=c.createRadialGradient(8,8,.3,8,8,Math.max(4,radius));g.addColorStop(0,'#fff9d8');g.addColorStop(.35,'#ffce78');g.addColorStop(.7,'#c75b43');g.addColorStop(1,'rgba(182,50,36,0)');c.fillStyle=g;c.fillRect(0,0,16,16);
 }else if(type==='player'){
  const stride=Math.sin(frame*Math.PI/2),facing=variant===1?-1:1;
  c.save();c.translate(8,8);c.scale(facing,1);
  c.fillStyle='#081015';c.fillRect(-4,-3,8,9);
  c.fillStyle='#c5d7c6';c.fillRect(-3,-1,6,5);c.fillStyle='#6c8a80';c.fillRect(-4,-1,2,5);
  c.fillStyle='#203d43';c.fillRect(-3,4,2,3+stride*.6);c.fillRect(1,4,2,3-stride*.6);
  c.fillStyle='#eebf72';c.fillRect(-3,-5,6,4);disc(c,0,-5,3.5,'#e4b15f');
  c.fillStyle='#ffe1a0';c.fillRect(-3.5,-5,7,1);disc(c,2.5,-4.5,1.6,'#e9fff2');disc(c,2.8,-4.8,.7,'#fff');
  c.fillStyle='#284649';c.fillRect(-1,-2,3,1.5);c.fillStyle='#e8d3ac';c.fillRect(3,1,1.5,2);
  c.restore();
 }
 cache.set(key,image);return image;
}
export function drawLumen(c,tile,x,y,frame,game){
 let variant=(x*3+y*7)%3,f=0;
 if(['*','a','b','f'].includes(tile))f=Math.floor(frame/2)%8;
 if(tile==='M'){tile=game.magic.active&&game.magic.remaining>0?'M':'+';f=Math.floor(frame/3)%8;}
 if(tile==='X')variant=game.collected>=game.target?1:0;
 if(tile==='e'||tile==='d')f=Math.min(4,game.blasts.get(`${x},${y}`)?.age??0);
 c.drawImage(sprite(tile,variant,f),x*16,y*16,16,16);
}
export function drawLumenPlayer(c,x,y,frame,direction,moving){
 c.save();c.translate(x*16,y*16);
 const glow=c.createRadialGradient(9,4,0,9,4,11);glow.addColorStop(0,'rgba(242,255,212,.16)');glow.addColorStop(1,'rgba(242,255,212,0)');c.fillStyle=glow;c.fillRect(-3,-6,24,22);
 c.drawImage(sprite('player',direction<0?1:0,moving?Math.floor(frame/2)%4:0),0,0,16,16);c.restore();
}
