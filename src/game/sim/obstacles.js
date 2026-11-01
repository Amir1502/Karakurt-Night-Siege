export function obstacles(s){
  if(!s)return [];
  const list=(s.barricades??[]).filter(b=>b.health>0);
  if(s.nest?.health>0)list.push({...s.nest,halfX:s.nest.radius,halfZ:s.nest.radius});
  return list;
}

export function obstacleAt(s,x,z,radius=0,height=0){
  return obstacles(s).find(b=>height<b.height-1e-6&&Math.abs(x-b.x)<b.halfX+radius&&Math.abs(z-b.z)<b.halfZ+radius)??null;
}

export function resolveObstacleOverlap(s,body,radius){
  for(const b of obstacles(s)){
    if((body.y??0)>=b.height-1e-6||Math.abs(body.x-b.x)>=b.halfX+radius||Math.abs(body.z-b.z)>=b.halfZ+radius)continue;
    // Descending bodies can enter the footprint from above; choose the nearest safe edge.
    const exits=[{x:b.x+b.halfX+radius+1e-6,z:body.z},{x:b.x-b.halfX-radius-1e-6,z:body.z},{x:body.x,z:b.z+b.halfZ+radius+1e-6},{x:body.x,z:b.z-b.halfZ-radius-1e-6}];
    exits.sort((a,c)=>Math.hypot(a.x-body.x,a.z-body.z)-Math.hypot(c.x-body.x,c.z-body.z));
    Object.assign(body,exits[0]);
  }
}

export function firstObstacle(s,origin,direction,max,radius=0){
  let best=null;
  for(const b of obstacles(s)){
    let near=0,far=max;
    for(const [p,d,min,high] of [[origin.x,direction.x,b.x-b.halfX-radius,b.x+b.halfX+radius],[origin.z,direction.z,b.z-b.halfZ-radius,b.z+b.halfZ+radius],[origin.y??0,direction.y??0,0,b.height]]){
      if(Math.abs(d)<1e-9){if(p<min||p>high){far=-1;break;}}
      else {let a=(min-p)/d,c=(high-p)/d;if(a>c)[a,c]=[c,a];near=Math.max(near,a);far=Math.min(far,c);if(near>far)break;}
    }
    if(near<=far&&far>=0&&near<=max&&(!best||near<best.distance))best={obstacle:b,distance:near};
  }
  return best;
}

export function obstacleDistance(s,origin,direction,max,radius=0){return firstObstacle(s,origin,direction,max,radius)?.distance??Infinity;}

export function blockingObstacle(s,a,b,radius=0){
  const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
  return d<1e-9?null:firstObstacle(s,a,{x:dx/d,y:0,z:dz/d},d,radius)?.obstacle??null;
}

export function detour(body,target,barrier){
  const pad=body.radius+.25,vertical=barrier.halfZ>barrier.halfX;
  const normal=vertical?'x':'z',along=vertical?'z':'x',halfNormal=vertical?barrier.halfX:barrier.halfZ,halfAlong=vertical?barrier.halfZ:barrier.halfX;
  const sign=body[normal]>=barrier[normal]?1:-1;
  const routes=[-1,1].map(end=>[
    {[normal]:barrier[normal]+sign*(halfNormal+pad),[along]:barrier[along]+end*(halfAlong+pad)},
    {[normal]:barrier[normal]-sign*(halfNormal+pad),[along]:barrier[along]+end*(halfAlong+pad)},
  ]);
  const cost=r=>Math.hypot(r[0].x-body.x,r[0].z-body.z)+Math.hypot(r[1].x-target.x,r[1].z-target.z);
  return cost(routes[0])<=cost(routes[1])?routes[0]:routes[1];
}
