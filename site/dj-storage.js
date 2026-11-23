// The recipient's birthday work stays on this device. Sets travel as arrays; anything unrecognised is ignored.
const DJ_STORAGE_KEY='fm1-dj-birthday-v1';

function djStorage(){
  try{return typeof localStorage==='undefined'?null:localStorage||null;}catch{return null;}
}

function djSaveWork(work){
  try{
    const store=djStorage();
    if(!store)return false;
    store.setItem(DJ_STORAGE_KEY,JSON.stringify({...work,takes:work.takes.map(take=>[...take]),guided:(work.guided||[]).map(take=>[...take])}));
    return true;
  }catch{return false;}
}

function djLoadWork(){
  try{
    const raw=djStorage()?.getItem(DJ_STORAGE_KEY);
    if(!raw)return null;
    const work=JSON.parse(raw);
    if(!work||work.version!==1||!['standard','hard'].includes(work.mode))return null;
    if(!Number.isInteger(work.seed)||work.seed<0||work.seed>4294967295)return null;
    if(!Array.isArray(work.takes)||work.takes.length!==4||!work.takes.every(Array.isArray))return null;
    if(!Array.isArray(work.mixes)||work.mixes.length!==4||!work.mixes.every(mix=>mix&&typeof mix==='object'))return null;
    if(!Number.isInteger(work.pass)||work.pass<0||work.pass>3)return null;
    // A save from before skips were tracked has no guided list: all of its notes count as hers.
    const guided=Array.isArray(work.guided)&&work.guided.length===4&&work.guided.every(Array.isArray)?work.guided:[[],[],[],[]];
    return {...work,takes:work.takes.map(take=>new Set(take.map(String))),guided:guided.map(take=>new Set(take.map(String)))};
  }catch{return null;}
}

function djClearWork(){
  try{
    const store=djStorage();
    if(store?.removeItem)store.removeItem(DJ_STORAGE_KEY);
    else store?.setItem(DJ_STORAGE_KEY,'');
  }catch{}
}
