// DEVELOPMENT ONLY. No dependencies other than Node.js.
// Re-run after replacing src/data/roadGraph.json with an exported 800x800 road graph.
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'..');
const roads=JSON.parse(fs.readFileSync(path.join(dir,'src/data/roadGraph.json'),'utf8'));
if(roads.map?.width!==800||roads.map?.height!==800) throw Error('Expected 800x800 road graph.');
// This initial mask was inferred from visible roofs and older building outlines.
// User annotations take priority; covered passages can reopen falsely blocked roof pixels.
const bits=Buffer.from(fs.readFileSync(path.join(__dirname,'routingMask800.b64'),'utf8').trim(),'base64');
const correctionFile=path.join(dir,'src/data/walkabilityEdits.json');
const edits=fs.existsSync(correctionFile)?JSON.parse(fs.readFileSync(correctionFile,'utf8')):{zones:[]};
if(!Array.isArray(edits.zones))throw Error('walkabilityEdits.json: expected zones array');
const allowedTypes=new Set(['covered','walk','field']);
const forbiddenTypes=new Set(['blocked','restricted']);
const inPoly=(x,y,p)=>{let v=false;for(let i=0,j=p.length-1;i<p.length;j=i++){
 const a=p[i],b=p[j];if(((a.y>y)!==(b.y>y))&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)v=!v;
 }return v;};
const segmentDist=(x,y,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
 const t=d?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/d)):0;
 return Math.hypot(x-(a.x+t*dx),y-(a.y+t*dy));};
const inZone=(x,y,z)=>{const p=z.points||[];
 if(z.type==='covered'||z.type==='walk'){
  const radius= Math.max(1,Number(z.width)||14)/2;
  for(let i=1;i<p.length;i++)if(segmentDist(x,y,p[i-1],p[i])<=radius)return true;
  return false;
 }return p.length>=3&&inPoly(x,y,p);};
function applyZone(z,isBlocked){const p=z.points||[];if(p.length<(z.type==='covered'||z.type==='walk'?2:3))return;
 if(!p.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)))return;
 const r=(z.type==='covered'||z.type==='walk')?Math.max(1,Number(z.width)||14)/2:0;
 let xmin=Math.max(0,Math.floor(Math.min(...p.map(q=>q.x))-r));
 let xmax=Math.min(799,Math.ceil(Math.max(...p.map(q=>q.x))+r));
 let ymin=Math.max(0,Math.floor(Math.min(...p.map(q=>q.y))-r));
 let ymax=Math.min(799,Math.ceil(Math.max(...p.map(q=>q.y))+r));
 for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++)if(inZone(x,y,z)){
  const i=y*800+x,bi=i>>3,v=1<<(i&7);
  if(isBlocked)bits[bi]|=v;else bits[bi]&=~v;
 }
}
for(const z of edits.zones)if(allowedTypes.has(z.type))applyZone(z,false);
// Explicit no-go footprints always override walkable annotations.
for(const z of edits.zones)if(forbiddenTypes.has(z.type))applyZone(z,true);
if(bits.length!==800*800/8)throw Error('Invalid routing mask.');
const blocked=(x,y)=>{x=Math.max(0,Math.min(799,Math.round(x)));y=Math.max(0,Math.min(799,Math.round(y)));const i=y*800+x;return !!(bits[i>>3]&(1<<(i&7)));};
const clear=(ax,ay,bx,by)=>{const n=Math.max(2,Math.ceil(Math.hypot(ax-bx,ay-by)/2));for(let i=0;i<n;i++){const t=i/(n-1);if(blocked(ax+(bx-ax)*t,ay+(by-ay)*t))return false;}return true;};
// ROUTE PREFERENCE (simulation): roads are preferred when the detour is modest.
// These factors are generalized routing costs, not real walking metres or times.
// A path through open ground is still allowed and can win if using roads would
// require a substantial detour. All links still need obstacle clearance.
const ROUTING_COST = Object.freeze({
  road: 1.00,          // Edited road/sidewalk centerlines
  covered: 1.02,       // Verified or manually permitted covered passages
  open: 1.60,          // Open walkable ground/field: allowed, lower preference
  roadToOpen: 1.18,    // Enter/leave road from open ground
  coveredToOpen: 1.18,
  roadToCovered: 1.06,
});
const nodes=[],byId=new Map(),edges=[],dedup=new Set();
const addnode=(id,x,y,kind)=>{const obj={id,x:+x.toFixed(3),y:+y.toFixed(3),kind};nodes.push(obj);byId.set(id,obj);};
const addEdge=(from,to,mul)=>{if(from===to||!byId.has(from)||!byId.has(to))return;const key=[from,to].sort().join('|');if(dedup.has(key))return;const a=byId.get(from),b=byId.get(to);if(!clear(a.x,a.y,b.x,b.y))return;dedup.add(key);edges.push({from,to,weight:+(Math.hypot(a.x-b.x,a.y-b.y)*mul).toFixed(3)});};
const idx=new Map(),key=(x,y)=>`${x},${y}`;
for(let yi=0;yi<50;yi++)for(let xi=0;xi<50;xi++){
 const x=8+xi*16,y=8+yi*16;
 if(!blocked(x,y)){const id=`G${String(xi).padStart(2,'0')}_${String(yi).padStart(2,'0')}`;idx.set(key(xi,yi),id);addnode(id,x,y,'open');}
}
for(let yi=0;yi<50;yi++)for(let xi=0;xi<50;xi++){
 const id=idx.get(key(xi,yi));if(!id)continue;
 for(const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]){
  const neighbor=idx.get(key(xi+dx,yi+dy));if(neighbor)addEdge(id,neighbor,ROUTING_COST.open);
 }
}
const excluded=[];
for(const n of roads.nodes){if(blocked(n.x,n.y)){excluded.push(n.id);continue;}addnode(n.id,n.x,n.y,'road');}
for(const e of roads.edges) addEdge(e.from,e.to,ROUTING_COST.road);
for(const n of roads.nodes){if(!byId.has(n.id))continue;
 const xi0=Math.floor((n.x-8)/16),yi0=Math.floor((n.y-8)/16),options=[];
 for(let xi=Math.max(0,xi0-2);xi<=Math.min(49,xi0+2);xi++)for(let yi=Math.max(0,yi0-2);yi<=Math.min(49,yi0+2);yi++){
  const id=idx.get(key(xi,yi));if(!id)continue;const p=byId.get(id),d=Math.hypot(n.x-p.x,n.y-p.y);
  if(d<=19&&clear(n.x,n.y,p.x,p.y))options.push([d,id]);
 }
 options.sort((a,b)=>a[0]-b[0]);for(const [_,id] of options.slice(0,4))addEdge(n.id,id,ROUTING_COST.roadToOpen);
}
// Sample precise passage centerlines so 6–12-unit-wide covered paths are not
// lost between 16-unit open-ground grid centres.
let guideCount=0;
for(const zone of edits.zones){
 if(zone.type!=='covered'&&zone.type!=='walk')continue;
 const points=zone.points||[];if(points.length<2)continue;
 const sampled=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],distance=Math.hypot(b.x-a.x,b.y-a.y);
  const count=Math.max(1,Math.ceil(distance/7));
  for(let k=i===1?0:1;k<=count;k++){
   const t=k/count,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
   if(!blocked(x,y))sampled.push({x,y});
  }
 }
 let prev=null;
 for(const pt of sampled){const id=`C${guideCount++}`;addnode(id,pt.x,pt.y,'covered');
  if(prev)addEdge(prev,id,ROUTING_COST.covered);prev=id;
  const ix0=Math.floor((pt.x-8)/16),iy0=Math.floor((pt.y-8)/16),near=[];
  for(let gx=Math.max(0,ix0-2);gx<=Math.min(49,ix0+3);gx++)
    for(let gy=Math.max(0,iy0-2);gy<=Math.min(49,iy0+3);gy++){
     const gid=idx.get(key(gx,gy));if(!gid)continue;
     const gp=byId.get(gid),d=Math.hypot(pt.x-gp.x,pt.y-gp.y);
     if(d<=21&&clear(pt.x,pt.y,gp.x,gp.y))near.push([d,gid]);
    }
  near.sort((a,b)=>a[0]-b[0]);for(const [,gid] of near.slice(0,3))addEdge(id,gid,ROUTING_COST.coveredToOpen);
  for(const rn of roads.nodes){if(!byId.has(rn.id))continue;
   if(Math.hypot(pt.x-rn.x,pt.y-rn.y)<=13)addEdge(id,rn.id,ROUTING_COST.roadToCovered);
  }
 }
}
const meta={version:2,mapSize:800,gridSpacing:16,routingCosts:ROUTING_COST,mode:'DEVELOPMENT ONLY — outdoor visibility-based preview',notes:[
 'Includes open-space grid and original edited roads; no indoor graph.',
 'Non-building open pixels are ASSUMED walkable; fences/obstructions and area access are NOT validated.',
 'Legacy roof mask has optional polygon and covered-corridor corrections from walkabilityEdits.json.',
 'Water masked. Road/covered paths preferred by weighted edge cost, fields remain traversable.',
 'Routing chooses minimum weighted cost, not necessarily minimum geometric distance. Units are NOT metres.'
],roadGraphSource:'roadGraph.json',excludedRoadNodes:excluded};
meta.manualZones=edits.zones.length;meta.coveredGuideNodes=guideCount;
const out=path.join(dir,'src/data/fullWalkableGraph.json');
fs.writeFileSync(out,JSON.stringify({metadata:meta,nodes,edges}));
console.log(`Generated ${nodes.length} nodes, ${edges.length} edges; excluded road nodes: ${excluded.join(',')||'none'}`);
console.log('This is a simulated graph, NOT confirmed walkable campus guidance.');
