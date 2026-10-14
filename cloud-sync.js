/**
 * Daywell cloud adapter (Firebase Authentication + per-user Firestore documents).
 * Cloud sync only activates after the owner configures firebase-config.js and deploys rules.
 * Never put service-account keys in client files.
 */
import { firebaseConfig } from './firebase-config.js';

const badge = document.getElementById('cloud-state');
const explanation = document.getElementById('cloud-description');
const login = document.getElementById('cloud-login');
const logout = document.getElementById('cloud-logout');
const importGuest = document.getElementById('cloud-import');
const bridge = window.DaywellBridge;
const main = document.querySelector('main.main');
const API_VERSION = '12.19.0';
const endpoint = name => 'https://www.gstatic.com/firebasejs/' + API_VERSION + '/firebase-' + name + '.js';
const kinds = ['foods','exercises','journals','profile'];
const readyConfig = Boolean(firebaseConfig?.apiKey && firebaseConfig?.authDomain && firebaseConfig?.projectId && firebaseConfig?.appId);
function show(label, message) {
  badge.textContent = label;
  explanation.textContent = message;
}
function hasData(d) {
  return Boolean(d.foods?.length || d.exercises?.length || Object.values(d.journals||{}).some(j => Object.keys(j).some(k=>k!=='updatedAt')) ||
    Object.values(d.profile||{}).some((v,i)=>i===-1 && v));
}
if (!readyConfig) {
  show('Setup required','Cloud backup is NOT active. Your records save only on this device until the app owner configures Firebase Authentication, Firestore and security rules.');
} else {
  try {
    const [{initializeApp}, authApi, fs] = await Promise.all([import(endpoint('app')),import(endpoint('auth')),import(endpoint('firestore'))]);
    const app = initializeApp(firebaseConfig);
    const auth = authApi.getAuth(app);
    let db;
    try { db = fs.initializeFirestore(app,{localCache:fs.persistentLocalCache({tabManager:fs.persistentMultipleTabManager()})}); }
    catch (e) { console.warn('Persistent cache unavailable:',e); db=fs.getFirestore(app); }
    const provider = new authApi.GoogleAuthProvider();
    let userId = null, unsub = [], generation = 0, loaded = new Set(), snapshots = {}, baseline = {}, dirty = new Map(), timers = new Map(), writeError = null;
    const key = (kind,id) => kind + '/' + id;
    const clone = o => JSON.parse(JSON.stringify(o));
    const dict = (kind,value) => kind==='profile' ? {'main':value} : kind==='journals' ? value : Object.fromEntries((value||[]).map(v=>[v.id,v]));
    const fromDict = (kind,d) => kind==='profile' ? (d.main||{}) : kind==='journals' ? d : Object.values(d);
    function status() {
      if(!userId) return;
      if(writeError) return show('Sync error',writeError);
      if(loaded.size!==4) return show('Connecting','Loading your personal cloud records. Please wait.');
      const ok = kinds.every(k => snapshots[k] && !snapshots[k].metadata.fromCache && !snapshots[k].metadata.hasPendingWrites);
      if(dirty.size || !ok || !navigator.onLine) show('Waiting to sync','Records are saved locally; some changes are still waiting for cloud confirmation. Keep this app online until the status says synced.');
      else show('Synced to cloud','Your latest records have been confirmed by Firestore. They are private to your signed-in account.');
    }
    function cloudRef(kind,id){
      return fs.doc(db,'users',userId,kind,id);
    }
    function flush(k) {
      const entry = dirty.get(k);
      if (!entry || !userId || loaded.size!==4) return;
      const uidAtStart=userId;
      const ref=cloudRef(entry.kind,entry.id);
      const request = entry.value===null ? fs.deleteDoc(ref) : fs.setDoc(ref,{payload:clone(entry.value),updatedAt:fs.serverTimestamp()});
      Promise.resolve(request).then(()=>{
        if(uidAtStart!==userId)return;
        if(dirty.get(k)===entry)dirty.delete(k);
        status();
      }).catch(err=>{
        if(uidAtStart!==userId)return;
        writeError='Cloud rejected a save (' + (err.code||'unknown error') + '). Export a JSON backup and check Firestore security rules.';
        console.error('Daywell cloud save failed',err); status();
      });
    }
    function mark(kind,id,value) {
      const k=key(kind,id);
      const entry={kind,id,value:value===null?null:clone(value)};
      dirty.set(k,entry);
      if(timers.has(k))clearTimeout(timers.get(k));
      timers.set(k,setTimeout(()=>{timers.delete(k);flush(k)},kind==='journals'?900:kind==='profile'?300:20));
    }
    function changed(next) {
      if(!userId || loaded.size!==4)return;
      writeError=null;
      for(const kind of kinds){
        const old=dict(kind,baseline[kind] || (kind==='profile'?{}:kind==='journals'?{}:[]));
        const fresh=dict(kind,next[kind]);
        for(const id of new Set([...Object.keys(old),...Object.keys(fresh)])){
          if(JSON.stringify(old[id])!==JSON.stringify(fresh[id]))mark(kind,id,Object.hasOwn(fresh,id)?fresh[id]:null);
        }
        baseline[kind]=clone(next[kind]);
      }
      status();
    }
    window.DaywellCloudSync={changed};
    function takeRemote(kind,snap){
      snapshots[kind]=snap;
      const docs = {};
      if(kind==='profile') {
        if(snap.exists()) docs.main=snap.data()?.payload||{};
      } else {
        snap.forEach(d => { if(d.data()?.payload && Object.hasOwn(d.data(),'payload'))docs[d.id]=d.data().payload; });
      }
      for(const [k,entry] of dirty){
        if(entry.kind!==kind)continue;
        if(entry.value===null)delete docs[entry.id];else docs[entry.id]=entry.value;
      }
      const combined=fromDict(kind,docs);
      baseline[kind]=clone(combined);
      bridge.applyPart(kind,combined);
      loaded.add(kind);
      if(loaded.size===4)main.inert=false;
      status();
    }
    function resetSession(){
      for(const stop of unsub)stop();
      unsub=[];generation++;
      for(const t of timers.values())clearTimeout(t);
      timers.clear();dirty.clear();loaded.clear();snapshots={};baseline={};writeError=null;
    }
    login.disabled=false;
    login.addEventListener('click',()=> {
      authApi.signInWithPopup(auth,provider).catch(e=>show('Sign-in failed', 'Could not sign in ('+(e.code||'error')+'). Try opening Daywell directly in Safari or Chrome, and check Firebase authorized domains.'));
    });
    logout.addEventListener('click',()=>{
      if(dirty.size && !confirm('Some changes have not been confirmed in the cloud. Download a JSON backup before signing out. Continue?'))return;
      authApi.signOut(auth).catch(e=>show('Sign-out failed',e.message));
    });
    importGuest.addEventListener('click',()=>{
      const g=bridge.guest();
      const populated=g.foods.length || g.exercises.length || Object.keys(g.journals).length;
      if(!populated)return alert('No guest entries found on this device.');
      if(!confirm('Copy guest entries from this device into the signed-in account? Existing cloud journal dates take priority. Guest data remains on this device until you clear it.'))return;
      bridge.mergeGuest();
      status();
    });
    authApi.onAuthStateChanged(auth, user => {
      resetSession();
      if(!user){
        userId=null;main.inert=false;bridge.leaveAccount();
        login.hidden=false;logout.hidden=true;importGuest.hidden=true;
        show('Local only','Sign in with Google to back up private records automatically. Guest entries stay only in this browser.');
        return;
      }
      userId=user.uid;
      const myGeneration=generation;
      main.inert=true;
      bridge.enterAccount(user.uid);
      login.hidden=true;logout.hidden=false;importGuest.hidden=false;
      show('Connecting','Loading secure records for ' + (user.email||'your account') + '...');
      for(const kind of kinds){
        const ref=kind==='profile'?cloudRef('profile','main'):fs.collection(db,'users',userId,kind);
        unsub.push(fs.onSnapshot(ref,{includeMetadataChanges:true}, snap=>{
          if(generation!==myGeneration)return;
          takeRemote(kind,snap);
        }, e=>{
          if(generation!==myGeneration)return;
          main.inert=false;
          writeError='Cannot load cloud data (' + (e.code||'error') + '). Verify Firestore is enabled and its rules are deployed. Do not rely on cloud backup yet.';
          console.error('Daywell cloud load failed',e);status();
        }));
      }
      status();
    }, e=>show('Authentication error','Could not check sign-in: '+e.message));
    window.addEventListener('online',status);
    window.addEventListener('offline',status);
  } catch(e) {
    console.error('Daywell Firebase initialization failed',e);
    show('Cloud unavailable','Cannot initialize Firebase on this device. Your records remain local until the issue is resolved.');
  }
}
