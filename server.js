import express from 'express';
import {WebSocketServer} from 'ws';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
const app=express();app.use(express.static('public'));const server=createServer(app);const wss=new WebSocketServer({server});
const rooms=new Map();const BANK_START=19;const types=['wood','brick','wheat','sheep','ore'];
const terrain=['wood','wood','wood','wood','brick','brick','brick','wheat','wheat','wheat','wheat','sheep','sheep','sheep','sheep','ore','ore','ore','desert'];
const devTypes=['knight','roadbuilding','yearofplenty','monopoly','victory'];
const devDeck=()=>shuffle([...Array(14).fill('knight'),...Array(2).fill('roadbuilding'),...Array(2).fill('yearofplenty'),...Array(2).fill('monopoly'),...Array(5).fill('victory')]);
const nums=[5,2,6,3,8,10,9,12,11,4,8,10,9,4,5,6,3,11];
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function board(){let tiles=[],tt=shuffle(terrain),nn=shuffle(nums),n=0;for(let r=-2;r<=2;r++)for(let q=Math.max(-2,-r-2);q<=Math.min(2,-r+2);q++){let type=tt[tiles.length];tiles.push({q,r,type,num:type==='desert'?null:nn[n++]})}return tiles}
function graph(tiles){const verts=new Map(),edges=new Map();const centers=tiles.map(t=>({x:Math.sqrt(3)*(t.q+t.r/2),y:1.5*t.r}));let adj=[];
 tiles.forEach((t,i)=>{let vv=[];for(let k=0;k<6;k++){let a=Math.PI/180*(60*k-30),x=centers[i].x+Math.cos(a),y=centers[i].y+Math.sin(a),key=`${Math.round(x*1000)},${Math.round(y*1000)}`;if(!verts.has(key))verts.set(key,{id:verts.size,x,y,tiles:[]});let v=verts.get(key);v.tiles.push(i);vv.push(v.id)}adj.push(vv)});
 for(const vv of adj)for(let k=0;k<6;k++){let a=vv[k],b=vv[(k+1)%6],key=[a,b].sort((x,y)=>x-y).join('-');if(!edges.has(key))edges.set(key,{id:edges.size,a,b})}
 return {vertices:[...verts.values()],edges:[...edges.values()]}}
function newRoom(mode){const tiles=board(),g=graph(tiles);const coast=g.edges.filter(e=>g.vertices[e.a].tiles.length<3&&g.vertices[e.b].tiles.length<3);const harborTypes=shuffle(['any','any','any','any','wood','brick','wheat','sheep','ore']);const ports=[];for(let i=0;i<9;i++){let e=coast[Math.floor(i*coast.length/9)];ports.push({type:harborTypes[i],vertices:[e.a,e.b]})}return {ports,mode,capacity:mode==='duo'||mode==='classic2'?2:4,bank:Object.fromEntries(types.map(t=>[t,BANK_START])),tiles,...g,buildings:{},roads:{},players:[],turn:0,phase:'lobby',setupIndex:0,setupPlaced:false,roll:null,rolled:false,log:['Szoba létrehozva.'],winner:null,robber:tiles.findIndex(t=>t.type==='desert'),robberPhase:'',discardNeeded:{},lastSetupVertex:null,devDeck:devDeck(),largestArmy:null,longestRoad:null,freeRoads:0,pendingTrade:null}}
const code=()=>randomBytes(3).toString('hex').toUpperCase();
function send(ws,o){if(ws.readyState===1)ws.send(JSON.stringify(o))}
function broadcast(room){room.lastSeen=Date.now();let state=room.state;for(const p of state.players){let {devDeck:privateDeck,players:privatePlayers,...publicState}=state;let view={...publicState,players:state.players.map(x=>({id:x.id,name:x.name,resources:x.id===p.id?x.resources:null,resourceCount:Object.values(x.resources).reduce((a,b)=>a+b,0),connected:x.ws?.readyState===1,devCount:x.dev.length,dev:x.id===p.id?x.dev:undefined,knights:x.knights,score:(scores(state).find(z=>z.id===x.id)?.score||0)-(x.id===p.id?0:x.dev.filter(d=>d.type==='victory').length)})),you:p.id,code:room.code,token:p.token,devDeck:state.devDeck.length};send(p.ws,{type:'state',state:view})}}
function note(s,msg){s.log=[msg,...s.log].slice(0,14)}
function resources(){return Object.fromEntries(types.map(t=>[t,0]))}
function cost(p,req){return Object.entries(req).every(([t,n])=>p.resources[t]>=n)}
function pay(p,req,s){for(const [t,n] of Object.entries(req)){p.resources[t]-=n;if(s)s.bank[t]+=n}}
function bankGive(s,p,t,n=1){if(s.bank[t]<n)return false;s.bank[t]-=n;p.resources[t]+=n;return true}
function adjacent(s,v){return s.edges.filter(e=>e.a===v||e.b===v)}
function legalVillage(s,v,p,setup){if(s.buildings[v])return false;if(adjacent(s,v).some(e=>s.buildings[e.a]||s.buildings[e.b]))return false;return setup||adjacent(s,v).some(e=>s.roads[e.id]===p.id)}
function legalRoad(s,e,p,setup){let edge=s.edges[e];if(!edge||s.roads[edge.id]!==undefined)return false;if(setup)return s.buildings[edge.a]?.owner===p.id||s.buildings[edge.b]?.owner===p.id;return [edge.a,edge.b].some(v=>s.buildings[v]?.owner===p.id||(!s.buildings[v]&&adjacent(s,v).some(x=>s.roads[x.id]===p.id)))}
function total(p){return Object.values(p.resources).reduce((a,b)=>a+b,0)}
function scores(s){return s.players.map(p=>({id:p.id,score:Object.values(s.buildings).filter(b=>b.owner===p.id).reduce((a,b)=>a+b.level,0)+p.dev.filter(d=>d.type==='victory').length+(s.largestArmy===p.id?2:0)+(s.longestRoad===p.id?2:0)}))}
function updateArmy(s){let leader=s.players.find(p=>p.id===s.largestArmy),best=leader?.knights||2;for(const p of s.players)if(p.knights>=3&&p.knights>best){s.largestArmy=p.id;best=p.knights}}
function roadLength(s,id){
 const owned=s.edges.filter(e=>s.roads[e.id]===id), byV=new Map();
 for(const e of owned)for(const v of [e.a,e.b]){if(!byV.has(v))byV.set(v,[]);byV.get(v).push(e)}
 function walk(v,used){if(s.buildings[v]&&s.buildings[v].owner!==id&&used.size)return 0;
  let best=0;for(const e of byV.get(v)||[]){if(used.has(e.id))continue;const next=e.a===v?e.b:e.a;const newer=new Set(used);newer.add(e.id);best=Math.max(best,1+walk(next,newer))}return best}
 return Math.max(0,...[...byV.keys()].map(v=>walk(v,new Set())));
}
function updateLongest(s){const lengths=s.players.map(p=>roadLength(s,p.id));const high=Math.max(...lengths);if(high<5){s.longestRoad=null;return}
 const leaders=lengths.map((n,i)=>n===high?i:-1).filter(i=>i>=0);
 s.longestRoad=leaders.length===1?leaders[0]:(leaders.includes(s.longestRoad)?s.longestRoad:null);
}
function tradeRatio(s,p,give){const owned=Object.entries(s.buildings).filter(([,b])=>b.owner===p.id).map(([v])=>Number(v));
 const harbors=s.ports||[];return harbors.some(h=>owned.some(v=>h.vertices.includes(v))&&h.type===give)?2:harbors.some(h=>owned.some(v=>h.vertices.includes(v))&&h.type==='any')?3:4;
}
function win(s,p){if(scores(s).find(x=>x.id===p.id).score>=10){s.winner=p.id;note(s,p.name+' győzött!')}}
function action(room,p,msg){let s=room.state,idx=s.players.findIndex(x=>x.id===p.id);if(idx<0)return 'Nem vagy játékos.';if(s.winner!==null)return 'A játék véget ért.';
 if(msg.action==='start'){if(s.phase!=='lobby'||idx!==0||s.players.length<2||(s.mode==='classic'&&s.players.length<3))return 'A klasszikus 3–4 fős játékhoz legalább három játékos kell. Ketten válasszátok a klasszikus kétfős módot.';s.phase='setup';s.setupIndex=0;note(s,'Kezdő települések elhelyezése.');return}
 if(s.phase==='lobby')return 'Várj a játék indítására.';
 if(msg.action==='accepttrade'||msg.action==='rejecttrade'){let tr=s.pendingTrade;if(!tr||tr.to!==p.id||s.phase!=='play'||s.robberPhase||s.turn!==tr.from)return 'Nincs neked szóló ajánlat.';if(msg.action==='accepttrade'){let a=s.players[tr.from];if(!cost(a,tr.give)||!cost(p,tr.want)){s.pendingTrade=null;return 'Nincs elég lap a cseréhez.'}pay(a,tr.give);pay(p,tr.want);for(const [t,n] of Object.entries(tr.want))a.resources[t]+=n;for(const [t,n] of Object.entries(tr.give))p.resources[t]+=n;note(s,'A játékosok cseréltek.')}s.pendingTrade=null;return}
 if(msg.action==='offertrade'){if(s.phase!=='play'||idx!==s.turn||!s.rolled||s.robberPhase)return 'Most nem kereskedhetsz.';let to=Number(msg.to),give=msg.give||{},want=msg.want||{};if(to===idx||!s.players[to]||s.pendingTrade)return 'Érvénytelen ajánlat.';for(const r of [give,want])if(!Object.keys(r).length||Object.entries(r).some(([t,n])=>!types.includes(t)||!Number.isSafeInteger(n)||n<0)||Object.values(r).reduce((a,b)=>a+b,0)<1)return 'Érvénytelen lapmennyiség.';if(!cost(p,give))return 'Nincs elég felajánlott lap.';s.pendingTrade={from:idx,to,give,want};return}
 if(msg.action==='canceltrade'){if(s.pendingTrade?.from!==idx)return 'Nem a te ajánlatod.';s.pendingTrade=null;return}
 let order=[...s.players.map((_,i)=>i),...s.players.map((_,i)=>i).reverse()];let active=s.phase==='setup'?(order[s.setupIndex]??0):s.turn;
 if(idx!==active && !(s.robberPhase==='discard'&&msg.action==='discard'&&s.discardNeeded[p.id]>0))return 'Nem te következel.';
 if(s.phase==='setup'){
  if(msg.action==='village'&&!s.setupPlaced){let v=msg.id===null||msg.id===undefined?NaN:Number(msg.id);if(!Number.isInteger(v)||!s.vertices[v]||!legalVillage(s,v,p,true))return 'Ide nem építhetsz.';s.buildings[v]={owner:p.id,level:1};s.setupPlaced=true;s.lastSetupVertex=v;note(s,p.name+' kezdő települést épített.');if(s.setupIndex>=s.players.length)for(const t of s.vertices[v].tiles){let type=s.tiles[t].type;if(type!=='desert')bankGive(s,p,type)}return}
  if(msg.action==='road'&&s.setupPlaced){let e=msg.id===null||msg.id===undefined?NaN:Number(msg.id),edge=s.edges[e];if(!edge||!(edge.a===s.lastSetupVertex||edge.b===s.lastSetupVertex)||!legalRoad(s,e,p,true))return 'A kezdő út a most épített településhez csatlakozzon.';s.roads[e]=p.id;updateLongest(s);s.setupIndex++;s.setupPlaced=false;if(s.setupIndex===s.players.length*2){s.phase='play';s.turn=0;note(s,'Indul a játék!')}return}
  return 'Először települést, utána hozzá csatlakozó utat építs.';
 }
 if(s.robberPhase==='discard'){
  if(msg.action!=='discard')return 'Előbb minden érintett játékosnak el kell dobnia a lapjait.';
  let need=s.discardNeeded[p.id]||0, chosen=msg.resources||{};
  if(!need)return 'Neked nem kell lapot eldobnod.';
  if(Object.keys(chosen).some(t=>!types.includes(t)||!Number.isInteger(chosen[t])||chosen[t]<0)||Object.values(chosen).reduce((a,b)=>a+b,0)!==need||!cost(p,chosen))return 'Pontosan a szükséges számú lapot válaszd ki.';
  pay(p,chosen,s);delete s.discardNeeded[p.id];if(!Object.keys(s.discardNeeded).length)s.robberPhase='move';return;
 }
 if(s.robberPhase==='move'){
  if(msg.action!=='robber')return 'Előbb helyezd át a rablót.';
  let tile=Number(msg.id);if(!Number.isInteger(tile)||tile<0||tile>=s.tiles.length||tile===s.robber)return 'Másik mezőt válassz.';
  s.robber=tile;let victims=[...new Set(s.vertices.filter(v=>v.tiles.includes(tile)&&s.buildings[v.id]&&s.buildings[v.id].owner!==p.id).map(v=>s.buildings[v.id].owner))].filter(id=>total(s.players[id])>0);
  if(victims.length&& !victims.includes(Number(msg.victim)))return 'Válaszd ki, kitől veszel el egy véletlen lapot: '+victims.map(id=>id+': '+s.players[id].name).join(', ');
  if(victims.length){let victim=s.players[Number(msg.victim)],cards=types.flatMap(t=>Array(victim.resources[t]).fill(t)),type=cards[Math.floor(Math.random()*cards.length)];victim.resources[type]--;p.resources[type]++;note(s,p.name+' egy lapot szerzett a rablóval.')}s.robberPhase='';return;
 }
 if(s.pendingTrade)return 'Előbb zárjátok le a kereskedési ajánlatot.';
 if(msg.action==='buydev'){if(s.freeRoads)return 'Előbb helyezd le az ingyenes utakat.';if(!s.devDeck.length)return 'Elfogytak a fejlesztéskártyák.';if(!s.rolled)return 'Előbb dobj.';let req={wheat:1,sheep:1,ore:1};if(!cost(p,req))return 'Nincs elég nyersanyagod.';pay(p,req,s);let type=s.devDeck.pop();p.dev.push({type,turn:p.turnSerial});note(s,p.name+' fejlesztéskártyát vásárolt.');win(s,p);return}
 if(msg.action==='playdev'){if(s.freeRoads)return 'Előbb helyezd le az ingyenes utakat.';if(s.phase!=='play'||s.robberPhase)return 'Most nem használhatsz fejlesztéskártyát.';let type=msg.card,at=p.dev.findIndex(d=>d.type===type&&d.turn<p.turnSerial);if(at<0||type==='victory')return 'Ez a kártya most nem játszható ki.';if(type!=='knight'&&!s.rolled)return 'Előbb dobj.';if(p.devPlayed)return 'Körönként csak egy fejlesztéskártya játszható ki.';if(type==='roadbuilding'){s.freeRoads=2}else if(type==='yearofplenty'){let picks=msg.picks;if(!Array.isArray(picks)||picks.length!==2||picks.some(t=>!types.includes(t)))return 'Válassz két nyersanyagot.';if(types.some(t=>picks.filter(x=>x===t).length>s.bank[t]))return 'Nincs elegendő lap a bankban.';for(let t of picks)bankGive(s,p,t)}else if(type==='monopoly'){let t=msg.resource;if(!types.includes(t))return 'Válassz nyersanyagot.';for(let other of s.players)if(other!==p){p.resources[t]+=other.resources[t];other.resources[t]=0}}else if(type==='knight'){p.knights++;updateArmy(s);s.robberPhase='move'}p.dev.splice(at,1);p.devPlayed=true;note(s,p.name+' fejlesztéskártyát játszott ki.');win(s,p);return}
 if(msg.action==='roll'){if(s.freeRoads)return 'Előbb helyezd le az ingyenes utakat.';if(s.robberPhase)return 'Előbb fejezd be a rabló lépését.';if(s.rolled)return 'Már dobtál.';let n=1+Math.floor(Math.random()*6)+1+Math.floor(Math.random()*6);s.roll=n;s.rolled=true;note(s,p.name+' dobása: '+n);if(n===7){s.discardNeeded={};for(const x of s.players)if(total(x)>7)s.discardNeeded[x.id]=Math.floor(total(x)/2);s.robberPhase=Object.keys(s.discardNeeded).length?'discard':'move';note(s,'7-es dobás: rabló!');}else {let owed=Object.fromEntries(types.map(t=>[t,[]]));for(const [v,b] of Object.entries(s.buildings))for(const i of s.vertices[Number(v)].tiles){let tile=s.tiles[i];if(tile.num===n&&tile.type!=='desert'&&i!==s.robber)owed[tile.type].push([s.players.find(x=>x.id===b.owner),b.level])}for(const t of types){let due=owed[t].reduce((a,x)=>a+x[1],0);if(due>s.bank[t]){if(due)note(s,'A bankból elfogyott: '+t);continue}for(const [receiver,amount] of owed[t])bankGive(s,receiver,t,amount)}}return}
 if(!s.rolled)return 'Előbb dobj a kockával.';
 if(msg.action==='village'){let v=msg.id===null||msg.id===undefined?NaN:Number(msg.id),req={wood:1,brick:1,wheat:1,sheep:1};if(!s.vertices[v]||Object.values(s.buildings).filter(b=>b.owner===p.id&&b.level===1).length>=5||!legalVillage(s,v,p,false)||!cost(p,req))return 'Nem építhető település: út, távolság vagy nyersanyag hiányzik.';pay(p,req,s);s.buildings[v]={owner:p.id,level:1};note(s,p.name+' települést épített.')}
 else if(msg.action==='road'){let e=msg.id===null||msg.id===undefined?NaN:Number(msg.id),req={wood:1,brick:1};if(Object.values(s.roads).filter(owner=>owner===p.id).length>=15||!legalRoad(s,e,p,false)||(!s.freeRoads&&!cost(p,req)))return 'Nem építhető út.';if(s.freeRoads)s.freeRoads--;else pay(p,req,s);s.roads[e]=p.id;note(s,p.name+' utat épített.')}
 else if(msg.action==='city'){let v=msg.id===null||msg.id===undefined?NaN:Number(msg.id),b=s.buildings[v],req={wheat:2,ore:3};if(!b||b.owner!==p.id||b.level!==1||Object.values(s.buildings).filter(x=>x.owner===p.id&&x.level===2).length>=4||!cost(p,req))return 'Nem fejleszthető várossá.';pay(p,req,s);b.level=2;note(s,p.name+' várost épített.')}
 else if(msg.action==='trade'){let give=msg.give,get=msg.get;if(!types.includes(give)||!types.includes(get)||give===get||p.resources[give]<tradeRatio(s,p,give))return 'Nincs elég lap a kikötői/banki cseréhez.';if(s.bank[get]<1)return 'A kért nyersanyag elfogyott a bankból.';let ratio=tradeRatio(s,p,give);p.resources[give]-=ratio;s.bank[give]+=ratio;bankGive(s,p,get);note(s,p.name+' bankkal kereskedett.')}
 else if(msg.action==='end'){if(s.freeRoads){s.freeRoads=0;note(s,'Fel nem használt ingyenes utak elvesztek.')}s.turn=(s.turn+1)%s.players.length;s.rolled=false;s.roll=null;s.freeRoads=0;s.players[s.turn].turnSerial++;s.players[s.turn].devPlayed=false;note(s,'Következő játékos: '+s.players[s.turn].name)}
 else return 'Ismeretlen lépés.';
 updateLongest(s);win(s,p);return
}
wss.on('connection',ws=>{let room=null,player=null;ws.on('message',raw=>{try{let msg=JSON.parse(raw);if(msg.type==='join'){if(room)return send(ws,{type:'error',message:'Már csatlakoztál egy szobához.'});let c=String(msg.code||'').trim().toUpperCase();if(c&&!/^[A-F0-9]{6}$/.test(c))return send(ws,{type:'error',message:'Hibás szobakód.'});if(!c){c=code();while(rooms.has(c))c=code();room={code:c,state:newRoom(['duo','classic2'].includes(msg.mode)?msg.mode:'classic')};rooms.set(c,room)}else room=rooms.get(c);if(!room)return send(ws,{type:'error',message:'Nincs ilyen szoba.'});let s=room.state;let returning=s.players.find(x=>x.token===msg.token&&typeof msg.token==='string'&&msg.token.length>=24);if(returning){if(returning.ws&&returning.ws!==ws&&returning.ws.readyState===1)return send(ws,{type:'error',message:'Ez a játékos már csatlakozott.'});player=returning;player.ws=ws;note(s,player.name+' visszacsatlakozott.');broadcast(room);return}if(s.phase!=='lobby'||s.players.length>=s.capacity)return send(ws,{type:'error',message:'A szoba már elindult vagy megtelt.'});player={id:s.players.length,name:String(msg.name||'Játékos').slice(0,24),resources:resources(),dev:[],knights:0,turnSerial:0,devPlayed:false,ws,token:randomBytes(24).toString('hex')};s.players.push(player);note(s,player.name+' csatlakozott.');broadcast(room)}else if(msg.type==='action'&&room&&player){let error=action(room,player,msg);if(error)send(ws,{type:'error',message:error});else broadcast(room)}}catch(e){send(ws,{type:'error',message:'Hibás kérés.'})}});ws.on('close',()=>{if(room&&player&&player.ws===ws){player.ws=null;note(room.state,player.name+' megszakította a kapcsolatot.');broadcast(room)}})});
setInterval(()=>{for(const [c,r] of rooms){if((r.state.players.length===0&&Date.now()-(r.lastSeen||0)>60*60*1000) || (r.state.players.every(p=>!p.ws||p.ws.readyState!==1)&&Date.now()-(r.lastSeen||0)>24*60*60*1000))rooms.delete(c)}},60*60*1000).unref();
const port=Number(process.env.PORT||3000);server.listen(port,()=>console.log('Szigetjáték: http://localhost:'+port));
