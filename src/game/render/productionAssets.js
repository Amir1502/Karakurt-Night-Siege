import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const ASSET_IDS = ['karakurt_runner','karakurt_spitter','tarantula_brute','jumper_wolf','widow_queen',
  'pistol_makarov','shotgun_trench','smg_scorpion','flamethrower_torch','turret_sentry','shelter','camp_props'];
const MATERIAL_MAP = {mat_spider:'spiders',mat_weapon:'weapons',mat_hands:'weapons',mat_shelter:'shelter',mat_desert:'desert'};
const BASE = new URL('../../../assets/',import.meta.url);

export async function loadProductionAssets(onProgress = () => {}) {
  const loader = new GLTFLoader(), textures = new THREE.TextureLoader();
  const catalog = new Map(), maps = new Map();
  catalog.textures = new Map();
  function texture(name) {
    if (!maps.has(name)) maps.set(name,textures.loadAsync(new URL(`textures/${name==='fx'?'fx_atlas':name+'_albedo'}.webp`,BASE).href).then(map=>{
      map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;map.anisotropy=4;catalog.textures.set(name,map);return map;
    }));
    return maps.get(name);
  }
  await Promise.all([...ASSET_IDS.map(async id => {
    try {
      const gltf = await loader.loadAsync(new URL(`models/${id}.glb`,BASE).href), materials=new Set();
      gltf.scene.traverse(node => {
        if (!node.isMesh) return;
        if (!node.geometry.attributes.uv) throw new Error(`${id}: missing TEXCOORD_0`);
        for (const mat of Array.isArray(node.material) ? node.material : [node.material]) materials.add(mat);
      });
      await Promise.all([...materials].map(async mat=>{
        const atlas=MATERIAL_MAP[mat.name];if(!atlas)throw new Error(`${id}: unknown material ${mat.name}`);
        mat.map=await texture(atlas);mat.color.set(0xffffff);mat.vertexColors=false;mat.needsUpdate=true;
      }));
      catalog.set(id, gltf); onProgress({id, ok:true});
    } catch(error) { onProgress({id, ok:false, error:String(error)}); }
  }),...['desert','fx'].map(async id=>{try{await texture(id);}catch(error){onProgress({id,ok:false,error:String(error)});}})]);
  return catalog;
}

export function instantiateAsset(catalog, id) {
  const gltf = catalog.get(id); if (!gltf) return null;
  const root = clone(gltf.scene), mixer = new THREE.AnimationMixer(root);
  const actions = new Map(gltf.animations.map(c => [c.name, mixer.clipAction(c)]));
  const levels=[];root.traverse(n=>{if(/(?:^|_)LOD[012]$/.test(n.name)) levels.push(n);});
  let current = '', selected = -1;
  return {root, mixer, actions,
    play(name, force = false, duration = 0) {
      if ((!force && name === current) || !actions.has(name)) return;
      const previous = actions.get(current), action = actions.get(name);
      if (previous && previous!==action) previous.fadeOut(.08);
      const loop=['idle','walk','kit_idle','sentry_idle'].includes(name);
      action.reset().setEffectiveWeight(1).setEffectiveTimeScale(duration ? action.getClip().duration/duration : 1);
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce,loop ? Infinity : 1);
      action.clampWhenFinished = true; action.fadeIn(.08).play(); current = name;
    },
    get finished(){return actions.get(current)?.paused??false;},
    reset(){mixer.stopAllAction();mixer.setTime(0);current='';selected=-1;},
    lod(distance) {
      const next=distance<12?0:distance<24?1:2;if(next===selected)return;selected=next;
      for(const n of levels){const max=levels.some(l=>l.name==='LOD2')?2:1;n.visible=n.name.endsWith('LOD'+Math.min(max,next));}
    },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(root); root.removeFromParent(); }
  };
}

export function disposeProductionAssets(catalog) {
  const resources = new Set();
  for(const map of catalog.textures?.values()??[]) resources.add(map);
  for (const gltf of catalog.values()) gltf.scene.traverse(n => {
    if (!n.isMesh) return;
    resources.add(n.geometry);
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      resources.add(m); for (const value of Object.values(m)) if (value?.isTexture) resources.add(value);
    }
  });
  resources.forEach(r => r.dispose()); catalog.clear();
}
