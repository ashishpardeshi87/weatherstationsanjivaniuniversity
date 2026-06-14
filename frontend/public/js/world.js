// A single living 3D world: gradient day/night sky, rolling terrain with
// instanced grass and trees, a distant city skyline that lights up at night,
// the Blender frog as the anchor, weather particles, bloom, and a slow
// cinematic camera. Day/night is synced to live IST time.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const C = (h) => new THREE.Color(h);

function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const x = 60 + Math.random() * 136, y = 70 + Math.random() * 110, r = 40 + Math.random() * 60;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture(col = 'rgba(255,240,200,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function windowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#0a0d12'; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) for (let x = 8; x < 56; x += 14) {
    g.fillStyle = Math.random() > 0.4 ? '#ffd98a' : '#1b2230';
    g.fillRect(x, y, 8, 9);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function terrainHeight(x, z) {
  let h = Math.sin(x * 0.18) * Math.cos(z * 0.16) * 1.6 +
    Math.sin(x * 0.07 + z * 0.11) * 1.1 + Math.cos(x * 0.31 - z * 0.05) * 0.5;
  const d = Math.sqrt(x * x + z * z);
  return h * clamp((d - 4) / 8, 0, 1);
}

const PALETTES = {
  sunny:        { top:'#1f7fd6', hor:'#bfe6ff', sun:'#fff3c8', fog:'#cfe9ff' },
  partly:       { top:'#3a86c8', hor:'#cfe6f2', sun:'#fff0c4', fog:'#cfe2ec' },
  cloudy:       { top:'#7d8a99', hor:'#c3ccd4', sun:'#e8e8e0', fog:'#c0c8cf' },
  rain:         { top:'#46505c', hor:'#8b97a3', sun:'#cfd4d8', fog:'#7d8893' },
  storm:        { top:'#222831', hor:'#525c68', sun:'#aeb4ba', fog:'#444c57' },
  'clear-night':{ top:'#05071c', hor:'#1a2348', sun:'#dfe6ff', fog:'#0e1430' },
  'cloudy-night':{top:'#0a0e1c', hor:'#222a3e', sun:'#cdd4e6', fog:'#161c2a' },
};

export function createWorld(canvas, hooks = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { hooks.onError && hooks.onError(e); return { applyCondition() {} }; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(C('#cfe9ff'), 26, 110);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 600);
  camera.position.set(0.5, 2.2, 7);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // sky dome
  const skyU = { top: { value: C('#1f7fd6') }, hor: { value: C('#bfe6ff') } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 hor; void main(){float h=clamp((normalize(vP).y*0.6)+0.22,0.0,1.0); gl_FragColor=vec4(mix(hor,top,pow(h,0.7)),1.0);}',
  }));
  scene.add(sky);

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a4048, 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3c8, 2.4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -22; sun.shadow.camera.right = 22; sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
  sun.shadow.bias = -0.0004; scene.add(sun);
  const flashLight = new THREE.PointLight(0xffffff, 0, 140); flashLight.position.set(0, 36, -10); scene.add(flashLight);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfff3c8, fog: false }));
  const orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, fog: false }));
  orbGlow.scale.set(34, 34, 1); orb.add(orbGlow); scene.add(orb);

  const ctx = { THREE, renderer, scene, camera, hemi, sun, orb, orbGlow, flashLight, skyU,
    pmrem, lerp, clamp, smooth, C, terrainHeight, PALETTES, blobTexture, glowTexture, windowTexture,
    EffectComposer, RenderPass, UnrealBloomPass, OutputPass, GLTFLoader, hooks };
  return buildWorld(ctx);
}

function buildWorld(ctx) {
  const { THREE, renderer, scene, camera, hemi, sun, orb, orbGlow, flashLight, skyU,
    lerp, clamp, smooth, C, terrainHeight, PALETTES, blobTexture, glowTexture, windowTexture,
    EffectComposer, RenderPass, UnrealBloomPass, OutputPass, GLTFLoader, hooks } = ctx;
  const canvas = renderer.domElement;

  // ---- terrain ---------------------------------------------------------
  const SIZE = 160, SEG = 160;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position, cols = [];
  const cValley=C('#4f7a44'), cLow=C('#74b257'), cHigh=C('#cabf86');
  for (let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i), y=terrainHeight(x,z); pos.setY(i,y);
    const t=clamp(y/3.2,0,1); const col=cValley.clone().lerp(cLow,clamp(t*2,0,1)).lerp(cHigh,clamp((t-0.5)*2,0,1));
    cols.push(col.r,col.g,col.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols,3)); geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:1 }));
  land.receiveShadow = true; scene.add(land);

  // ---- instanced grass (short, dense field near the frog) --------------
  const blade = new THREE.ConeGeometry(0.035, 0.22, 5); blade.translate(0,0.11,0);
  const GC = 7000;
  const grass = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color:0x6bb24f, roughness:1 }), GC);
  const dummy = new THREE.Object3D();
  for (let i=0;i<GC;i++){ const a=Math.random()*Math.PI*2, r=1.5+Math.pow(Math.random(),0.7)*15; const x=Math.cos(a)*r, z=Math.sin(a)*r;
    dummy.position.set(x, terrainHeight(x,z), z); dummy.rotation.set((Math.random()-0.5)*0.3, Math.random()*Math.PI, (Math.random()-0.5)*0.3);
    const s=0.7+Math.random()*0.7; dummy.scale.set(s, 0.7+Math.random()*0.8, s);
    dummy.updateMatrix(); grass.setMatrixAt(i,dummy.matrix);
    grass.setColorAt(i, C('#4f9a3e').lerp(C('#8fd066'), Math.random())); }
  grass.castShadow=false; grass.receiveShadow=true; scene.add(grass);

  // ---- trees -----------------------------------------------------------
  const trunkMat=new THREE.MeshStandardMaterial({color:0x6b4a2b,roughness:1});
  const leafMat=new THREE.MeshStandardMaterial({color:0x3f8f46,roughness:1,flatShading:true});
  for (let i=0;i<16;i++){
    const a=Math.random()*Math.PI*2, r=8+Math.random()*16; const x=Math.cos(a)*r, z=Math.sin(a)*r; const gy=terrainHeight(x,z);
    const g=new THREE.Group();
    const tk=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.22,1.4,7), trunkMat); tk.position.y=0.7; tk.castShadow=true; g.add(tk);
    for (let j=0;j<3;j++){ const cone=new THREE.Mesh(new THREE.ConeGeometry(1.1-j*0.25,1.3,8), leafMat); cone.position.y=1.4+j*0.7; cone.castShadow=true; g.add(cone); }
    g.position.set(x,gy,z); const s=0.7+Math.random()*0.8; g.scale.setScalar(s); scene.add(g);
  }

  // ---- distant city skyline -------------------------------------------
  const cityMat = new THREE.MeshStandardMaterial({ color:0x2b313b, roughness:0.85, metalness:0.1, emissive:0xffd98a, emissiveMap:windowTexture(), emissiveIntensity:0 });
  const city = new THREE.Group();
  for (let i=0;i<64;i++){
    const w=2+Math.random()*3, h=5+Math.random()*22, d=2+Math.random()*3;
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), cityMat);
    const ang=(i/64)*Math.PI*2; const rad=80+Math.random()*40;
    b.position.set(Math.cos(ang)*rad, h/2-2, Math.sin(ang)*rad - 10);
    if (b.position.z > -30) b.position.z -= 70; // keep them in the distance/back
    city.add(b);
  }
  scene.add(city);
  ctx.cityMat = cityMat;

  // ---- clouds ----------------------------------------------------------
  const cloudTex = blobTexture(); const clouds = new THREE.Group(); scene.add(clouds);
  for (let i=0;i<16;i++){ const m=new THREE.SpriteMaterial({map:cloudTex,transparent:true,opacity:0,depthWrite:false});
    const s=new THREE.Sprite(m); const sc=12+Math.random()*22; s.scale.set(sc,sc*0.6,1);
    s.position.set((Math.random()-0.5)*160, 22+Math.random()*22, -30-Math.random()*70);
    s.userData={speed:0.4+Math.random()*0.9}; clouds.add(s); }

  // ---- rain / stars / fireflies / birds --------------------------------
  const RN=3000, rGeo=new THREE.BufferGeometry(), rPos=new Float32Array(RN*3);
  for(let i=0;i<RN;i++){rPos[i*3]=(Math.random()-0.5)*48;rPos[i*3+1]=Math.random()*40;rPos[i*3+2]=(Math.random()-0.5)*48;}
  rGeo.setAttribute('position',new THREE.BufferAttribute(rPos,3));
  const rain=new THREE.Points(rGeo,new THREE.PointsMaterial({color:0xbfe0ff,size:0.16,transparent:true,opacity:0,depthWrite:false})); rain.frustumCulled=false; scene.add(rain);

  const SN=1000, sGeo=new THREE.BufferGeometry(), sPos=new Float32Array(SN*3);
  for(let i=0;i<SN;i++){const r=200,th=Math.random()*Math.PI*2,ph=Math.acos(Math.random());sPos[i*3]=r*Math.sin(ph)*Math.cos(th);sPos[i*3+1]=Math.abs(r*Math.cos(ph))+12;sPos[i*3+2]=r*Math.sin(ph)*Math.sin(th);}
  sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
  const stars=new THREE.Points(sGeo,new THREE.PointsMaterial({color:0xffffff,size:1.2,map:glowTexture('rgba(255,255,255,1)'),transparent:true,opacity:0,depthWrite:false})); stars.frustumCulled=false; scene.add(stars);

  const FN=70, fGeo=new THREE.BufferGeometry(), fPos=new Float32Array(FN*3), fPh=[];
  for(let i=0;i<FN;i++){fPos[i*3]=(Math.random()-0.5)*26;fPos[i*3+1]=0.6+Math.random()*3.5;fPos[i*3+2]=(Math.random()-0.5)*26;fPh.push(Math.random()*7);}
  fGeo.setAttribute('position',new THREE.BufferAttribute(fPos,3));
  const fly=new THREE.Points(fGeo,new THREE.PointsMaterial({color:0xffe98a,size:0.55,map:glowTexture('rgba(255,235,140,1)'),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})); fly.frustumCulled=false; scene.add(fly);

  const birdTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.strokeStyle='rgba(30,40,50,0.9)';g.lineWidth=5;g.lineCap='round';g.beginPath();g.moveTo(8,40);g.quadraticCurveTo(32,18,32,30);g.quadraticCurveTo(32,18,56,40);g.stroke();return new THREE.CanvasTexture(c);})();
  const birds=new THREE.Group(); scene.add(birds);
  for(let i=0;i<6;i++){const b=new THREE.Sprite(new THREE.SpriteMaterial({map:birdTex,transparent:true,opacity:0,depthWrite:false}));b.scale.set(2.4,2.4,1);b.userData={r:16+Math.random()*18,h:14+Math.random()*8,sp:0.05+Math.random()*0.05,off:Math.random()*7};birds.add(b);}

  // ---- frog (anchor, framed left) -------------------------------------
  const frogRoot=new THREE.Group(); scene.add(frogRoot);
  new GLTFLoader().load('/models/frog_scene.glb',(gltf)=>{
    const m=gltf.scene; m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
      if(o.material){ o.material.envMapIntensity=0.35; if('emissive' in o.material) o.material.emissive=new THREE.Color(0x000000); }}});
    const box=new THREE.Box3().setFromObject(m); const c=box.getCenter(new THREE.Vector3());
    m.position.x-=c.x; m.position.z-=c.z; m.position.y-=box.min.y; frogRoot.add(m); frogRoot.scale.setScalar(1.45);
  },undefined,(e)=>{hooks.onError&&hooks.onError(e);});

  // ---- bloom -----------------------------------------------------------
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),0.32,0.4,0.9);
  composer.addPass(bloom); composer.addPass(new OutputPass());

  // ---- weather targets -------------------------------------------------
  const T={top:C('#1f7fd6'),hor:C('#bfe6ff'),fog:C('#cfe9ff'),sunCol:C('#fff3c8'),
    rain:0,stars:0,fly:0,cloudN:3,birds:1,sunI:2.4,hemi:0.6,exposure:1.05,
    sunPos:new THREE.Vector3(30,40,-12),cityGlow:0,bloom:0.55};
  let stormOn=false,stormT=0,windF=0.35,isDay=true,condKey='sunny';

  function applyCondition(cond){
    const p=PALETTES[cond.key]||PALETTES.sunny; condKey=cond.key;
    T.top.set(p.top);T.hor.set(p.hor);T.fog.set(p.fog);T.sunCol.set(p.sun);
    isDay=cond.isDay; windF=cond.isWindy?1.5:0.35; const elev=Math.max(0.05,cond.sun);
    T.rain=cond.isRaining?(cond.isStormy?1:0.7):0;
    T.stars=cond.isDay?0:0.95;
    T.fly=(!cond.isDay&&cond.key==='clear-night')?0.9:0;
    T.cloudN={sunny:3,partly:6,cloudy:12,rain:14,storm:16,'clear-night':1,'cloudy-night':10}[cond.key]??4;
    T.birds=(cond.isDay&&!cond.isRaining)?1:0;
    T.sunI=cond.isDay?(cond.isRaining||cond.key==='cloudy'?1.1:1.6+elev*1.3):0.55;
    T.hemi=cond.isDay?0.42+elev*0.42:0.26;
    T.exposure=cond.isDay?1.0+elev*0.12:0.85;
    T.cityGlow=cond.isDay?0:1.3;
    T.bloom=cond.isDay?0.28:0.4;
    const az=(cond.sun-0.5)*Math.PI*0.95;
    T.sunPos.set(Math.sin(az)*48, cond.isDay?6+elev*46:-12, -22+Math.cos(az)*10);
    stormOn=cond.isStormy; document.body.dataset.cond=cond.key;
  }

  // ---- resize ----------------------------------------------------------
  function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;
    renderer.setSize(w,h,false); composer.setSize(w,h); bloom.setSize(w,h);
    camera.aspect=w/h; camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(canvas); addEventListener('resize',resize); resize();

  // ---- steady hero framing; only the data/caption rotate every 10s -----
  const FRAME = { pos: new THREE.Vector3(1.0, 1.85, 6.4), look: new THREE.Vector3(1.7, 1.0, 0) };
  camera.fov = 44; camera.position.copy(FRAME.pos); camera.lookAt(FRAME.look); camera.updateProjectionMatrix();
  const SCENES = [
    { metric:'temperature',       caption:'temperature' },
    { metric:'humidity',          caption:'humidity' },
    { metric:'wind_speed',        caption:'wind' },
    { metric:'pressure',          caption:'pressure' },
    { metric:'solar_irradiation', caption:'solar' },
    { metric:'rain_in_last_day',  caption:'rain' },
  ];
  const HOLD = 10000;
  let sIdx = 0, sStart = performance.now();
  if (hooks.onScene) hooks.onScene(SCENES[0]);
  function nextScene(now){ sIdx=(sIdx+1)%SCENES.length; sStart=now; hooks.onScene && hooks.onScene(SCENES[sIdx]); }

  // ---- loop ------------------------------------------------------------
  const clock=new THREE.Clock(); const look=new THREE.Vector3();
  function tick(){
    const dt=Math.min(clock.getDelta(),0.05), t=clock.elapsedTime, k=1-Math.pow(0.0016,dt);

    // steady framing with the gentlest drift; data rotates every 10s
    const now=performance.now();
    if (now - sStart > HOLD) nextScene(now);
    camera.position.set(
      FRAME.pos.x + Math.sin(t*0.13)*0.10,
      FRAME.pos.y + Math.sin(t*0.10)*0.06,
      FRAME.pos.z + Math.cos(t*0.09)*0.08
    );
    look.copy(FRAME.look); look.x += Math.sin(t*0.11)*0.03;
    camera.lookAt(look);

    skyU.top.value.lerp(T.top,k); skyU.hor.value.lerp(T.hor,k); scene.fog.color.lerp(T.fog,k);
    sun.color.lerp(T.sunCol,k); sun.intensity=lerp(sun.intensity,T.sunI,k); sun.position.lerp(T.sunPos,k);
    hemi.intensity=lerp(hemi.intensity,T.hemi,k); renderer.toneMappingExposure=lerp(renderer.toneMappingExposure,T.exposure,k);
    orb.position.copy(sun.position).multiplyScalar(2.4); orb.material.color.lerp(T.sunCol,k); orbGlow.material.opacity=lerp(orbGlow.material.opacity,isDay?0.9:0.5,k);
    ctx.cityMat.emissiveIntensity=lerp(ctx.cityMat.emissiveIntensity,T.cityGlow,k);
    bloom.strength=lerp(bloom.strength,T.bloom,k);

    rain.material.opacity=lerp(rain.material.opacity,T.rain,k);
    if(rain.material.opacity>0.02){const A=rGeo.attributes.position.array;for(let i=0;i<RN;i++){A[i*3+1]-=(24+T.rain*16)*dt;if(A[i*3+1]<0){A[i*3+1]=34+Math.random()*6;A[i*3]=camera.position.x+(Math.random()-0.5)*48;A[i*3+2]=camera.position.z+(Math.random()-0.5)*48;}}rGeo.attributes.position.needsUpdate=true;}
    stars.material.opacity=lerp(stars.material.opacity,T.stars,k); stars.rotation.y=t*0.004;
    fly.material.opacity=lerp(fly.material.opacity,T.fly,k);
    if(fly.material.opacity>0.02){const A=fGeo.attributes.position.array;for(let i=0;i<FN;i++){A[i*3+1]+=Math.sin(t*1.5+fPh[i])*0.004;}fGeo.attributes.position.needsUpdate=true;}

    clouds.children.forEach((s,i)=>{s.position.x+=s.userData.speed*(1+windF)*dt*2;if(s.position.x>90)s.position.x=-90;
      const show=i<T.cloudN; s.material.opacity=lerp(s.material.opacity,show?(stormOn?0.92:0.82):0,k);
      s.material.color.lerp((stormOn||condKey==='rain')?C('#9aa3ad'):C('#ffffff'),k);});
    birds.children.forEach(b=>{const u=b.userData,ang=t*u.sp+u.off;b.position.set(Math.cos(ang)*u.r,u.h+Math.sin(ang*2)*1.2,-12+Math.sin(ang)*u.r);b.material.opacity=lerp(b.material.opacity,T.birds,k*0.5);});

    frogRoot.rotation.y=Math.sin(t*0.3)*0.12; frogRoot.position.y=Math.sin(t*1.1)*0.02;

    if(stormOn){stormT-=dt;if(stormT<=0){stormT=2.5+Math.random()*5;doFlash();}}

    composer.render();
    requestAnimationFrame(tick);
  }
  function doFlash(){let i=0;const seq=[1,0,0.7,0];const el=document.getElementById('flash');
    const step=()=>{const v=seq[i]||0;flashLight.intensity=v*45;if(el)el.style.opacity=String(v*0.6);i++;if(i<=seq.length)setTimeout(step,70);else{flashLight.intensity=0;if(el)el.style.opacity='0';}};step();}
  requestAnimationFrame(tick);

  return { applyCondition };
}
