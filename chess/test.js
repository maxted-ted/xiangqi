/* 小棋士．西洋棋 引擎測試：node chess/test.js
   直接從 index.html 取出 <script id="engine"> 執行，確保測到的就是遊戲裡的那一份引擎。 */
const fs=require('fs'), path=require('path'), vm=require('vm');

const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const src=html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const sandbox={module:{exports:{}},performance:{now:()=>Number(process.hrtime.bigint()/1000000n)}};
vm.runInNewContext(src,sandbox);
const E=sandbox.module.exports;

let pass=0, fail=0;
function ok(cond,name,extra){
  if(cond){ pass++; console.log('  ✔ '+name+(extra?'  '+extra:'')); }
  else { fail++; console.log('  ✘ '+name+(extra?'  '+extra:'')); }
}
function section(t){ console.log('\n'+t); }
function play(sans){                    // 從起始局面照 SAN 走棋，回傳每步的 SAN（引擎重新產生）
  E.setupInitial(); const out=[];
  for(const s of sans){
    const m=E.sanToMove(s);
    if(!m) throw new Error('illegal move in test: '+s);
    out.push(E.moveToSAN(m)); E.make(m);
  }
  return out;
}
const sans=()=>{ const l=E.legalMoves(); return l.map(m=>E.moveToSAN(m,l)); };

/* ---------- perft ---------- */
section('perft：起始局面');
E.setupInitial();
[[1,20],[2,400],[3,8902],[4,197281]].forEach(([d,n])=>{
  const t=Date.now(), got=E.perft(d);
  ok(got===n,`depth ${d} = ${n}`,`(got ${got}, ${Date.now()-t} ms)`);
});

const PERFT=[
  ['Kiwipete（易位、過路兵、升變混合）','r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',[48,2039,97862]],
  ['Position 3（過路兵牽制）','8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',[14,191,2812,43238]],
  ['Position 4（升變、易位權）','r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',[6,264,9467,422333]],
  ['Position 5','rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',[44,1486,62379]],
];
for(const [name,fen,counts] of PERFT){
  section('perft：'+name);
  E.loadFEN(fen);
  counts.forEach((n,i)=>{ const got=E.perft(i+1); ok(got===n,`depth ${i+1} = ${n}`,`(got ${got})`); });
  ok(E.toFEN().split(' ').slice(0,4).join(' ')===fen.split(' ').slice(0,4).join(' '),'perft 後局面完全還原');
}

/* ---------- 王車易位 ---------- */
section('王車易位');
E.loadFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
ok(sans().includes('O-O') && sans().includes('O-O-O'),'白方可短易位與長易位');
let m=E.sanToMove('O-O'); E.make(m);
ok(E.toFEN().startsWith('r3k2r/8/8/8/8/8/8/R4RK1 b kq'),'O-O 後國王在 g1、城堡在f1、白方失去易位權',E.toFEN());
E.unmake();
m=E.sanToMove('O-O-O'); E.make(m);
ok(E.toFEN().startsWith('r3k2r/8/8/8/8/8/8/2KR3R b kq'),'O-O-O 後國王在 c1、城堡在 d1',E.toFEN());
ok(sans().includes('O-O') && !sans().includes('O-O-O'),'黑方仍可短易位；長易位會經過被 d1 城堡攻擊的 d8，所以不行');
E.unmake();
E.loadFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
E.make(E.sanToMove('Ke2')); E.make(E.sanToMove('Ke7')); E.make(E.sanToMove('Ke1')); E.make(E.sanToMove('Ke8'));
ok(!sans().some(s=>s.startsWith('O-O')),'國王動過之後就不能易位（即使回到原位）');
E.loadFEN('r3k2r/8/8/8/8/8/6B1/4K3 w kq - 0 1');
E.make(E.sanToMove('Bxa8'));
ok(!sans().includes('O-O-O') && sans().includes('O-O'),'a8 城堡被吃掉後黑方失去長易位權');
E.loadFEN('4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1');
ok(!sans().some(s=>s.startsWith('O-O')),'被將軍時不能易位');
E.loadFEN('4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1');
ok(!sans().includes('O-O') && sans().includes('O-O-O'),'經過的 f1 被攻擊時不能短易位');
E.loadFEN('4k3/8/8/8/8/8/8/Rn2K2R w KQ - 0 1');
ok(!sans().includes('O-O-O'),'b1 有棋子擋住時不能長易位');
E.loadFEN('1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
ok(sans().includes('O-O-O'),'b1 被攻擊時仍可長易位（國王不經過 b1）');

/* ---------- 吃過路兵 ---------- */
section('吃過路兵');
play(['e4','a6','e5','d5']);
let l=sans();
ok(l.includes('exd6'),'e5 兵可以吃過路兵 exd6');
E.make(E.sanToMove('exd6'));
ok(E.toFEN().startsWith('rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR b'),'d5 的黑兵被移除、白兵到 d6',E.toFEN());
E.unmake(); E.unmake();
ok(E.toFEN().split(' ')[0]==='rnbqkbnr/1ppppppp/p7/4P3/8/8/PPPP1PPP/RNBQKBNR','還原吃過路兵後，被吃的兵回到 d5 之前的局面',E.toFEN());
play(['e4','a6','e5','d5','Nf3','Nf6']);
ok(!sans().includes('exd6'),'沒有立刻吃，下一回合就不能吃過路兵');
E.loadFEN('8/8/8/K2pP2r/8/8/8/7k w - d6 0 1');
ok(!sans().includes('exd6'),'吃過路兵後會讓國王被將軍時不能吃（橫向牽制）');

/* ---------- 兵升變 ---------- */
section('兵升變');
E.loadFEN('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1');
l=sans();
ok(['b8=Q+','b8=R+','b8=B','b8=N'].every(s=>l.includes(s)),'產生 4 種升變，並正確標示將軍',l.filter(s=>s.startsWith('b8')).join(' '));
E.make(E.sanToMove('b8=N'));
ok(E.toFEN().startsWith('1N2k3/'),'升變成騎士後棋盤上是騎士');
E.unmake();
ok(E.toFEN().startsWith('4k3/1P6/'),'悔棋後還原成兵');
E.loadFEN('3rk3/4P3/8/8/8/8/8/4K3 w - - 0 1');
ok(sans().includes('exd8=Q+'),'吃子升變記作 exd8=Q+');
E.loadFEN('4k3/8/8/8/8/8/p7/4K3 b - - 0 1');
ok(sans().includes('a1=Q+'),'黑兵升變 a1=Q+');

/* ---------- 將軍、將死、逼和 ---------- */
section('將軍、將死、逼和');
let out=play(['f3','e5','g4','Qh4#']);
ok(out[3]==='Qh4#','愚人將死記作 Qh4#');
ok(E.legalMoves().length===0 && E.inCheck(E.state().stm),'白方被將死：無合法走法且被將軍');
out=play(['e4','e5','Bc4','Nc6','Qh5','Nf6','Qxf7#']);
ok(out[6]==='Qxf7#','學者將死 Qxf7#');
E.loadFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
ok(E.legalMoves().length===0 && !E.inCheck(1),'逼和：黑方沒有棋可走且未被將軍');
E.loadFEN('k7/8/1Q6/8/8/8/8/7K b - - 0 1');
ok(E.legalMoves().length===0 && !E.inCheck(1),'逼和：角落國王被皇后困住');
out=play(['e4','e5','Qh5','Nc6','Bc4','Nf6']);
ok(out[0]==='e4' && out[4]==='Bc4','一般走法記譜');
E.loadFEN('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
ok(sans().includes('Ra8+'),'將軍記作 +');
E.loadFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
ok(sans().includes('Ra8#'),'底線將死記作 #');

/* ---------- SAN 消除歧義 ---------- */
section('SAN 消除歧義');
E.loadFEN('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1');
l=sans(); ok(l.includes('Nbd2') && l.includes('Nfd2'),'同一橫列兩個騎士：Nbd2 / Nfd2');
E.loadFEN('4k3/8/8/R7/8/8/8/R3K3 w - - 0 1');
l=sans(); ok(l.includes('R1a3') && l.includes('R5a3'),'同一直線兩個城堡：R1a3 / R5a3');
E.loadFEN('4k3/8/8/8/Q6Q/8/8/Q3K3 w - - 0 1');
l=sans(); ok(l.includes('Qa4d4') && l.includes('Qhd4+') && l.includes('Q1d4+'),'三個皇后走到 d4：Qa4d4 / Qhd4+ / Q1d4+');

/* ---------- 和棋規則 ---------- */
section('和棋規則');
E.loadFEN('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');
E.make(E.sanToMove('Rb1'));
ok(E.state().half===100,'50 步規則：半回合計數到 100');
E.make(E.sanToMove('Kd7'));
ok(E.state().half===101,'計數持續累加');
E.loadFEN('4k3/8/8/8/8/8/4P3/R3K3 w - - 99 80'); E.make(E.sanToMove('e4'));
ok(E.state().half===0,'動兵會重置 50 步計數');

E.setupInitial();
const keys=[E.posKey()];
for(const s of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']){ E.make(E.sanToMove(s)); keys.push(E.posKey()); }
const last=keys[keys.length-1];
ok(keys.filter(k=>k===last).length===3,'三次重複：起始局面出現第三次');

E.setupInitial(); const k0=E.posKey();
E.make(E.sanToMove('e4'));
ok(E.state().ep===-1,'沒有對方兵在旁邊時不記錄過路兵格（重複局面才判斷得準）');
E.setupInitial();
for(const s of ['Nf3','Nf6','Ng1','Ng8']) E.make(E.sanToMove(s));
ok(E.posKey()===k0,'馬跳出去再跳回來 → 同一局面');

E.loadFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1'); ok(E.insufficientMaterial(),'王對王：子力不足');
E.loadFEN('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1'); ok(E.insufficientMaterial(),'王＋主教對王：子力不足');
E.loadFEN('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1'); ok(E.insufficientMaterial(),'王＋騎士對王：子力不足');
E.loadFEN('1b2k3/8/8/8/8/8/8/2B1K3 w - - 0 1'); ok(E.insufficientMaterial(),'雙方主教同色格：子力不足');
E.loadFEN('2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1'); ok(!E.insufficientMaterial(),'主教不同色格：還有機會將死');
E.loadFEN('4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1'); ok(!E.insufficientMaterial(),'兩個騎士：不判定子力不足');
E.loadFEN('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'); ok(!E.insufficientMaterial(),'有兵：不判定子力不足');
E.loadFEN('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'); ok(!E.insufficientMaterial(),'有城堡：不判定子力不足');

/* ---------- AI ---------- */
section('AI 搜尋');
E.loadFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
let r=E.searchBest(4,2000,0);
ok(E.moveToSAN(r.mv)==='Ra8#','找到一步將死 Ra8#',`(depth ${r.depth}, ${r.nodes} nodes)`);
E.loadFEN('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
r=E.searchBest(4,2000,0);
ok(E.moveToSAN(r.mv)==='Qxf7#','學者將死局面找到 Qxf7#');
E.loadFEN('4k3/8/8/8/8/8/3q4/4K3 w - - 0 1');
r=E.searchBest(3,1000,0);
ok(E.moveToSAN(r.mv)==='Kxd2','會吃掉沒有保護的皇后');
E.loadFEN('k7/8/1K6/8/8/8/8/2Q5 w - - 0 1');
r=E.searchBest(5,2000,0);
ok(E.moveToSAN(r.mv).endsWith('#'),'優勢時不走成逼和（Qc7 會逼和），而是將死',E.moveToSAN(r.mv));
E.setupInitial();
let t=Date.now(); r=E.searchBest(30,500,0);
ok(Date.now()-t<900 && r.depth>=3,'時間限制有效',`(500ms → ${Date.now()-t}ms, depth ${r.depth})`);
ok(E.toFEN()==='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' && E.state().sp===0,'搜尋後盤面與堆疊完全還原');
E.setupInitial();
r=E.searchBest(2,300,250);
const good=r.list.filter(x=>x[1]>=r.score-250);
ok(good.length>=3,'低難度 slack 會提供多個候選走法（讓新手有機會贏）',`(${good.length} 個)`);

/* 自我對弈：隨機 + 引擎，確認整局下來每一步都合法、不當機 */
section('自我對弈穩定性');
let games=0, plies=0, ends={mate:0,stale:0,fifty:0,rep:0,mat:0,cap:0};
for(let g=0;g<6;g++){
  E.setupInitial(); const ks=[E.posKey()]; let n=0;
  while(true){
    const lm=E.legalMoves();
    if(!lm.length){ E.inCheck(E.state().stm)? ends.mate++ : ends.stale++; break; }
    if(E.state().half>=100){ ends.fifty++; break; }
    const k=ks[ks.length-1]; if(ks.filter(x=>x===k).length>=3){ ends.rep++; break; }
    if(E.insufficientMaterial()){ ends.mat++; break; }
    if(n>=300){ ends.cap++; break; }
    let mv;
    if(Math.random()<.5) mv=lm[Math.random()*lm.length|0];
    else mv=E.searchBest(2,50,0).mv;
    if(!lm.includes(mv)) throw new Error('engine returned illegal move');
    E.moveToSAN(mv,lm); E.make(mv); ks.push(E.posKey()); n++;
  }
  games++; plies+=n;
}
ok(true,`${games} 局、${plies} 半回合全部合法`,JSON.stringify(ends));

console.log(`\n結果：${pass} 通過，${fail} 失敗`);
process.exit(fail?1:0);
