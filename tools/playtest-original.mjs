import {Game,STEP} from '../engine.mjs';
import {ORIGINAL_CAVES} from '../original-caves.mjs';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const attempts=[],dirs=[[0,-1],[1,0],[0,1],[-1,0]];
for(let difficulty=1;difficulty<=5;difficulty++)for(let index=0;index<20;index++)for(let pass=0;pass<3;pass++) {
 const g=new Game(index,'classic',null,{campaign:'original',difficulty});g.start();
 const input=[],visits=new Map();let error=null;
 try {
  while(g.status==='playing'&&input.length<4000) {
   let chosen=[0,0];
   if(g.born) {
    const order=dirs.slice(pass).concat(dirs.slice(0,pass));
    const queue=[{...g.player,first:null,distance:0}],seen=new Set([`${g.player.x},${g.player.y}`]);
    let best=null,bestScore=-Infinity;
    for(let n=0;n<queue.length;n++) {
     const p=queue[n],tile=g.tile(p.x,p.y),k=`${p.x},${p.y}`;
     if(p.first) {
      let score=tile==='X'&&g.collected>=g.target?100000-p.distance:tile==='*'?10000-p.distance*(pass===1?5:10):-Infinity;
      // If diamonds are sealed off, dig new ground and attempt horizontal pushes.
      if(!Number.isFinite(score))score=(tile==='.'?200:10)-p.distance-(visits.get(k)??0)*30;
      if(score>bestScore){bestScore=score;best=p.first;}
     }
     for(const [dx,dy]of order) {
      const x=p.x+dx,y=p.y+dy,k=`${x},${y}`,tile=g.tile(x,y);
      const push=tile==='O'&&dy===0&&g.tile(x+dx,y)===' '&&!g.falling.has(k);
      if(seen.has(k)||!([' ','.','*',...(g.collected>=g.target?['X']:[])].includes(tile)||push))continue;
      if(g.falling.has(`${x},${y-1}`)||g.falling.has(k))continue;
      if(order.some(([ex,ey])=>['b','f'].includes(g.tile(x+ex,y+ey))))continue;
      seen.add(k);queue.push({x,y,first:p.first??[dx,dy],distance:p.distance+1});
     }
    }
    chosen=best??[0,0];const k=`${g.player.x},${g.player.y}`;visits.set(k,(visits.get(k)??0)+1);
   }
   g.step({dx:chosen[0],dy:chosen[1]});input.push(chosen);g.events=[];
  }
 }catch(e){error=e.stack;}
 attempts.push({cave:ORIGINAL_CAVES[index].id,index,difficulty,pass:pass+1,fastTrappedTimer:true,status:error?'error':g.status==='playing'?'budget':g.status,reason:g.reason,diamonds:g.collected,target:g.target,ticks:input.length,simulatedSeconds:Math.round(input.length*STEP*100)/100,visited:visits.size,inputHash:createHash('sha256').update(JSON.stringify(input)).digest('hex'),input,error});
}
const totals=attempts.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{});
await writeFile(new URL('../docs/playtest-original.json',import.meta.url),JSON.stringify({scope:'100 original variants, three input-driven goal-seeking attempts each',limitations:'Automated engine play attempts, not human completions or proof that every cave is beatable. Three direction-order policies; no future-state search or enemy/amoeba puzzle solver.',totals,attempts},null,2));
await writeFile(new URL('../docs/playtest-original.csv',import.meta.url),'cave,difficulty,pass,status,diamonds,target,ticks,visited\n'+attempts.map(r=>[r.cave,r.difficulty,r.pass,r.status,r.diamonds,r.target,r.ticks,r.visited].join(',')).join('\n'));
console.log(JSON.stringify({attempts:attempts.length,totals,errors:attempts.filter(r=>r.error).map(r=>r.error)}));
