import * as THREE from 'three';

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
    uniforms:{rise:{value:0}},vertexShader:'varying float h; void main(){h=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying float h;uniform float rise;void main(){vec3 night=mix(vec3(.16,.22,.30),vec3(.018,.034,.072),smoothstep(0.,.65,h));vec3 dawn=mix(vec3(.71,.43,.29),vec3(.20,.35,.54),smoothstep(0.,.8,h));gl_FragColor=vec4(mix(night,dawn,rise),1.);}' }));
  scene.add(new THREE.Mesh(keep(new THREE.SphereGeometry(160,20,12)),skyMat));
  const moon=new THREE.Mesh(keep(new THREE.SphereGeometry(2.2,24,16)),keep(new THREE.MeshBasicMaterial({color:'#e1e6db',toneMapped:false})));
  moon.position.set(-44,49,-85);scene.add(moon);
  const starPositions=[];let seed=741;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<420;i++){const a=random()*Math.PI*2,h=.15+random()*.82,r=Math.sqrt(1-h*h);starPositions.push(Math.sin(a)*r*130,h*130,Math.cos(a)*r*130);}
  const starsGeo=keep(new THREE.BufferGeometry());starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  const starsMat=keep(new THREE.PointsMaterial({color:'#becddd',size:.16,transparent:true,opacity:.8,depthWrite:false,fog:false}));
  const stars=new THREE.Points(starsGeo,starsMat);scene.add(stars);
  const decor=new THREE.Group();scene.add(decor);
  const flameMat=keep(new THREE.SpriteMaterial({color:'#ff9e48',transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));
  const flames=Array.from({length:7},(_,i)=>{const f=new THREE.Sprite(flameMat);f.position.set(Math.sin(i*2.4)*.20,.45+(i%3)*.17,4+Math.cos(i*2.4)*.20);f.scale.set(.5,.95,1);scene.add(f);return f;});
  const smokeMat=keep(new THREE.SpriteMaterial({color:'#86909a',transparent:true,opacity:.07,depthWrite:false}));
  const smoke=Array.from({length:6},()=>{const f=new THREE.Sprite(smokeMat);scene.add(f);return f;});
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
    for(const m of [flameMat,smokeMat,...warnings.map(w=>w.material)]){m.map=assets.textures.get('fx');m.needsUpdate=true;}
    decor.clear();const props=assets.get('camp_props').scene;
    function prop(name,x,z,scale=1,angle=0){const original=props.getObjectByName(name);if(!original)return;const p=original.clone(true);p.position.set(x,0,z);p.scale.setScalar(scale);p.rotation.y=angle;p.traverse(n=>{if(n.name.endsWith('LOD1'))n.visible=false;});decor.add(p);}
    prop('workbench',4.8,3.8);prop('firepit',0,4);
    for(let i=0;i<65;i++){
      const a=random()*Math.PI*2,r=28+random()*8;
      prop(i%3===0?'rock_'+['a','b','c'][i%3]:i%2?'dry_bush_a':'dry_bush_b',Math.sin(a)*r,Math.cos(a)*r,.5+random()*1.3,a);
    }
  }
  let sunrise=0;
  return {install,
    update(s,dt,noFlash){
      sunrise=s.phase==='victory'?Math.min(1,sunrise+dt/3):0;
      scene.background.copy(night).lerp(dawn,sunrise);scene.fog.color.set('#536275').lerp(dawn,sunrise);
      skyMat.uniforms.rise.value=sunrise;starsMat.opacity=.8*(1-sunrise);ambient.intensity=.85+sunrise;moonlight.color.set('#aac8ef').lerp(new THREE.Color('#ffd9a6'),sunrise);
      firelight.intensity=noFlash?85:85+Math.sin(s.time*9)*4;
      flames.forEach((f,i)=>{f.scale.y=noFlash?.95:.9+Math.sin(s.time*5+i)*.14;});
      smoke.forEach((f,i)=>{const age=(s.time*.25+i/6)%1;f.position.set(age*.6,.8+age*3,4);f.scale.setScalar(.6+age*1.4);});
      for(let i=0;i<4;i++)warnings[i].visible=s.warnings.some(w=>w.sector===i);
    },
    dispose(){owned.forEach(r=>r.dispose());}
  };
}
