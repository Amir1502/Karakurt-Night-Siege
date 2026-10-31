import * as THREE from 'three';
import {ARENA_DECOR,ARENA_DECOR_PROTOTYPES} from '../data/arenaDecor.js';

export const NIGHT_EVENTS=Object.freeze({3:'Пыльная буря',6:'Затмение',9:'Тихая ночь'});

// Night camp: cold silhouette light, amber hearth, low horizon and open firing lanes.
export function createScenery(scene) {
  const owned=new Set(), keep=x=>(owned.add(x),x);
  const night=new THREE.Color('#111e33'), dawn=new THREE.Color('#bd9b82');
  scene.background=night.clone();scene.fog=new THREE.Fog('#536275',42,135);
  const ambient=new THREE.HemisphereLight('#a9c9f3','#303344',.85);scene.add(ambient);
  const moonlight=new THREE.DirectionalLight('#aac8ef',1.5);moonlight.position.set(-25,45,-30);scene.add(moonlight);
  const firelight=new THREE.PointLight('#ffb569',85,17,2);firelight.position.set(0,1.3,4);scene.add(firelight);
  const terrain=keep(new THREE.PlaneGeometry(280,280,140,140));terrain.rotateX(-Math.PI/2);
  const pos=terrain.attributes.position;
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i),z=pos.getZ(i),r=Math.hypot(x,z);
    const edge=THREE.MathUtils.smoothstep(r,28,50);
    pos.setY(i,-.035+edge*(3.6+Math.sin(x*.08+z*.03)*2.6+Math.sin(z*.12-x*.06)*1.6));
  }
  terrain.computeVertexNormals();
  const sand=keep(new THREE.MeshStandardMaterial({color:'#a99982',roughness:1}));
  const ground=new THREE.Mesh(terrain,sand);scene.add(ground);
  const skyMat=keep(new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{rise:{value:0},red:{value:0}},vertexShader:'varying float h; void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying float h;uniform float rise;uniform float red;void main(){vec3 night=mix(vec3(.16,.22,.30),vec3(.018,.034,.072),smoothstep(0.,.65,h));night=mix(night,vec3(.25,.07,.09),red*.55);vec3 dawn=mix(vec3(.71,.43,.29),vec3(.20,.35,.54),smoothstep(0.,.8,h));gl_FragColor=vec4(mix(night,dawn,rise),1.);}' }));
  scene.add(new THREE.Mesh(keep(new THREE.SphereGeometry(160,20,12)),skyMat));
  const moon=new THREE.Mesh(keep(new THREE.SphereGeometry(2.2,24,16)),keep(new THREE.MeshBasicMaterial({color:'#e1e6db',toneMapped:false})));
  moon.position.set(-44,49,-85);scene.add(moon);
  const starPositions=[];let seed=741;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<420;i++){const a=random()*Math.PI*2,h=.15+random()*.82,r=Math.sqrt(1-h*h);starPositions.push(Math.sin(a)*r*130,h*130,Math.cos(a)*r*130);}
  const starsGeo=keep(new THREE.BufferGeometry());starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  const starsMat=keep(new THREE.PointsMaterial({color:'#becddd',size:.16,transparent:true,opacity:.8,depthWrite:false,fog:false}));
  const stars=new THREE.Points(starsGeo,starsMat);scene.add(stars);
  const decor=new THREE.Group(),decorLevels=[];scene.add(decor);
  const flameMat=keep(new THREE.SpriteMaterial({color:'#ff9e48',transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));
  const flames=Array.from({length:7},(_,i)=>{const f=new THREE.Sprite(flameMat);f.position.set(Math.sin(i*2.4)*.20,.45+(i%3)*.17,4+Math.cos(i*2.4)*.20);f.scale.set(.5,.95,1);scene.add(f);return f;});
  const smokeMat=keep(new THREE.SpriteMaterial({color:'#86909a',transparent:true,opacity:.07,depthWrite:false}));
  const smoke=Array.from({length:6},()=>{const f=new THREE.Sprite(smokeMat);scene.add(f);return f;});
  const eyeMat=keep(new THREE.SpriteMaterial({color:'#ff3a2a',transparent:true,depthWrite:false,fog:false,toneMapped:false,blending:THREE.AdditiveBlending}));
  const mothMat=keep(new THREE.SpriteMaterial({color:'#ffe3b0',transparent:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
  const eyes=new THREE.Group(),moths=new THREE.Group();eyes.name='horizon-eyes';moths.name='camp-moths';scene.add(eyes,moths);
  const eyePairs=Array.from({length:16},()=>{
    const pair=new THREE.Group();for(const side of [-1,1]){const sprite=new THREE.Sprite(eyeMat);sprite.position.x=side*.085;sprite.scale.setScalar(.08);pair.add(sprite);}eyes.add(pair);return {pair};
  });
  const mothOrbits=Array.from({length:10},()=>{const sprite=new THREE.Sprite(mothMat);sprite.scale.setScalar(.03);moths.add(sprite);return {sprite};});
  const tumbleweeds=new THREE.Group();tumbleweeds.name='tumbleweeds';scene.add(tumbleweeds);
  const rolling=[],wind=new THREE.Vector2(),rollAxis=new THREE.Vector3();let windWave=0,weedTime=null;
  function weedPath(w,initial=false){w.offset=(random()<.5?-1:1)*(8+random()*12);const edge=Math.sqrt(1600-w.offset*w.offset);w.along=initial?-Math.min(edge,28+random()*8):-edge;w.speed=2+random()*2;w.wait=0;w.roll=0;}
  const warnings=[];
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2,canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f3f0e7';ctx.font='bold 64px Segoe UI';ctx.textAlign='center';ctx.fillText(['С','В','Ю','З'][i],64,84);
    const map=keep(new THREE.CanvasTexture(canvas));map.colorSpace=THREE.SRGBColorSpace;
    const mat=keep(new THREE.SpriteMaterial({map,transparent:true,opacity:.65,depthWrite:false}));
    const sign=new THREE.Sprite(mat);sign.position.set(Math.sin(a)*29,2,Math.cos(a)*29);sign.scale.set(1.25,1.25,1);scene.add(sign);
    const m=keep(new THREE.SpriteMaterial({color:'#ffbc70',opacity:.35,transparent:true,depthWrite:false}));
    const dust=new THREE.Sprite(m);dust.position.set(Math.sin(a)*32,1,Math.cos(a)*32);dust.scale.set(7,2,1);dust.visible=false;scene.add(dust);warnings.push(dust);
  }
  function install(assets) {
    const texture=assets.textures.get('desert');texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(38,38);sand.map=texture;sand.color.set('#c4b399');sand.needsUpdate=true;
    // The fx alpha vanishes at subpixel horizon scale; eyes are solid red points.
    for(const m of [flameMat,smokeMat,mothMat,...warnings.map(w=>w.material)]){m.map=assets.textures.get('fx');m.needsUpdate=true;}
    decor.clear();decorLevels.length=0;const props=assets.get('camp_props').scene;
    function prop(name,x,z,scale=1,angle=0){const original=props.getObjectByName(name);if(!original)return;const p=original.clone(true);p.position.set(x,0,z);p.scale.setScalar(scale);p.rotation.y=angle;p.traverse(n=>{if(n.name.endsWith('LOD1'))n.visible=false;});decor.add(p);}
    prop('workbench',4.8,3.8);prop('firepit',0,4);
    for(let i=0;i<65;i++){
      const a=random()*Math.PI*2,r=28+random()*8;
      prop(i%3===0?'rock_'+['a','b','c'][i%3]:i%2?'dry_bush_a':'dry_bush_b',Math.sin(a)*r,Math.cos(a)*r,.5+random()*1.3,a);
    }
    const smallDecor=new THREE.Group();smallDecor.name='arena-small-decor';decor.add(smallDecor);
    for(let i=0;i<30;i++){
      const name=['dry_bush_a','dry_bush_b','rock_c'][i%3];let a,r,x,z;
      do {a=(i%4+random())*Math.PI/2;r=9+random()*16;x=Math.sin(a)*r;z=Math.cos(a)*r;} while(Math.abs(x)<3||Math.abs(z)<3);
      const p=props.getObjectByName(name).clone(true);p.position.set(x,0,z);p.rotation.y=a;
      const height=new THREE.Box3().setFromObject(p,true).getSize(new THREE.Vector3()).y;
      // The shipped rock is tall; non-colliding midground props must stay below the knee.
      p.scale.setScalar(Math.min(name==='rock_c'?.3+random()*.2:.4+random()*.4,.55/height));
      p.traverse(n=>{if(n.name.endsWith('LOD1'))n.visible=false;});smallDecor.add(p);
    }
    const eyeGround=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));ground.updateMatrixWorld(true);
    eyePairs.forEach((e,i)=>{
      e.angle=(i+random()*.5)*Math.PI*2/16;e.radius=38+random()*7;e.period=2+random()*3;e.phase=random()*e.period;
      e.pair.position.set(Math.sin(e.angle)*e.radius,0,Math.cos(e.angle)*e.radius);e.pair.rotation.y=e.angle;
      eyeGround.ray.origin.set(e.pair.position.x,50,e.pair.position.z);e.pair.position.y=(eyeGround.intersectObject(ground,false)[0]?.point.y??0)+.55;
    });
    mothOrbits.forEach(m=>{m.radius=.4+random()*.6;m.speed=.5+random()*.8;m.phase=random()*Math.PI*2;});
    tumbleweeds.clear();rolling.length=0;windWave=0;weedTime=null;
    for(let i=0;i<3;i++){
      const root=new THREE.Group(),bush=props.getObjectByName('dry_bush_b').clone(true);bush.scale.setScalar(.5);bush.traverse(n=>{if(n.name.endsWith('LOD1'))n.visible=false;});
      bush.position.sub(new THREE.Box3().setFromObject(bush,true).getCenter(new THREE.Vector3()));root.add(bush);tumbleweeds.add(root);rolling.push({root});
    }
    const missing=ARENA_DECOR_PROTOTYPES.filter(name=>!props.getObjectByName(name));
    if(missing.length){console.warn('E2 decor unavailable in camp_props: '+missing.join(', '));return;}
    const down=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0)),up=new THREE.Vector3(0,1,0);
    ground.updateMatrixWorld(true);
    for(const {prototype,x,z,scale,yaw} of ARENA_DECOR){
      const p=props.getObjectByName(prototype).clone(true),lod0=p.getObjectByName(prototype+'_LOD0'),lod1=p.getObjectByName(prototype+'_LOD1');
      if(!lod0||!lod1)throw new Error('E2 decor missing LOD pair: '+prototype);
      // Edge dunes rise above the flat combat floor; use the rendered triangle as the support plane.
      down.ray.origin.set(x,50,z);const hit=down.intersectObject(ground,false)[0];
      if(!hit)throw new Error('E2 decor outside terrain: '+prototype);
      p.position.copy(hit.point);p.scale.setScalar(scale);p.quaternion.setFromUnitVectors(up,hit.face.normal);p.rotateY(yaw);
      // A wide base spans several dune triangles. Settle both LODs into the sand together.
      p.updateMatrixWorld(true);let clearance=-Infinity;const base=new THREE.Vector3(),sampled=new Set();
      for(const mesh of [lod0,lod1]){
        const vertices=mesh.geometry.attributes.position;
        for(let i=0;i<vertices.count;i++){
          if(vertices.getY(i)>.002)continue;
          base.fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld);
          const key=base.toArray().join(',');if(sampled.has(key))continue;sampled.add(key);
          down.ray.origin.set(base.x,50,base.z);const surface=down.intersectObject(ground,false)[0];
          if(!surface)throw new Error('E2 decor base outside terrain: '+prototype);
          clearance=Math.max(clearance,base.y-surface.point.y);
        }
      }
      if(!Number.isFinite(clearance))throw new Error('E2 decor has no grounded base: '+prototype);
      p.position.y-=clearance;
      lod0.visible=true;lod1.visible=false;decor.add(p);decorLevels.push({p,lod0,lod1});
    }
    // These props only switch LOD visibility; their placed local transforms stay fixed.
    decor.traverse(node=>{node.updateMatrix();node.matrixAutoUpdate=false;});
  }
  let sunrise=0;
  return {install,
    update(s,dt,noFlash){
      for(const {p,lod0,lod1} of decorLevels){
        const near=Math.hypot(p.position.x-s.player.x,p.position.y-s.player.y-1.65,p.position.z-s.player.z)<12;
        lod0.visible=near;lod1.visible=!near;
      }
      sunrise=s.phase==='victory'?Math.min(1,sunrise+dt/3):0;
      const event=['build','wave'].includes(s.phase)&&s.clearedWaves<s.wave?s.wave:0;
      scene.background.copy(night).lerp(dawn,sunrise);scene.fog.color.set(event===3?'#7a6650':'#536275').lerp(dawn,sunrise);scene.fog.far=event===3?45:135;
      skyMat.uniforms.red.value=event===9?1:0;moon.visible=event!==6;moonlight.intensity=event===6?.5:1.5;
      skyMat.uniforms.rise.value=sunrise;starsMat.opacity=.8*(1-sunrise);ambient.intensity=.85+sunrise;moonlight.color.set('#aac8ef').lerp(new THREE.Color('#ffd9a6'),sunrise);
      firelight.intensity=(event===6?120:85)+(noFlash?0:Math.sin(s.time*9)*4);
      flames.forEach((f,i)=>{f.scale.y=noFlash?.95:.9+Math.sin(s.time*5+i)*.14;});
      smoke.forEach((f,i)=>{const age=(s.time*.25+i/6)%1;f.position.set(age*.6,.8+age*3,4);f.scale.setScalar(.6+age*1.4);});
      eyes.visible=s.phase==='build';
      for(const e of eyePairs){
        e.pair.visible=noFlash||(s.time+e.phase)%e.period>=.15;
        if(!noFlash){const angle=e.angle+.025*Math.sin(s.time*.35+e.phase)*Math.max(0,Math.sin(s.time*.13+e.phase));e.pair.position.x=Math.sin(angle)*e.radius;e.pair.position.z=Math.cos(angle)*e.radius;e.pair.rotation.y=angle;}
      }
      for(const m of mothOrbits){const angle=s.time*m.speed+m.phase;m.sprite.position.set(Math.sin(angle)*m.radius,1.4+Math.sin(s.time*.7+m.phase)*.6,4+Math.cos(angle)*m.radius);}
      const rewind=weedTime!==null&&s.time<weedTime;
      const elapsed=weedTime===null||rewind?0:s.time-weedTime;weedTime=s.time;
      if(windWave!==s.wave||rewind){windWave=s.wave;const angle=random()*Math.PI*2;wind.set(Math.sin(angle),Math.cos(angle));rollAxis.set(wind.y,0,-wind.x);rolling.forEach(w=>weedPath(w,true));}
      for(const w of rolling){
        if(w.wait>0){w.wait=Math.max(0,w.wait-elapsed);if(!w.wait)weedPath(w);}
        else {w.along+=w.speed*elapsed;w.roll+=w.speed*elapsed/.3;if(w.along>Math.sqrt(1600-w.offset*w.offset))w.wait=3+random()*5;}
        w.root.visible=w.wait===0;w.root.position.set(wind.x*w.along+wind.y*w.offset,.28+Math.abs(Math.sin(w.roll))*.2,wind.y*w.along-wind.x*w.offset);w.root.quaternion.setFromAxisAngle(rollAxis,w.roll);
      }
      for(let i=0;i<4;i++)warnings[i].visible=s.warnings.some(w=>w.sector===i);
    },
    dispose(){owned.forEach(r=>r.dispose());}
  };
}
