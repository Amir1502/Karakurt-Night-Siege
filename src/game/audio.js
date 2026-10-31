// Local Web Audio synthesis: no downloads, autoplay or external services.
// Graph: [sfx bus] + [music bus] -> master (mute) -> limiter -> destination.
const SCALE = [0, 3, 5, 7, 10, 12, 15];            // A natural-minor pentatonic, semitones from A3
const CHORDS = [[45, 52, 57], [41, 48, 53], [43, 50, 55], [40, 47, 52]]; // Am, F, G, Em (MIDI)
const BEAT = 60 / 72;                               // 72 BPM, soft pulse
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

export function createAudio(assets, bus, initialMuted=false, initialVolumes={}) {
 let context, master, sfx, music, ambience, muted=initialMuted, voices=0, disposed=false, timer=null;
 let musicVolume=initialVolumes.music??.5, sfxVolume=initialVolumes.sfx??.8, intensity=0, nextBeat=0, beat=0;
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
  sfx=context.createGain();sfx.gain.value=sfxVolume;sfx.connect(master);
  music=context.createGain();music.gain.value=musicVolume*.55;music.connect(master);
  ambience=noise(3);
  // Desert wind: two filtered noise loops on the effects bus.
  for(const [frequency,volume,type] of [[380,.12,'lowpass'],[1700,.025,'bandpass']]) {
   const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
   source.buffer=ambience;source.loop=true;filter.type=type;filter.frequency.value=frequency;gain.gain.value=volume;
   source.connect(filter).connect(gain).connect(sfx);source.start();loops.push(source);
  }
  timer=setInterval(schedule,150);
 }
 // Short enveloped oscillator note on the given bus.
 function tone(out,type,f,start,length,volume,{attack=.01,glide=0,cutoff=0}={}) {
  const osc=context.createOscillator(),gain=context.createGain();osc.type=type;
  osc.frequency.setValueAtTime(f,start);if(glide)osc.frequency.exponentialRampToValueAtTime(f*glide,start+length);
  gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+attack);
  gain.gain.exponentialRampToValueAtTime(.0001,start+length);
  let tail=osc;if(cutoff){const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=cutoff;osc.connect(filter);tail=filter;}
  tail.connect(gain).connect(out);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+length+.05);
 }
 // Look-ahead sequencer: quiet pad per bar, sparse plucked melody, soft pulse that grows in combat.
 function schedule() {
  if(disposed||!context||context.state!=='running')return;
  const now=context.currentTime;if(nextBeat<now)nextBeat=now+.05;
  while(nextBeat<now+.6){
   const t=nextBeat,bar=Math.floor(beat/4)%CHORDS.length,step=beat%4;
   if(step===0)for(const n of CHORDS[bar]){tone(music,'sawtooth',hz(n),t,BEAT*4.2,.035,{attack:.9,cutoff:700});tone(music,'sine',hz(n-12),t,BEAT*4.2,.03,{attack:1.2});}
   tone(music,'sine',step===0?55:48,t,.32,step===0?.16+.12*intensity:.07+.1*intensity,{attack:.005,glide:.5});
   if(intensity>.5&&step%2===1)tone(music,'triangle',hz(CHORDS[bar][0]+24),t,.08,.02,{attack:.002});
   // Deterministic pseudo-random melody so loops do not sound mechanical.
   const r=(beat*7919+bar*104729)%97/97;
   if(r<.45){const note=57+SCALE[Math.floor(r*31)%SCALE.length];tone(music,'triangle',hz(note),t+(r<.2?BEAT/2:0),BEAT*1.6,.05,{attack:.004,cutoff:2400});}
   nextBeat+=BEAT;beat++;
  }
 }
 async function unlockFromGesture(){try{if(disposed)return false;if(!context)init();await context.resume();schedule();return context.state==='running';}catch{return false;}}
 function burst(cutoff,volume,duration,start){
  const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
  source.buffer=ambience;filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,start);filter.frequency.exponentialRampToValueAtTime(Math.max(120,cutoff*.15),start+duration);
  gain.gain.setValueAtTime(volume,start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  source.connect(filter).connect(gain).connect(sfx);
  voices++;source.onended=()=>{voices--;source.disconnect();filter.disconnect();gain.disconnect();};
  source.start(start,Math.random()*2);source.stop(start+duration);
 }
 // Per-slot shot voicing: [crack cutoff, crack volume, crack length, body Hz, body volume, tail length].
 const SHOTS={1:[5200,.7,.16,130,.55,.22],2:[3200,.95,.32,72,.85,.45],3:[6200,.45,.07,170,.35,.1],4:[900,.35,.2,60,.2,.2],5:[2400,.3,.08,200,.2,.1]};
 function play(cue,variant=1){if(muted||!context||context.state!=='running'||voices>=12)return;
  const now=context.currentTime;
  switch(cue){
   // Shot: bright noise crack + low body thump + darker room tail.
   case 'shot':{const [cut,vol,len,body,bodyVol,tail]=SHOTS[variant]??SHOTS[1];
    burst(cut,vol,len,now);burst(cut*.25,vol*.35,tail,now+.02);
    tone(sfx,'sine',body,now,len+.04,bodyVol,{attack:.002,glide:.35});
    if(variant!==4)tone(sfx,'square',1800,now,.025,.05,{attack:.001,glide:.4});break;}
   case 'reload':burst(2400,.25,.06,now);burst(3000,.22,.05,now+.18);break;
   case 'hit':tone(sfx,'square',1350,now,.05,.08,{attack:.001,glide:.7,cutoff:4000});tone(sfx,'sine',190,now,.09,.18,{attack:.002,glide:.5});break;
   case 'damage':burst(300,.3,.25,now);tone(sfx,'sine',80,now,.25,.25,{attack:.005,glide:.6});break;
   case 'shelter':burst(800,.25,.3,now);break;
   case 'spawn':burst(1100,.045,.2,now);break;
   default:{const f={wave:330,clear:440,win:520,lose:110,switch:260}[cue]||220,d=cue==='wave'?.6:.2;tone(sfx,'sine',f,now,d,.2,{attack:.005,glide:.65});}
  }
 }
 const cues={'wave:start':'wave','wave:clear':'clear','player:damage':'damage','shelter:damage':'shelter','weapon:switch':'switch','spider:spawn':'spawn','run:win':'win','run:lose':'lose'};
 const off=Object.entries(cues).map(([name,cue])=>bus.on(name,()=>play(cue)));
 const set=(node,value)=>{if(node)node.gain.setValueAtTime(value,context.currentTime);};
 return {unlockFromGesture,resumeFromGesture:unlockFromGesture,play,
  setMuted(v){muted=v;set(master,muted?0:.65);},isMuted:()=>muted,
  setMusicVolume(v){musicVolume=Math.max(0,Math.min(1,Number(v)||0));set(music,musicVolume*.55);},
  setSfxVolume(v){sfxVolume=Math.max(0,Math.min(1,Number(v)||0));set(sfx,sfxVolume);},
  setIntensity(v){intensity=v?1:0;},
  async suspend(){try{await context?.suspend();}catch{}},
  dispose(){disposed=true;clearInterval(timer);off.forEach(f=>f());loops.forEach(s=>s.stop());context?.close().catch(()=>{});}};
}
