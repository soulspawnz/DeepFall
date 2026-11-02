export function setupFullscreen() {
 const cabinet=document.querySelector('.cabinet'),canvas=document.querySelector('#game');
 const button=document.createElement('button');button.id='fullscreen';button.className='quiet';
 button.title='Fullscreen 4:3 (F)';button.setAttribute('aria-pressed','false');
 document.querySelector('#pause').parentElement.append(button);
 const touch=document.querySelector('.touch-controls');cabinet.append(touch);
 const home=touch.parentElement,anchor=touch.nextSibling;
 let fallback=false;
 const active=()=>document.fullscreenElement===cabinet||fallback;
 function sync(){
  const on=active();cabinet.classList.toggle('fullscreen-active',on);
  button.textContent=on?'EXIT FULLSCREEN':'FULLSCREEN 4:3';button.setAttribute('aria-pressed',String(on));
  document.body.classList.toggle('game-fullscreen',on);
  if(on)cabinet.append(touch);else home.insertBefore(touch,anchor);
  canvas.focus({preventScroll:true});
 }
 async function toggle(){
  if(document.fullscreenElement===cabinet)await document.exitFullscreen();
  else if(fallback){fallback=false;sync();}
  else {
   try{if(!cabinet.requestFullscreen)throw new Error('Use viewport fullscreen');await cabinet.requestFullscreen();}
   catch{fallback=true;sync();}
  }
 }
 button.addEventListener('click',toggle);
 document.addEventListener('fullscreenchange',sync);
 document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
  if(event.code==='KeyF'&&!event.repeat){event.preventDefault();toggle();}
  else if(event.code==='Escape'&&fallback){fallback=false;sync();}
 });
 button.textContent='FULLSCREEN 4:3';
}
