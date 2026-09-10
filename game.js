// GRANDMA THEFT: SENIOR SCOOTER - a playable take on the AI "grandma game" video
import * as THREE from './three.module.js';

// ============================== setup ==============================
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc7e8);
scene.fog = new THREE.Fog(0xa8c8de, 90, 340);

const camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, .1, 800);

const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
sun.position.set(60, 90, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
sun.shadow.camera.far = 300;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd9ee, 0x5c6e4a, .85));

addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ============================== helpers ==============================
const V3 = (x,y,z)=>new THREE.Vector3(x,y,z);
function canvasTex(w, h, draw, rx=1, ry=1){
  const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const rand = (a,b)=>a+Math.random()*(b-a);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const dist2d = (a,b)=>Math.hypot(a.x-b.x, a.z-b.z);

// ============================== materials ==============================
const M = {
  grass:  new THREE.MeshStandardMaterial({ color:0x6d9048, roughness:1 }),
  paddy:  new THREE.MeshStandardMaterial({ color:0x4f7d3a, roughness:.9 }),
  paddyW: new THREE.MeshStandardMaterial({ color:0x7fb3c8, roughness:.15, metalness:.1 }),
  road:   new THREE.MeshStandardMaterial({ color:0x4a4a4e, roughness:.95 }),
  dirt:   new THREE.MeshStandardMaterial({ color:0x8a7a58, roughness:1 }),
  wood:   new THREE.MeshStandardMaterial({ color:0x6b4a2f, roughness:.85 }),
  woodDark: new THREE.MeshStandardMaterial({ color:0x4a3820, roughness:.9 }),
  plaster:new THREE.MeshStandardMaterial({ color:0xe8e2d4, roughness:.9 }),
  roof:   new THREE.MeshStandardMaterial({ color:0x3d4450, roughness:.6, metalness:.15 }),
  stone:  new THREE.MeshStandardMaterial({ color:0x8d8d8d, roughness:1 }),
  pole:   new THREE.MeshStandardMaterial({ color:0x7a6a55, roughness:.9 }),
  skin:   new THREE.MeshStandardMaterial({ color:0xe8c49a, roughness:.8 }),
  hair:   new THREE.MeshStandardMaterial({ color:0xf0f0ee, roughness:.9 }),
  shirt:  null, // patterned below
  pants:  null,
  scarf:  new THREE.MeshStandardMaterial({ color:0xc26a8a, roughness:.9 }),
};
M.shirt = new THREE.MeshStandardMaterial({ map: canvasTex(64,64,(g)=>{ // purple pattern
  g.fillStyle='#7d5f8e'; g.fillRect(0,0,64,64);
  g.fillStyle='#9573a8';
  for(let i=0;i<40;i++){ g.beginPath(); g.arc(rand(0,64),rand(0,64),rand(1.5,3.5),0,7); g.fill(); }
}), roughness:.9 });
M.pants = new THREE.MeshStandardMaterial({ map: canvasTex(64,64,(g)=>{ // floral
  g.fillStyle='#4e3b52'; g.fillRect(0,0,64,64);
  const cols=['#c26a8a','#d9a05b','#8fae6b'];
  for(let i=0;i<26;i++){ g.fillStyle=cols[i%3]; g.beginPath(); g.arc(rand(0,64),rand(0,64),rand(2,4),0,7); g.fill(); }
}), roughness:.9 });

// ============================== world ==============================
const WORLD = 420;                 // ground size
const colliders = [];              // {x,z,hw,hd} AABBs
const knockables = [];             // rampage targets
const roadsH = [-60, 20, 100];     // horizontal road z positions
const roadsV = [-80, 0, 80];       // vertical road x positions
const ROADW = 9;

const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), M.grass);
ground.rotation.x = -Math.PI/2; ground.receiveShadow = true;
scene.add(ground);

function addRoad(x, z, w, d){
  const r = new THREE.Mesh(new THREE.BoxGeometry(w, .12, d), M.road);
  r.position.set(x, .06, z); r.receiveShadow = true; scene.add(r);
  // center line
  const horiz = w > d;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(horiz? w : .3, horiz? .3 : d),
    new THREE.MeshBasicMaterial({ color:0xd8d8c8 }));
  line.rotation.x = -Math.PI/2; line.position.set(x, .135, z); scene.add(line);
}
roadsH.forEach(z => addRoad(0, z, WORLD*.92, ROADW));
roadsV.forEach(x => addRoad(x, -10, ROADW, WORLD*.72));

function addCollider(x, z, hw, hd){ colliders.push({x, z, hw, hd}); }

// --- rice paddies with water ---
function addPaddy(x, z, w, d){
  const rim = new THREE.Mesh(new THREE.BoxGeometry(w, .5, d), M.paddy);
  rim.position.set(x, .25, z); rim.receiveShadow = true; scene.add(rim);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w-1.4, d-1.4), M.paddyW);
  water.rotation.x = -Math.PI/2; water.position.set(x, .52, z); scene.add(water);
  // rows of seedlings
  const seedMat = new THREE.MeshStandardMaterial({ color:0x74b04a, roughness:1 });
  const seedGeo = new THREE.ConeGeometry(.09, .55, 4);
  const nx = Math.floor((w-3)/1.2), nz = Math.floor((d-3)/1.2);
  const inst = new THREE.InstancedMesh(seedGeo, seedMat, nx*nz);
  const m4 = new THREE.Matrix4(); let i = 0;
  for(let ix=0; ix<nx; ix++) for(let iz=0; iz<nz; iz++){
    m4.setPosition(x - w/2 + 1.8 + ix*1.2, .8, z - d/2 + 1.8 + iz*1.2);
    inst.setMatrixAt(i++, m4);
  }
  inst.castShadow = true; scene.add(inst);
  addCollider(x, z, w/2, d/2);
}
addPaddy(-130, -110, 46, 40); addPaddy(-140, -20, 36, 46);
addPaddy(130, -90, 44, 52);  addPaddy(120, 130, 56, 40);
addPaddy(-40, 150, 60, 36);  addPaddy(-140, 110, 40, 44);

// --- traditional house ---
function addHouse(x, z, ry, opt={}){
  const g = new THREE.Group();
  const w = opt.w || 10, d = opt.d || 8, h = opt.h || 3.4;
  // stone base
  const base = new THREE.Mesh(new THREE.BoxGeometry(w+.6, .5, d+.6), M.stone);
  base.position.y = .25; g.add(base);
  // walls: plaster with wood framing
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.plaster);
  walls.position.y = .5 + h/2; walls.castShadow = true; walls.receiveShadow = true; g.add(walls);
  // wood frame beams
  const beamMat = M.woodDark;
  for(const sx of [-1, 1]) for(const sz of [-1, 1]){
    const post = new THREE.Mesh(new THREE.BoxGeometry(.28, h, .28), beamMat);
    post.position.set(sx*(w/2-.1), .5+h/2, sz*(d/2-.1)); g.add(post);
  }
  const beamT = new THREE.Mesh(new THREE.BoxGeometry(w+.2, .3, d+.2), beamMat);
  beamT.position.y = .5 + h - .15; g.add(beamT);
  // hip roof: squashed 4-sided cone
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.86, h*.85, 4), M.roof);
  roof.rotation.y = Math.PI/4;
  roof.scale.set(w/Math.max(w,d), 1, d/Math.max(w,d));
  roof.position.y = .5 + h + h*.42; roof.castShadow = true; g.add(roof);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(w*.5, .3, .6), M.roof);
  ridge.position.y = .5 + h + h*.84; g.add(ridge);
  // engawa porch on front
  const porch = new THREE.Mesh(new THREE.BoxGeometry(w*.9, .35, 1.6), M.wood);
  porch.position.set(0, .42, d/2 + .8); porch.castShadow = true; porch.receiveShadow = true; g.add(porch);
  // shoji windows (white with lattice)
  const shojiMat = new THREE.MeshStandardMaterial({ map: canvasTex(64,64,(gg)=>{
    gg.fillStyle='#efe9dc'; gg.fillRect(0,0,64,64); gg.strokeStyle='#5a4632'; gg.lineWidth=3;
    for(let i=0;i<=4;i++){ gg.beginPath(); gg.moveTo(i*16,0); gg.lineTo(i*16,64); gg.stroke();
      gg.beginPath(); gg.moveTo(0,i*16); gg.lineTo(64,i*16); gg.stroke(); }
  }), roughness:.8 });
  for(const sx of [-w/4, w/4]){
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.5), shojiMat);
    win.position.set(sx, 1.9, d/2 + .02); g.add(win);
  }
  // dark entrance
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.9),
    new THREE.MeshStandardMaterial({ color:0x241a10, roughness:1 }));
  door.position.set(0, 1.6, d/2 + .02); g.add(door);
  g.position.set(x, 0, z); g.rotation.y = ry;
  scene.add(g);
  addCollider(x, z, (Math.abs(Math.cos(ry))*w + Math.abs(Math.sin(ry))*d)/2 + .3,
                    (Math.abs(Math.sin(ry))*w + Math.abs(Math.cos(ry))*d)/2 + .3);
  return g;
}

// village layout - houses face their road
addHouse(-95, -75,  Math.PI/4, {w:11, d:9});          // Ume's home (mission start)
const tanakaHouse = addHouse(80, 75, -Math.PI*0.75, {w:12, d:10}); // Tanaka's house
addHouse(-30, -78, 0);          addHouse(30, -75, 0);
addHouse(-105, 20, Math.PI/2);  addHouse(105, 30, -Math.PI/2);
addHouse(-30, 38, Math.PI);     addHouse(35, 40, Math.PI);
addHouse(-95, 120, Math.PI/4);  addHouse(-20, 118, Math.PI);
addHouse(40, 122, Math.PI);     addHouse(110, -40, -Math.PI/2);
addHouse(140, 60, -Math.PI/2, {w:9, d:7});
addHouse(-160, 40, Math.PI/2, {w:9, d:7});

// --- power poles with sagging wires ---
const poleTops = [];
function addPole(x, z){
  const p = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, 9, 6), M.pole);
  p.position.set(x, 4.5, z); p.castShadow = true; scene.add(p);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, .12, .12), M.pole);
  arm.position.set(x, 8.2, z); scene.add(arm);
  poleTops.push(V3(x, 8.2, z));
}
for(let x=-150; x<=150; x+=42) addPole(x, -60 + 7.5);
for(let z=-140; z<=130; z+=45) addPole(-80 + 7.5, z);
for(let i=1;i<poleTops.length;i++){
  const a = poleTops[i-1], b = poleTops[i];
  if (Math.abs(a.z - b.z) < 1 || Math.abs(a.x - b.x) < 1){
    const mid = a.clone().lerp(b, .5); mid.y -= 1.4;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, .035, 4),
      new THREE.MeshBasicMaterial({ color:0x1c1c1c }));
    scene.add(wire);
  }
}

// --- trees ---
const trunkG = new THREE.CylinderGeometry(.22, .34, 2.4, 6);
const leafG = new THREE.IcosahedronGeometry(1.7, 1);
const trunkM = new THREE.MeshStandardMaterial({ color:0x5c4630, roughness:1 });
const leafM = new THREE.MeshStandardMaterial({ color:0x4c7a38, roughness:1, flatShading:true });
function addTree(x, z, s=1){
  const t = new THREE.Mesh(trunkG, trunkM); t.position.set(x, 1.2*s, z); t.scale.setScalar(s);
  t.castShadow = true; scene.add(t);
  const l = new THREE.Mesh(leafG, leafM); l.position.set(x, 3.1*s, z); l.scale.setScalar(s);
  l.castShadow = true; scene.add(l);
  addCollider(x, z, .5*s, .5*s);
}
const treeSpots = [[-120,-95],[-70,-95],[-15,-95],[55,-92],[95,-80],[-125,5],[-60,5],[130,10],
  [-120,60],[-55,62],[20,75],[60,95],[-140,140],[-80,140],[15,150],[90,150],[150,-10],[155,-120],
  [-170,-40],[-165,-130],[170,110],[45,-120],[-45,-125],[75,-135],[125,-45],[-110,90],[135,95]];
treeSpots.forEach(([x,z]) => addTree(x, z, rand(.8, 1.4)));

// --- stone walls ---
function addWall(x, z, w, ry=0){
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, .7), M.stone);
  wall.position.set(x, .55, z); wall.rotation.y = ry;
  wall.castShadow = true; wall.receiveShadow = true; scene.add(wall);
  addCollider(x, z, Math.abs(Math.cos(ry))*w/2+.35, Math.abs(Math.sin(ry))*w/2+.35);
}
addWall(-40, -70, 18); addWall(20, -70, 14); addWall(-95, 30, 12, Math.PI/2);
addWall(95, 40, 12, Math.PI/2); addWall(30, 30, 12); addWall(-20, 28, 12);

// --- mountains ring ---
const mountM = new THREE.MeshStandardMaterial({ color:0x4f7350, roughness:1, flatShading:true });
const mountM2 = new THREE.MeshStandardMaterial({ color:0x40604a, roughness:1, flatShading:true });
for(let i=0;i<14;i++){
  const a = i/14 * Math.PI*2;
  const r = 300 + rand(-25, 30);
  const m = new THREE.Mesh(new THREE.ConeGeometry(rand(70,120), rand(55,110), 7), i%2? mountM : mountM2);
  m.position.set(Math.cos(a)*r, 0, Math.sin(a)*r);
  scene.add(m);
}

// --- torii + small shrine ---
const toriiM = new THREE.MeshStandardMaterial({ color:0xb3402a, roughness:.7 });
{
  const tg = new THREE.Group();
  for(const s of [-1,1]){
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.3,.36,6,8), toriiM);
    p.position.set(s*2.2, 3, 0); p.castShadow = true; tg.add(p);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(6.6,.5,.6), toriiM);
  top.position.y = 6.1; tg.add(top);
  const mid = new THREE.Mesh(new THREE.BoxGeometry(5.2,.35,.45), toriiM);
  mid.position.y = 4.8; tg.add(mid);
  tg.position.set(-40, 0, 100); tg.rotation.y = Math.PI/2; scene.add(tg);
  const shrine = addHouse(-52, 100, Math.PI/2, {w:6, d:5, h:2.6});
}

// clouds
const cloudM = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:.85 });
const clouds = [];
for(let i=0;i<10;i++){
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(8,16), 1), cloudM);
  c.scale.y = .35;
  c.position.set(rand(-260,260), rand(70,110), rand(-260,260));
  scene.add(c); clouds.push(c);
}

// knockable targets (signs & scarecrows) for the rampage mission
const signM = new THREE.MeshStandardMaterial({ color:0xd8d8d8, roughness:.6 });
function addKnockable(x, z, kind){
  const g = new THREE.Group();
  if (kind === 'sign'){
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,2.6,6), M.pole);
    post.position.y = 1.3; g.add(post);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.06,20), signM);
    plate.rotation.x = Math.PI/2; plate.position.y = 2.3; g.add(plate);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.55,.05,6,24),
      new THREE.MeshStandardMaterial({ color:0xc03a2a }));
    rim.position.y = 2.3; g.add(rim);
  } else { // scarecrow
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,2.2,6), M.pole);
    post.position.y = 1.1; g.add(post);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.6,6), M.pole);
    arm.rotation.z = Math.PI/2; arm.position.y = 1.7; g.add(arm);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.3,8,8),
      new THREE.MeshStandardMaterial({ color:0xd9c07a }));
    head.position.y = 2.4; g.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(.45,.4,8),
      new THREE.MeshStandardMaterial({ color:0xb39a55 }));
    hat.position.y = 2.7; g.add(hat);
  }
  g.position.set(x, 0, z);
  g.traverse(o=>{ if(o.isMesh) o.castShadow = true; });
  scene.add(g);
  const k = { g, x, z, down:false, kind };
  knockables.push(k);
  return k;
}
addKnockable(-52, -60, 'sign'); addKnockable(52, -58, 'sign');
addKnockable(-120, -95, 'crow'); addKnockable(122, -75, 'crow');
addKnockable(-30, 140, 'crow'); addKnockable(0, 8, 'sign');
addKnockable(110, 120, 'crow');

// ============================== characters ==============================
function makeGrandma(opt={}){
  const g = new THREE.Group();
  const shirtM = opt.shirt || M.shirt, pantsM = opt.pants || M.pants;
  const hairM = opt.hair || M.hair;
  // legs (pants)
  const legG = new THREE.CylinderGeometry(.14, .17, .75, 8);
  const legL = new THREE.Mesh(legG, pantsM); legL.position.set(-.16, .38, 0);
  const legR = new THREE.Mesh(legG, pantsM); legR.position.set(.16, .38, 0);
  // torso - hunched forward
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.3, .38, .85, 10), shirtM);
  torso.position.set(0, 1.12, .06); torso.rotation.x = .22;
  // arms
  const armG = new THREE.CylinderGeometry(.09, .08, .62, 8);
  const armL = new THREE.Mesh(armG, shirtM); armL.position.set(-.4, 1.2, .1); armL.rotation.z = .25;
  const armR = new THREE.Mesh(armG, shirtM); armR.position.set(.4, 1.2, .1); armR.rotation.z = -.25;
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(.26, 12, 12), M.skin);
  head.position.set(0, 1.72, .2);
  // hair bun
  const bun = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 8), hairM);
  bun.position.set(0, 1.95, .12);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.27, 12, 12, 0, Math.PI*2, 0, Math.PI*.55), hairM);
  hairCap.position.set(0, 1.75, .18); hairCap.rotation.x = -.4;
  // face: simple eyes
  const eyeM = new THREE.MeshBasicMaterial({ color:0x201510 });
  const eL = new THREE.Mesh(new THREE.SphereGeometry(.028, 6, 6), eyeM); eL.position.set(-.09, 1.74, .44);
  const eR = eL.clone(); eR.position.x = .09;
  g.add(legL, legR, torso, armL, armR, head, bun, hairCap, eL, eR);
  g.traverse(o=>{ if(o.isMesh) o.castShadow = true; });
  g.userData = { legL, legR, armL, armR, torso, head };
  return g;
}

// ============================== vehicles ==============================
function makeScooter(){ // red senior scooter with basket
  const g = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color:0xb03a30, roughness:.4, metalness:.3 });
  const darkM = new THREE.MeshStandardMaterial({ color:0x2a2a2e, roughness:.8 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(.55, .12, 1.5), bodyM); deck.position.y = .35;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(.5, .18, .5), darkM); seat.position.set(0, .75, -.35);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.5,8), darkM); post.position.set(0,.55,-.35);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.8,8), bodyM);
  column.position.set(0, .75, .62); column.rotation.x = .3;
  const bars = new THREE.Mesh(new THREE.BoxGeometry(.55,.06,.06), darkM); bars.position.set(0, 1.12, .75);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(.4,.3,.3),
    new THREE.MeshStandardMaterial({ color:0x8a8a8a, roughness:.6, wireframe:true }));
  basket.position.set(0, .85, .85);
  const wheelG = new THREE.CylinderGeometry(.17,.17,.1,12);
  const wheels = [];
  for(const [wx,wz] of [[-.28,.6],[.28,.6],[-.28,-.55],[.28,-.55]]){
    const w = new THREE.Mesh(wheelG, darkM); w.rotation.z = Math.PI/2; w.position.set(wx,.17,wz);
    g.add(w); wheels.push(w);
  }
  g.add(deck, seat, post, column, bars, basket);
  g.traverse(o=>{ if(o.isMesh) o.castShadow = true; });
  g.userData = { wheels, type:'scooter', name:'シニアカー', speed:11, accel:8, turn:2.2 };
  return g;
}
function makeBicycle(){ // green mamachari
  const g = new THREE.Group();
  const frameM = new THREE.MeshStandardMaterial({ color:0x3f6b4a, roughness:.5, metalness:.4 });
  const darkM = new THREE.MeshStandardMaterial({ color:0x222226, roughness:.8 });
  const wheelG = new THREE.TorusGeometry(.34, .05, 8, 20);
  const wF = new THREE.Mesh(wheelG, darkM); wF.position.set(0, .34, .55);
  const wB = new THREE.Mesh(wheelG, darkM); wB.position.set(0, .34, -.5);
  const frame1 = new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.1,6), frameM);
  frame1.rotation.x = Math.PI/2.4; frame1.position.set(0, .6, .05);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.6,6), frameM);
  post.position.set(0, .75, -.35);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(.25,.08,.25), darkM); seat.position.set(0,1.05,-.35);
  const bars = new THREE.Mesh(new THREE.BoxGeometry(.5,.05,.05), darkM); bars.position.set(0,1.05,.62);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.5,6), frameM);
  stem.position.set(0,.85,.58); stem.rotation.x = .35;
  const basket = new THREE.Mesh(new THREE.BoxGeometry(.35,.28,.25),
    new THREE.MeshStandardMaterial({ color:0x999999, wireframe:true }));
  basket.position.set(0,.8,.78);
  g.add(wF, wB, frame1, post, seat, bars, stem, basket);
  g.traverse(o=>{ if(o.isMesh) o.castShadow = true; });
  g.userData = { wheels:[wF,wB], type:'bicycle', name:'ママチャリ', speed:8, accel:6, turn:2.6 };
  return g;
}
function makeTruck(){ // white kei truck
  const g = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color:0xf0f0ea, roughness:.35, metalness:.2 });
  const darkM = new THREE.MeshStandardMaterial({ color:0x26262a, roughness:.85 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.25, 1.5), bodyM); cab.position.set(0, 1.15, 1.0);
  const glassM = new THREE.MeshStandardMaterial({ color:0x8fb8c8, roughness:.1, metalness:.4 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.5, .55, 1.3), glassM); glass.position.set(0, 1.45, 1.0);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.7, .5, 2.2), bodyM); bed.position.set(0, .85, -.9);
  const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(1.6, .1, 2.1), darkM); bedFloor.position.set(0, 1.06, -.9);
  for(const s of [-1,1]){
    const rail = new THREE.Mesh(new THREE.BoxGeometry(.08, .45, 2.2), bodyM);
    rail.position.set(s*.82, 1.25, -.9); g.add(rail);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, .45, .08), bodyM); tail.position.set(0, 1.25, -1.98);
  const wheelG = new THREE.CylinderGeometry(.32,.32,.22,12);
  const wheels = [];
  for(const [wx,wz] of [[-.78,.95],[.78,.95],[-.78,-1.1],[.78,-1.1]]){
    const w = new THREE.Mesh(wheelG, darkM); w.rotation.z = Math.PI/2; w.position.set(wx,.32,wz);
    g.add(w); wheels.push(w);
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(.5,.25),
    new THREE.MeshBasicMaterial({ color:0xe8c53a }));
  plate.position.set(0, .6, -2.03); plate.rotation.y = Math.PI;
  const lightM = new THREE.MeshBasicMaterial({ color:0xc03028 });
  for(const s of [-1,1]){
    const l = new THREE.Mesh(new THREE.BoxGeometry(.22,.14,.05), lightM);
    l.position.set(s*.6, .62, -2.02); g.add(l);
  }
  g.add(cab, glass, bed, bedFloor, tail, plate);
  g.traverse(o=>{ if(o.isMesh) o.castShadow = true; });
  g.userData = { wheels, type:'truck', name:'軽トラ', speed:19, accel:10, turn:1.6 };
  return g;
}

// ============================== entities ==============================
const player = {
  g: makeGrandma(),
  pos: V3(-88, 0, -62), heading: Math.PI/4,
  speed: 0, walkT: 0,
  health: 100, money: 3000,
  vehicle: null,           // vehicle object when riding
  weapon: -1,              // -1 none, 0..4
};
scene.add(player.g);

const scooter = { g: makeScooter(), pos: V3(-84, 0, -58), heading: 1.2, speed:0 };
const bicycle = { g: makeBicycle(), pos: V3(-92, 0, -55), heading: -.4, speed:0 };
const truck   = { g: makeTruck(),   pos: V3(72, 0, 66), heading: -2.2, speed:0 };
const vehicles = [scooter, bicycle, truck];
vehicles.forEach(v => { v.g.position.copy(v.pos); v.g.rotation.y = v.heading; scene.add(v.g); });

// NPCs
const npcs = [];
function makeNPC(opt, x, z){
  const n = { g: makeGrandma(opt), pos: V3(x, 0, z), heading: rand(0, 6.28),
    walkT: rand(0,9), speed: 0, home: V3(x,0,z), state:'idle', fleeT:0, opt };
  n.g.position.copy(n.pos); scene.add(n.g);
  npcs.push(n); return n;
}
const tanaka = makeNPC({ shirt:new THREE.MeshStandardMaterial({ color:0x4a6741, roughness:.9 }),
  pants:new THREE.MeshStandardMaterial({ color:0x6b5a40, roughness:.9 }),
  hair:new THREE.MeshStandardMaterial({ color:0xd8d8d8 }) }, 80, 72);
tanaka.name = '田中さん';
const tane = makeNPC({ shirt:new THREE.MeshStandardMaterial({ color:0x3f5b46, roughness:.9 }) }, 78, 78);
tane.name = 'タネさん';
// grandpa on bicycle, loops the roads
const cyclist = makeNPC({ shirt:new THREE.MeshStandardMaterial({ color:0x4a5a7a, roughness:.9 }),
  pants:new THREE.MeshStandardMaterial({ color:0x3a3a3e }) }, -40, 20);
{
  const b = makeBicycle(); b.position.copy(cyclist.pos); scene.add(b);
  cyclist.bike = b;
}
// wandering villagers
makeNPC({ shirt:new THREE.MeshStandardMaterial({ color:0xa88f5a }) }, -20, -60);
makeNPC({ shirt:new THREE.MeshStandardMaterial({ color:0x7a6a8a }) }, 30, 20);
makeNPC({ shirt:new THREE.MeshStandardMaterial({ color:0x8a4a3a }) }, 100, 40);

// ============================== audio ==============================
let AC = null;
function audio(){ if(!AC) AC = new (window.AudioContext||window.webkitAudioContext)(); return AC; }
function beep(freq, dur, type='sine', vol=.15, slide=0){
  try{
    const ac = audio(), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide), ac.currentTime+dur);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime+dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime+dur);
  }catch(e){}
}
function noiseBurst(dur, vol=.2, low=400){
  try{
    const ac = audio(), n = ac.createBufferSource();
    const buf = ac.createBuffer(1, ac.sampleRate*dur, ac.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1-i/d.length);
    n.buffer = buf;
    const f = ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value = low;
    const g = ac.createGain(); g.gain.value = vol;
    n.connect(f); f.connect(g); g.connect(ac.destination); n.start();
  }catch(e){}
}
const sfx = {
  pickup(){ beep(660,.12,'square',.12); beep(990,.18,'square',.1); },
  shoot(){ noiseBurst(.12,.3,1400); beep(180,.1,'sawtooth',.2,-120); },
  spray(){ noiseBurst(.5,.12,3000); },
  swing(){ noiseBurst(.08,.12,900); },
  hit(){ beep(120,.15,'square',.2,-60); noiseBurst(.08,.15,500); },
  explosion(){ noiseBurst(1.4,.5,200); beep(55,1.2,'sawtooth',.3,-30); },
  engine(){ /* continuous handled separately */ },
  passed(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.3,'square',.14), i*140)); },
  failed(){ [392,330,262,196].forEach((f,i)=>setTimeout(()=>beep(f,.35,'sawtooth',.12), i*180)); },
  dialog(){ beep(880,.05,'square',.06); },
};

// ============================== HUD ==============================
const el = id => document.getElementById(id);
const ui = {
  money: el('money'), health: el('health'), wanted: el('wanted'),
  objective: el('objective'), toast: el('toast'), prompt: el('prompt'),
  dialog: el('dialog'), wheel: el('wheel'), banner: el('banner'),
  title: el('title'), fade: el('fade'),
  slots: [...document.querySelectorAll('.wslot')],
};
function setMoney(v){ player.money = v; ui.money.textContent = v.toLocaleString() + '円'; }
function setHealth(v){ player.health = clamp(v,0,100); ui.health.style.width = player.health + '%'; }
let wantedLevel = 0;
function setWanted(n){ wantedLevel = n;
  ui.wanted.style.display = n>0 ? 'block' : 'none';
  ui.wanted.textContent = '★'.repeat(n) + '☆'.repeat(Math.max(0,5-n)); }
function setObjective(jp, en){
  if(!jp){ ui.objective.style.display='none'; return; }
  ui.objective.style.display='block';
  ui.objective.innerHTML = jp + (en? `<span class="en">${en}</span>` : '');
}
let toastTimer = null;
function showToast(html, secs=5){
  ui.toast.innerHTML = html; ui.toast.style.display = 'block';
  clearTimeout(toastTimer);
  if (secs) toastTimer = setTimeout(()=> ui.toast.style.display='none', secs*1000);
}
function showPrompt(label){
  ui.prompt.style.display = 'block';
  ui.prompt.querySelector('.label').textContent = label;
}
function hidePrompt(){ ui.prompt.style.display = 'none'; }
let dialogQueue = [], dialogActive = false;
function say(who, line){ dialogQueue.push({who, line}); pumpDialog(); }
function pumpDialog(){
  if (dialogActive || !dialogQueue.length) return;
  dialogActive = true;
  const d = dialogQueue.shift();
  ui.dialog.querySelector('.who').textContent = d.who;
  ui.dialog.querySelector('.line').textContent = d.line;
  ui.dialog.style.display = 'block';
  sfx.dialog();
  setTimeout(()=>{ ui.dialog.style.display='none'; dialogActive=false; pumpDialog(); },
    1400 + d.line.length * 90);
}
function banner(kind, sub){
  ui.banner.className = 'hud ' + kind;
  ui.banner.querySelector('.big').textContent = kind==='pass' ? 'Mission Passed' : 'Mission Failed';
  ui.banner.querySelector('.sub').textContent = sub || '';
  ui.banner.style.display = 'flex';
  if (kind==='pass') sfx.passed(); else sfx.failed();
  setTimeout(()=> ui.banner.style.display='none', 3600);
}

// minimap
const mm = el('minimap').getContext('2d');
const mapBase = document.createElement('canvas'); mapBase.width = 380; mapBase.height = 380;
{
  const g = mapBase.getContext('2d');
  const s = 380/WORLD;
  g.fillStyle = '#22341f'; g.fillRect(0,0,380,380);
  g.fillStyle = '#3c5a34';
  [[-130,-110,46,40],[-140,-20,36,46],[130,-90,44,52],[120,130,56,40],[-40,150,60,36],[-140,110,40,44]]
    .forEach(([x,z,w,d])=> g.fillRect((x-w/2+WORLD/2)*s,(z-d/2+WORLD/2)*s,w*s,d*s));
  g.strokeStyle = '#6b6b70'; g.lineCap='round'; g.lineWidth = ROADW*s;
  roadsH.forEach(z=>{ g.beginPath(); g.moveTo(10,(z+WORLD/2)*s); g.lineTo(370,(z+WORLD/2)*s); g.stroke(); });
  roadsV.forEach(x=>{ g.beginPath(); g.moveTo((x+WORLD/2)*s,30); g.lineTo((x+WORLD/2)*s,360); g.stroke(); });
  g.fillStyle = '#8d8d8d';
}
let missionBlip = null; // V3 world pos
function drawMinimap(){
  const s = 380/WORLD, px = (player.pos.x+WORLD/2)*s, pz = (player.pos.z+WORLD/2)*s;
  mm.clearRect(0,0,380,380);
  mm.save();
  mm.beginPath(); mm.arc(190,190,186,0,7); mm.clip();
  mm.drawImage(mapBase,0,0);
  // vehicles
  mm.fillStyle = '#e8c53a';
  vehicles.forEach(v=>{ if(player.vehicle!==v){ mm.fillRect((v.pos.x+WORLD/2)*s-3,(v.pos.z+WORLD/2)*s-3,6,6); }});
  // npcs
  mm.fillStyle = '#ddd';
  npcs.forEach(n=>{ mm.beginPath(); mm.arc((n.pos.x+WORLD/2)*s,(n.pos.z+WORLD/2)*s,3.4,0,7); mm.fill(); });
  // mission blip
  if (missionBlip){
    const bx = (missionBlip.x+WORLD/2)*s, bz = (missionBlip.z+WORLD/2)*s;
    mm.fillStyle = '#ffd34d';
    mm.save(); mm.translate(bx,bz); mm.rotate(Math.PI/4);
    const pulse = 7 + Math.sin(performance.now()/220)*2;
    mm.fillRect(-pulse/2,-pulse/2,pulse,pulse); mm.restore();
  }
  // player arrow
  mm.save(); mm.translate(px,pz); mm.rotate(-player.heading + Math.PI);
  mm.fillStyle = '#fff';
  mm.beginPath(); mm.moveTo(0,-9); mm.lineTo(6,7); mm.lineTo(-6,7); mm.closePath(); mm.fill();
  mm.restore();
  mm.restore();
}

// ============================== input ==============================
const keys = {};
let camYaw = Math.PI*.8, camPitch = .32, camDist = 7;
let pointerLocked = false;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Tab'){ e.preventDefault(); toggleWheel(true); }
  if (e.code === 'KeyE') doInteract();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { if(e.code==='Tab') toggleWheel(false); keys[e.code] = false; });
canvas.addEventListener('click', () => {
  if (!running) return;
  if (!pointerLocked && !isTouch) canvas.requestPointerLock();
});
addEventListener('mousemove', e => {
  if (!pointerLocked) return;
  camYaw   -= e.movementX * .0028;
  camPitch = clamp(camPitch + e.movementY * .0022, -.15, .9);
});
document.addEventListener('pointerlockchange', ()=> pointerLocked = document.pointerLockElement === canvas);
addEventListener('mousedown', e => { if (running && pointerLocked && e.button===0) useWeapon(); });

// touch
const isTouch = 'ontouchstart' in window;
let joy = { x:0, y:0, on:false }, touchCam = null;
if (isTouch){
  const stick = el('stick'), knob = el('knob'), actbtn = el('actbtn');
  actbtn.style.display = 'flex';
  addEventListener('touchstart', e => {
    for(const t of e.changedTouches){
      if (t.clientX < innerWidth*.45 && !joy.on){
        joy.on = true; joy.id = t.identifier; joy.cx = t.clientX; joy.cy = t.clientY;
        stick.style.display='block';
        stick.style.left = (t.clientX-60)+'px'; stick.style.top = (t.clientY-60)+'px';
      } else if (!touchCam){
        touchCam = { id:t.identifier, x:t.clientX, y:t.clientY };
      }
    }
  }, {passive:false});
  addEventListener('touchmove', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      if (joy.on && t.identifier === joy.id){
        const dx = clamp(t.clientX - joy.cx, -45, 45), dy = clamp(t.clientY - joy.cy, -45, 45);
        joy.x = dx/45; joy.y = dy/45;
        knob.style.left = (35+dx)+'px'; knob.style.top = (35+dy)+'px';
      } else if (touchCam && t.identifier === touchCam.id){
        camYaw -= (t.clientX - touchCam.x)*.006;
        camPitch = clamp(camPitch + (t.clientY - touchCam.y)*.004, -.15, .9);
        touchCam.x = t.clientX; touchCam.y = t.clientY;
      }
    }
  }, {passive:false});
  addEventListener('touchend', e => {
    for(const t of e.changedTouches){
      if (joy.on && t.identifier === joy.id){ joy = {x:0,y:0,on:false}; el('stick').style.display='none'; }
      if (touchCam && t.identifier === touchCam.id) touchCam = null;
    }
  });
  actbtn.addEventListener('touchstart', e => { e.stopPropagation(); doInteract(); });
}

// weapon wheel
const WEAPONS = [
  { icon:'🔫', name:'ハンドガン' },
  { icon:'🧸', name:'クマ避けスプレー' },
  { icon:'⛏️', name:'スコップ' },
  { icon:'🌾', name:'片手鎌' },
  { icon:'💩', name:'こやし' },
];
let wheelOpen = false, wheelSel = 0;
function toggleWheel(open){
  if (open === wheelOpen) return;
  wheelOpen = open;
  ui.wheel.style.display = open ? 'flex' : 'none';
  if (open) renderWheel();
}
function renderWheel(){
  const p = ui.wheel.querySelector('.panel');
  p.innerHTML = '';
  WEAPONS.forEach((w,i)=>{
    const d = document.createElement('div');
    d.className = 'item' + (i===wheelSel?' sel':'');
    d.innerHTML = `<span class="ic">${w.icon}</span>${w.name}`;
    d.onclick = ()=>{ wheelSel = i; equip(i); toggleWheel(false); };
    p.appendChild(d);
  });
}
addEventListener('keydown', e => {
  if (wheelOpen && e.code.startsWith('Digit')){
    const i = +e.code.slice(5) - 1;
    if (i>=0 && i<WEAPONS.length){ wheelSel=i; equip(i); toggleWheel(false); }
  }
});
function equip(i){
  player.weapon = i;
  ui.slots.forEach((s,j)=> s.classList.toggle('cur', j===i));
  showToast(`<b>${WEAPONS[i].name}</b> を装備`, 2);
}
ui.slots.forEach((s,i)=> s.parentElement.style.pointerEvents='auto');

// ============================== effects ==============================
const effects = [];
function spawnPuff(pos, color, n=10, spread=.6, up=2.5, size=.3, life=.7){
  for(let i=0;i<n;i++){
    const p = new THREE.Mesh(new THREE.SphereGeometry(size*rand(.5,1.2), 6, 6),
      new THREE.MeshBasicMaterial({ color, transparent:true, opacity:.85 }));
    p.position.copy(pos).add(V3(rand(-spread,spread), rand(0,spread), rand(-spread,spread)));
    scene.add(p);
    effects.push({ m:p, t:0, life: life*rand(.7,1.3),
      vel: V3(rand(-1.5,1.5), rand(up*.4,up), rand(-1.5,1.5)), fade:true });
  }
}
function spawnExplosion(pos){
  for(let i=0;i<40;i++){
    const fire = new THREE.Mesh(new THREE.SphereGeometry(rand(.4,1.1), 6, 6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(rand(.02,.1), 1, rand(.45,.65)), transparent:true }));
    fire.position.copy(pos);
    scene.add(fire);
    const a = rand(0,Math.PI*2), sp = rand(4,16);
    effects.push({ m:fire, t:0, life:rand(.5,1.4),
      vel: V3(Math.cos(a)*sp, rand(3,14), Math.sin(a)*sp), fade:true, grav:-14 });
  }
  for(let i=0;i<18;i++){ // debris
    const d = new THREE.Mesh(new THREE.BoxGeometry(rand(.2,.6),rand(.1,.3),rand(.2,.6)),
      new THREE.MeshStandardMaterial({ color:0x3a3230 }));
    d.position.copy(pos);
    scene.add(d);
    const a = rand(0,Math.PI*2), sp = rand(6,18);
    effects.push({ m:d, t:0, life:rand(.8,1.6),
      vel: V3(Math.cos(a)*sp, rand(6,18), Math.sin(a)*sp), grav:-22, spin:V3(rand(-8,8),rand(-8,8),rand(-8,8)) });
  }
  spawnPuff(pos, 0x555555, 16, 1.5, 5, .9, 1.6);
  sfx.explosion();
  shake = .9;
}
let bullets = [];
function fireBullet(from, dir, hostile=false){
  const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 6),
    new THREE.MeshBasicMaterial({ color:0xffe9a0 }));
  b.position.copy(from);
  scene.add(b);
  bullets.push({ m:b, vel: dir.clone().multiplyScalar(hostile? 10 : 45), t:0, hostile });
}
function updateEffects(dt){
  for(let i=effects.length-1;i>=0;i--){
    const e = effects[i]; e.t += dt;
    if (e.grav) e.vel.y += e.grav*dt;
    e.m.position.addScaledVector(e.vel, dt);
    if (e.spin){ e.m.rotation.x += e.spin.x*dt; e.m.rotation.y += e.spin.y*dt; }
    if (e.m.position.y < .1 && e.grav){ e.m.position.y = .1; e.vel.set(0,0,0); }
    if (e.fade) e.m.material.opacity = Math.max(0, .85*(1 - e.t/e.life));
    if (e.t >= e.life){ scene.remove(e.m); effects.splice(i,1); }
  }
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i]; b.t += dt;
    b.m.position.addScaledVector(b.vel, dt);
    let dead = b.t > 2.2;
    if (b.hostile && dist2d(b.m.position, player.pos) < .55 && b.m.position.y < 2.2){
      setHealth(player.health - 8); sfx.hit(); shake = Math.max(shake,.25); dead = true;
      spawnPuff(b.m.position, 0xc04030, 5, .3, 1.5, .15, .4);
    }
    if (dead){ scene.remove(b.m); bullets.splice(i,1); }
  }
}

// ============================== weapons ==============================
let sprays = [];   // lingering calm clouds
function useWeapon(){
  if (player.vehicle || player.weapon < 0) return;
  const fwd = V3(Math.sin(player.heading), 0, Math.cos(player.heading));
  const hand = player.pos.clone().add(V3(0, 1.3, 0)).addScaledVector(fwd, .5);
  if (player.weapon === 0){ // handgun
    sfx.shoot(); shake = Math.max(shake, .18);
    fireBullet(hand, fwd);
    spawnPuff(hand, 0xffe9a0, 4, .1, .8, .08, .2);
    // hit test npcs
    npcs.forEach(n => {
      const to = n.pos.clone().sub(player.pos); const d = to.length();
      if (d < 30 && to.normalize().dot(fwd) > .995){
        if (n === tanaka && mission === 3){ failMission('田中さんがあの世に行っちまった'); }
        else { n.state = 'flee'; n.fleeT = 6; setWanted(Math.min(5, wantedLevel+1)); }
      }
    });
  } else if (player.weapon === 1){ // bear spray
    sfx.spray();
    const cp = player.pos.clone().addScaledVector(fwd, 1.6); cp.y = 1;
    spawnPuff(cp, 0x7ee06a, 14, .8, 1.2, .35, 2.2);
    sprays.push({ pos: cp, t: 0, life: 2.2 });
  } else if (player.weapon === 2 || player.weapon === 3){ // melee
    sfx.swing();
    const reach = player.pos.clone().addScaledVector(fwd, 1.4);
    knockables.forEach(k => { if (!k.down && dist2d(k.g.position, reach) < 1.8) knockDown(k); });
    if (mission === 3 && dist2d(tanaka.pos, reach) < 2){ calmTanaka(18); }
    npcs.forEach(n => { if (n!==tanaka && dist2d(n.pos, reach) < 2){ n.state='flee'; n.fleeT=6; } });
  } else if (player.weapon === 4){ // fertilizer toss
    sfx.swing();
    const bag = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 8),
      new THREE.MeshStandardMaterial({ color:0xd9d2c0 }));
    bag.position.copy(hand); scene.add(bag);
    const vel = fwd.clone().multiplyScalar(10); vel.y = 5;
    effects.push({ m:bag, t:0, life:1.1, vel, grav:-14, onEnd: p => {
      spawnPuff(p, 0x69b04a, 22, 1.6, 2.2, .5, 2.6);
      sprays.push({ pos: p.clone(), t: 0, life: 3, big: true });
    }});
  }
}
function updateSprays(dt){
  for(let i=sprays.length-1;i>=0;i--){
    const s = sprays[i]; s.t += dt;
    if (mission === 3 && tanaka.state === 'hostile'){
      const r = s.big ? 4 : 3;
      if (dist2d(tanaka.pos, s.pos) < r) calmTanaka(dt * (s.big ? 40 : 30));
    }
    if (s.t >= s.life) sprays.splice(i,1);
  }
}

// ============================== knockables ==============================
let knockedCount = 0;
function knockDown(k){
  k.down = true; knockedCount++;
  sfx.hit(); spawnPuff(k.g.position.clone().add(V3(0,1,0)), 0xcfcfcf, 8, .5, 2, .2, .5);
  k.g.rotation.x = -Math.PI/2.2; k.g.position.y = .2;
  if (mission === 4){
    setMoney(player.money + 500);
    if (knockedCount >= 6) m4Finale();
    else setObjective(`ケジメ ${knockedCount}/6`, `WRECK THE TARGETS`);
  }
}

// ============================== interactions ==============================
let kairanban = null;
{
  const kb = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(.5, .04, .7),
    new THREE.MeshStandardMaterial({ color:0xd9c9a0 }));
  board.rotation.z = .2;
  kb.add(board);
  kb.position.set(-89, .85, -67.5);
  scene.add(kb); kairanban = kb;
}
function nearestVehicle(){
  let best = null, bd = 3;
  vehicles.forEach(v => { const d = dist2d(v.pos, player.pos); if (d < bd){ bd = d; best = v; } });
  return best;
}
function doInteract(){
  if (!running || player.vehicle){ if (player.vehicle) exitVehicle(); return; }
  if (mission === 1 && kairanban && dist2d(kairanban.position, player.pos) < 2.2){
    scene.remove(kairanban); kairanban = null; sfx.pickup();
    startMission2(); return;
  }
  const v = nearestVehicle();
  if (v) enterVehicle(v);
}
function enterVehicle(v){
  player.vehicle = v; player.g.visible = false;
  const ut = v.g.userData.type;
  if (ut === 'bicycle') showToast('<b>SHIFT</b> 長押しで早漕ぎ。', 4);
  if (ut === 'truck' && mission === 4 && missionPhase === 0) m4Rampage();
  sfx.pickup();
}
function exitVehicle(){
  const v = player.vehicle; if (!v) return;
  player.vehicle = null; player.g.visible = true;
  player.pos.copy(v.pos).add(V3(Math.sin(v.heading+Math.PI/2)*1.6, 0, Math.cos(v.heading+Math.PI/2)*1.6));
  v.speed = 0;
}

// ============================== missions ==============================
let mission = 0, missionPhase = 0, running = false;
let calmMeter = 0, rampageTimer = 0;
function startMission1(){
  mission = 1;
  setObjective('回覧板を拾え', 'PICK UP THE CIRCULAR');
  missionBlip = V3(-89, 0, -67.5);
  showToast('回覧板を持っていくのを忘れるな。', 5);
}
function startMission2(){
  mission = 2;
  setObjective('回覧板を田中さんに届けろ', 'DELIVER IT TO TANAKA');
  missionBlip = V3(80, 0, 68);
  showToast('田中さんの家は村の反対側だ。自転車やバイクを使え。', 6);
}
function startMission3(){
  mission = 3; calmMeter = 0;
  setObjective('田中さんを落ち着かせろ', 'CALM TANAKA DOWN');
  missionBlip = null;
  tanaka.state = 'hostile'; tanaka.shootT = 1.5;
  equip(1);
  showToast('<b>クマ避けスプレー</b> で落ち着かせろ。撃つのはダメだ！', 6);
  // green aura
  const aura = new THREE.PointLight(0x5aff4a, 8, 9);
  aura.position.y = 1.5; tanaka.g.add(aura); tanaka.aura = aura;
}
function calmTanaka(v){
  if (mission !== 3) return;
  calmMeter = clamp(calmMeter + v, 0, 100);
  setObjective(`田中さんを落ち着かせろ ${Math.floor(calmMeter)}%`, 'CALM TANAKA DOWN');
  if (calmMeter >= 100){
    tanaka.state = 'calm';
    if (tanaka.aura){ tanaka.g.remove(tanaka.aura); tanaka.aura = null; }
    spawnPuff(tanaka.pos.clone().add(V3(0,1.5,0)), 0x9fe08a, 12, .6, 1.5, .3, .8);
    setTimeout(m3End, 800);
  }
}
function m3End(){
  setObjective(null);
  say('ウメ', 'まったく、どうかしてるよ。');
  say('タネ', 'ウメさんじゃねえか！');
  say('タネ', 'それにしても最近は物騒よね…');
  say('タネ', '新しく越してきた人、道に看板を置きっぱなしにしてるのよ。');
  say('ウメ', '…ケジメをつけに行くか。');
  say('タネ', '軽トラを貸してあげるよ。');
  setTimeout(startMission4, 9500);
}
function startMission4(){
  mission = 4; missionPhase = 0;
  setObjective('軽トラに乗れ', 'GET IN THE KEI TRUCK');
  missionBlip = V3(72, 0, 66);
  tane.state = 'follow';
}
function m4Rampage(){
  missionPhase = 1; knockedCount = 0; rampageTimer = 90;
  setWanted(3);
  setObjective('ケジメ 0/6', 'WRECK THE TARGETS');
  missionBlip = null;
  showToast('90秒以内に看板とかかしを <b>6つ</b> なぎ倒せ！', 6);
}
function m4Finale(){
  missionPhase = 2;
  spawnExplosion(V3(0, 1, 8));
  spawnExplosion(player.pos.clone().add(V3(0,1,0)));
  setTimeout(()=>{
    banner('pass', 'ケジメ完了 ・ +20,000円');
    setMoney(player.money + 20000);
    setWanted(0);
    setObjective(null);
    mission = 5; // free roam
    setTimeout(()=> showToast('自由に村を回ろう。お疲れさま、ウメさん。', 7), 4000);
  }, 1200);
}
function failMission(reason){
  banner('fail', reason);
  setTimeout(()=>{
    setHealth(100); setWanted(0);
    if (mission === 3){ calmMeter = 0; startMission3(); }
    player.pos.set(-88, 0, -62);
  }, 3800);
}

// ============================== movement & physics ==============================
function collide(pos, r=.5){
  for(const c of colliders){
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const px = c.hw + r - Math.abs(dx), pz = c.hd + r - Math.abs(dz);
    if (px > 0 && pz > 0){
      if (px < pz) pos.x = c.x + Math.sign(dx)*(c.hw + r);
      else pos.z = c.z + Math.sign(dz)*(c.hd + r);
    }
  }
  const B = WORLD/2 - 8;
  pos.x = clamp(pos.x, -B, B); pos.z = clamp(pos.z, -B, B);
  pos.y = 0;
}
function moveOnFoot(dt){
  let ix = 0, iz = 0;
  if (keys.KeyW) iz += 1; if (keys.KeyS) iz -= 1;
  if (keys.KeyA) ix -= 1; if (keys.KeyD) ix += 1;
  if (joy.on){ ix += joy.x; iz -= joy.y; }
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const spd = sprint ? 7.5 : 4.2;
  if (ix || iz){
    const fwd = V3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const right = V3(fwd.z, 0, -fwd.x);
    const dir = fwd.multiplyScalar(iz).addScaledVector(right, -ix).normalize();
    const targetH = Math.atan2(dir.x, dir.z);
    let dh = targetH - player.heading;
    while (dh > Math.PI) dh -= Math.PI*2; while (dh < -Math.PI) dh += Math.PI*2;
    player.heading += dh * Math.min(1, dt*12);
    player.speed = THREE.MathUtils.lerp(player.speed, spd, dt*8);
    player.pos.addScaledVector(dir, player.speed*dt);
    player.walkT += dt * (sprint ? 11 : 7);
  } else {
    player.speed = THREE.MathUtils.lerp(player.speed, 0, dt*10);
    player.walkT += dt * 2;
  }
  collide(player.pos);
  // animate
  const u = player.g.userData, sw = Math.sin(player.walkT) * clamp(player.speed/5, 0, 1) * .55;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  u.armL.rotation.x = -sw*.8; u.armR.rotation.x = sw*.8;
  player.g.position.copy(player.pos);
  player.g.rotation.y = player.heading;
}
function driveVehicle(v, dt){
  const u = v.g.userData;
  let steer = 0, gas = 0;
  if (keys.KeyW) gas += 1; if (keys.KeyS) gas -= .6;
  if (keys.KeyA) steer += 1; if (keys.KeyD) steer -= 1;
  if (joy.on){ gas -= joy.y; steer -= joy.x; }
  const boost = (keys.ShiftLeft || keys.ShiftRight) ? 1.45 : 1;
  v.speed = THREE.MathUtils.lerp(v.speed, gas * u.speed * boost, dt * u.accel / 4);
  v.heading += steer * u.turn * dt * clamp(Math.abs(v.speed)/4, 0, 1) * Math.sign(v.speed || 1);
  const fwd = V3(Math.sin(v.heading), 0, Math.cos(v.heading));
  v.pos.addScaledVector(fwd, v.speed * dt);
  collide(v.pos, u.type === 'truck' ? 1.4 : .7);
  v.g.position.copy(v.pos); v.g.rotation.y = v.heading;
  u.wheels.forEach(w => w.rotation.x += v.speed * dt * 2);
  player.pos.copy(v.pos); player.heading = v.heading;
  // truck knocks things down
  if (u.type === 'truck' && Math.abs(v.speed) > 4){
    knockables.forEach(k => { if (!k.down && dist2d(k.g.position, v.pos) < 2.2) knockDown(k); });
    npcs.forEach(n => { if (dist2d(n.pos, v.pos) < 3.5){ n.state='flee'; n.fleeT=6; } });
  }
  // engine hum
  if (Math.abs(v.speed) > 1 && Math.random() < dt*8) beep(60 + Math.abs(v.speed)*4, .1, 'sawtooth', .03);
}

// ============================== NPC update ==============================
function updateNPCs(dt, t){
  npcs.forEach(n => {
    if (n.state === 'hostile'){ // Tanaka
      const to = player.pos.clone().sub(n.pos); const d = to.length();
      n.heading = Math.atan2(to.x, to.z);
      if (d > 4){ n.pos.addScaledVector(to.normalize(), dt*2.2); n.walkT += dt*6; }
      n.shootT -= dt;
      if (n.shootT <= 0 && d < 26){
        n.shootT = rand(1.0, 1.8);
        const from = n.pos.clone().add(V3(0,1.4,0));
        const dir = player.pos.clone().add(V3(0,1,0)).sub(from).normalize();
        fireBullet(from, dir, true); sfx.shoot();
        spawnPuff(tanaka.pos.clone().add(V3(0,1.2,0)), 0x5aff4a, 3, .5, 1, .25, .5);
      }
    } else if (n.state === 'follow'){ // Tane follows
      const to = player.pos.clone().sub(n.pos); const d = to.length();
      if (d > 3){
        n.heading = Math.atan2(to.x, to.z);
        n.pos.addScaledVector(to.normalize(), dt * Math.min(4.5, d));
        n.walkT += dt*7;
      }
    } else if (n.state === 'flee'){
      const away = n.pos.clone().sub(player.pos).normalize();
      n.heading = Math.atan2(away.x, away.z);
      n.pos.addScaledVector(away, dt*5); n.walkT += dt*10;
      n.fleeT -= dt; if (n.fleeT <= 0) n.state = 'idle';
    } else if (n.bike){ // cyclist loops the block
      n.walkT += dt;
      const loop = [V3(-80,0,20), V3(0,0,20), V3(0,0,-60), V3(-80,0,-60)];
      const seg = Math.floor(t/8) % 4, nxt = loop[(seg+1)%4];
      const to = nxt.clone().sub(n.pos); const d = to.length();
      if (d < 2){ /* next seg */ }
      else {
        n.heading = Math.atan2(to.x, to.z);
        n.pos.addScaledVector(to.normalize(), dt*5);
      }
      n.bike.position.copy(n.pos); n.bike.rotation.y = n.heading;
    } else { // idle wander
      if (Math.random() < dt*.3) n.heading += rand(-1, 1);
      const d = dist2d(n.pos, n.home);
      if (d > 18){ const to = n.home.clone().sub(n.pos); n.heading = Math.atan2(to.x, to.z); }
      n.pos.addScaledVector(V3(Math.sin(n.heading), 0, Math.cos(n.heading)), dt*1.1);
      n.walkT += dt*3;
    }
    collide(n.pos);
    const u = n.g.userData, sw = Math.sin(n.walkT) * .4;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw*.7; u.armR.rotation.x = sw*.7;
    n.g.position.copy(n.pos); n.g.rotation.y = n.heading;
    if (n.bike){ n.g.position.y = .45; }
  });
}

// ============================== camera ==============================
let shake = 0;
function updateCamera(dt){
  const v = player.vehicle;
  const dist = v ? (v.g.userData.type==='truck' ? 11 : 8.5) : 7;
  const target = player.pos.clone().add(V3(0, v?1.6:1.5, 0));
  const cp = new THREE.Vector3(
    target.x - Math.sin(camYaw) * Math.cos(camPitch) * dist,
    target.y + Math.sin(camPitch) * dist,
    target.z - Math.cos(camYaw) * Math.cos(camPitch) * dist,
  );
  camera.position.lerp(cp, Math.min(1, dt*6));
  if (shake > 0){
    camera.position.add(V3(rand(-1,1), rand(-1,1), rand(-1,1)).multiplyScalar(shake*.3));
    shake = Math.max(0, shake - dt*1.8);
  }
  camera.lookAt(target);
}

// ============================== prompts & triggers ==============================
function updateTriggers(dt){
  hidePrompt();
  if (!player.vehicle){
    if (mission === 1 && kairanban && dist2d(kairanban.position, player.pos) < 2.2) showPrompt('拾う');
    else {
      const v = nearestVehicle();
      if (v) showPrompt('乗る - ' + v.g.userData.name);
    }
  } else {
    showPrompt('降りる');
  }
  if (mission === 2 && dist2d(player.pos, V3(80,0,68)) < 7){
    // arrival cutscene
    if (player.vehicle) exitVehicle();
    mission = 2.5;
    setObjective(null); missionBlip = null;
    say('ウメ', '田中さん、回覧板だ！おら！');
    say('田中', '誰だボケェ！！');
    setTimeout(startMission3, 3200);
  }
  if (mission === 4 && missionPhase === 1){
    rampageTimer -= dt;
    if (rampageTimer <= 0){
      missionPhase = 0;
      setWanted(0);
      failMission('ケジメがつけられなかった…');
      // reset targets
      knockables.forEach(k => { k.down=false; k.g.rotation.x=0; k.g.position.y=0; });
      knockedCount = 0;
      if (player.vehicle) exitVehicle();
    }
  }
  if (player.health <= 0){
    setHealth(100);
    failMission('ウメさん、腰を痛めた');
    player.pos.set(-88, 0, -62);
  }
}

// ============================== main loop ==============================
const clock = new THREE.Clock();
function loop(){
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), .05);
  const t = clock.elapsedTime;
  if (running){
    if (player.vehicle) driveVehicle(player.vehicle, dt); else moveOnFoot(dt);
    updateNPCs(dt, t);
    updateEffects(dt);
    updateSprays(dt);
    updateTriggers(dt);
    updateCamera(dt);
    drawMinimap();
    if (kairanban) kairanban.rotation.y = t;
    clouds.forEach((c,i)=>{ c.position.x += dt*(1+i*.1); if (c.position.x > 300) c.position.x = -300; });
  }
  renderer.render(scene, camera);
}
loop();

// start
el('startbtn').addEventListener('click', () => {
  audio();
  ui.title.style.display = 'none';
  running = true;
  if (!isTouch) canvas.requestPointerLock();
  startMission1();
  showToast('ようこそ、ウメさん。今日は回覧板の日だ。', 6);
});

// debug/verify handle
window.__gt = { player, tanaka, tane, vehicles, get mission(){ return mission; }, get missionPhase(){ return missionPhase; },
  doInteract, enterVehicle, useWeapon, calmTanaka, knockDown, knockables, get running(){ return running; } };
