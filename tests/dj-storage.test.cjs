const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const site = name => fs.readFileSync(path.join(__dirname,'../site',name),'utf8');

const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const throwingGetterStorage=()=>Object.defineProperty({},'x',{});
const quotaStorage=()=>({getItem:()=>null,setItem(){const e=new Error('full');e.name='QuotaExceededError';throw e;}});
const context=vm.createContext({T:(en,zh)=>zh,localStorage:memory()});
vm.runInContext(['learning-content.js','dj-score.js','dj-storage.js'].map(site).join('\n'),context);
const run=code=>{const value=vm.runInContext(code,context);return value===undefined?value:JSON.parse(JSON.stringify(value,(k,v)=>v instanceof Set?{set:[...v]}:v));};
const useStorage=store=>{context.localStorage=store;};
const setStored=(key,raw)=>{useStorage(memory());context.localStorage.setItem(key,raw);};

test('A saved work loads back with its sets, seed and pass',()=>{
  useStorage(memory());
  vm.runInContext("var work=(()=>{const w=djNewWork('hard',99);w.pass=2;w.takes[1].add('1:mel:0');return w})()",context);
  assert.equal(run('djSaveWork(work)'),true);
  const back=vm.runInContext('djLoadWork()',context);
  assert.equal(back.seed,99);assert.equal(back.mode,'hard');assert.equal(back.pass,2);
  assert.equal(back.takes[1].has('1:mel:0'),true);
});
test('Notes the guide filled in on a skip are saved, and do not count as hers',()=>{
  useStorage(memory());
  vm.runInContext("var work=(()=>{const w=djNewWork('standard',7);w.takes[0].add('a');w.takes[0].add('b');w.takes[1].add('c');w.guided[0].add('b');w.guided[1].add('c');return w})()",context);
  assert.equal(run('djPlayedByHand(work)'),1);
  assert.equal(run('djSaveWork(work)'),true);
  const back=vm.runInContext('djLoadWork()',context);
  assert.equal(back.guided[0].has('b'),true);
  assert.equal(back.guided[1].has('c'),true);
  assert.equal(vm.runInContext('djPlayedByHand',context)(back),1);
});
test('A save from before skips were tracked loads with every note counted as hers',()=>{
  const old=JSON.parse(JSON.stringify({...vm.runInContext("djNewWork('hard',5)",context),takes:[['a','b'],[],[],[]]}));
  delete old.guided;
  setStored('fm1-dj-birthday-v1',JSON.stringify(old));
  const back=vm.runInContext('djLoadWork()',context);
  assert.equal(back.guided.length,4);
  assert.equal(vm.runInContext('djPlayedByHand',context)(back),2);
});
test('No storage or a full quota: save returns false and nothing throws',()=>{
  for(const store of [undefined,quotaStorage()]){
    useStorage(store);
    assert.equal(run("djSaveWork(djNewWork('standard',1))"),false);
    assert.equal(run('djLoadWork()'),null);
  }
  useStorage({get getItem(){throw new Error('denied');},get setItem(){throw new Error('denied');}});
  assert.equal(run("djSaveWork(djNewWork('standard',1))"),false);
  assert.equal(run('djLoadWork()'),null);
});
test('Old or foreign data is ignored',()=>{
  const good=JSON.parse(JSON.stringify({...vm.runInContext("djNewWork('hard',5)",context),takes:[[],[],[],[]]}));
  const bad=['{"pass":2}','{"version":0,"takes":[]}','not json',
    JSON.stringify({...good,mode:'easy'}),JSON.stringify({...good,seed:-1}),JSON.stringify({...good,seed:1.5}),
    JSON.stringify({...good,takes:[[]]}),JSON.stringify({...good,mixes:[]})];
  for(const raw of bad){setStored('fm1-dj-birthday-v1',raw);assert.equal(run('djLoadWork()'),null,raw);}
  setStored('fm1-dj-birthday-v1',JSON.stringify(good));
  assert.notEqual(run('djLoadWork()'),null);
});
