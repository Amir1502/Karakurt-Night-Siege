// Local Web Audio synthesis: no downloads, autoplay or external services.
export function createAudio(assets, bus, initialMuted=false) {
 let context, master, ambience, muted=initialMuted, voices=0, disposed=false;
 const loops=[];
 function noise(seconds) {
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*seconds),context.sampleRate);
  const data=buffer.getChannelData(0);let seed=173;
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
  return buffer;
 }
 function init() {
  context=new AudioContext();master=context.createGain();master.gain.value=muted?0:.65;
  const limiter=context.createDynamicsCompressor();master.connect(limiter).connect(context.destination);
  ambience=noise(3);
  for(const [frequency,volume,type] of [[380,.12,'lowpass'],[1700,.025,'bandpass']]) {
   const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
   source.buffer=ambience;source.loop=true;filter.type=type;filter.frequency.value=frequency;gain.gain.value=volume;
   source.connect(filter).connect(gain).connect(master);source.start();loops.push(source);
  }
 }
 async function unlockFromGesture(){try{if(disposed)return false;if(!context)init();await context.resume();return context.state==='running';}catch{return false;}}
 function play(cue){if(muted||!context||context.state!=='running'||voices>=12)return;
  const now=context.currentTime, gain=context.createGain();gain.connect(master);
  const noisy=['shot','reload','damage','shelter','spawn'].includes(cue);
  const source=noisy?context.createBufferSource():context.createOscillator();
  const duration=cue==='shot'?.24:cue==='wave'?.6:.2;
  if(noisy){source.buffer=ambience;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value={shot:3200,reload:2400,damage:300,shelter:800,spawn:1100}[cue];source.connect(filter).connect(gain);}
  else {source.type='sine';const f={hit:740,wave:330,clear:440,win:520,lose:110,switch:260}[cue]||220;source.frequency.setValueAtTime(f,now);source.frequency.exponentialRampToValueAtTime(f*.65,now+duration);source.connect(gain);}
  gain.gain.setValueAtTime(cue==='shot'?.65:cue==='spawn'?.045:.2,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  voices++;source.onended=()=>{voices--;source.disconnect();gain.disconnect();};source.start();source.stop(now+duration);
 }
 const cues={'wave:start':'wave','wave:clear':'clear','player:damage':'damage','shelter:damage':'shelter','weapon:switch':'switch','spider:spawn':'spawn','run:win':'win','run:lose':'lose'};
 const off=Object.entries(cues).map(([name,cue])=>bus.on(name,()=>play(cue)));
 return {unlockFromGesture,resumeFromGesture:unlockFromGesture,play,setMuted(v){muted=v;if(master)master.gain.setValueAtTime(muted?0:.65,context.currentTime);},isMuted:()=>muted,
  async suspend(){try{await context?.suspend();}catch{}},dispose(){disposed=true;off.forEach(f=>f());loops.forEach(s=>s.stop());context?.close().catch(()=>{});}};
}
