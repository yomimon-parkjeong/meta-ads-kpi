const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const secureHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
const reply=(x,status=200,type='application/json')=>new Response(type==='application/json'?JSON.stringify(x):x,{status,headers:{...secureHeaders,'Content-Type':type+'; charset=utf-8'}});
const cookie=(name,value,age=28800)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
function redirect(path,cookies=[]){const h=new Headers({...secureHeaders,Location:path});for(const c of cookies)h.append('Set-Cookie',c);return new Response(null,{status:303,headers:h});}
async function key(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(env.SESSION_SECRET+'\0'+env.DASHBOARD_PASSWORD)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function seal(value,k){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,enc.encode(JSON.stringify(value))));}
async function open(value,k){try{const [iv,cipher]=value.split('.');const v=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv)},k,bytes(cipher))));return v.exp>Date.now()?v:null;}catch{return null;}}
async function equal(a,b){const [x,y]=await Promise.all([a,b].map(x=>crypto.subtle.digest('SHA-256',enc.encode(x))));return new Uint8Array(x).reduce((v,n,i)=>v|(n^new Uint8Array(y)[i]),0)===0;}
async function graph(edge,params,token){const u=new URL('https://graph.facebook.com/v22.0/'+edge);for(const [k,v]of Object.entries(params))u.searchParams.set(k,String(v));const r=await fetch(u,{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(25000)});const d=await r.json();if(!r.ok||d.error)throw Error('META_READ_FAILED');return d;}
const login='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>메타 광고 KPI 로그인</title><body><main style="max-width:360px;margin:15vh auto;font-family:sans-serif;padding:24px"><h1>메타 광고 KPI</h1><form action="/login" method="post"><label>공용 비밀번호<br><input name="password" type="password" required autocomplete="current-password" style="margin:16px 0;padding:12px;max-width:100%"></label><br><button style="padding:12px">로그인</button></form></main></body></html>';
export default {async fetch(request,env){
 try{
  if(!env.DASHBOARD_PASSWORD||env.DASHBOARD_PASSWORD.length<12||!env.SESSION_SECRET||env.SESSION_SECRET.length<32||!env.LOGIN_LIMITER)return reply({error:'호스팅 비밀값과 로그인 시도 제한 설정이 필요합니다.'},503);
  const url=new URL(request.url),p=url.pathname;
  if(url.protocol!=='https:')return reply({error:'HTTPS required'},403);
  if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return reply({error:'허용되지 않은 요청'},403);
  if(!['GET','HEAD','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
  const k=await key(env),cookies=Object.fromEntries((request.headers.get('Cookie')||'').split(';').map(x=>{const i=x.indexOf('=');return i<0?['','']:[x.slice(0,i).trim(),x.slice(i+1)];}));
  if(p==='/login'){
   if(request.method==='GET')return reply(login,200,'text/html');
   if(request.method!=='POST')return reply({},405);
   const rate=await env.LOGIN_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});if(!rate.success)return reply({error:'로그인 시도가 많습니다. 잠시 후 다시 시도하세요.'},429);
   const body=await request.text();if(body.length>2048)return reply({},413);
   if(!await equal(new URLSearchParams(body).get('password')||'',env.DASHBOARD_PASSWORD))return reply('비밀번호를 확인해 주세요.',401,'text/plain');
   return redirect('/',[cookie('__Host-kpi_session',await seal({sid:crypto.randomUUID(),exp:Date.now()+28800000},k)),cookie('__Host-kpi_meta','',0)]);
  }
  const session=await open(cookies['__Host-kpi_session']||'',k);
  if(!session)return p.startsWith('/api/')?reply({error:'로그인이 필요합니다.'},401):redirect('/login');
  if(p==='/logout'&&request.method==='POST')return redirect('/login',[cookie('__Host-kpi_session','',0),cookie('__Host-kpi_meta','',0)]);
  const meta=await open(cookies['__Host-kpi_meta']||'',k),connected=meta&&meta.sid===session.sid;
  if(p==='/connect'&&request.method==='POST'){
   const body=await request.text();if(body.length>10000)return reply({},413);const f=new URLSearchParams(body),token=(f.get('token')||'').trim(),account=(f.get('account')||'').replace(/^act_/,'');
   if(!/^\d+$/.test(account)||!/^EA[A-Za-z0-9]{50,1800}$/.test(token))return reply({error:'광고 계정 번호와 토큰 형식을 확인하세요.'},400);
   const a=await graph('act_'+account,{fields:'id'},token);if(a.id!=='act_'+account)throw Error('ACCOUNT_MISMATCH');
   return redirect('/',[cookie('__Host-kpi_meta',await seal({token,account,sid:session.sid,exp:session.exp,updated_at:new Date().toISOString()},k))]);
  }
  if(p==='/api/meta-token/status'&&request.method==='GET')return reply({configured:!!connected,account_read_verified:!!connected,updated_at:connected?meta.updated_at:null,project_root:'Cloudflare · 현재 로그인 세션',expiry_source:'만료일 별도 확인 필요'});
  if(p.startsWith('/api/meta-token/')&&request.method==='POST')return reply({error:'토큰 변경은 상단 연결 화면에서 다시 로그인 후 진행해 주세요.'},400);
  if(p==='/api/meta'&&request.method==='POST'){
   if(!connected)return reply({error:'Meta 토큰을 연결해 주세요.'},401);
   const body=await request.text();if(body.length>20000)return reply({},413);const {edge='',params={}}=JSON.parse(body);
   if(!['','/campaigns','/adsets','/ads','/insights'].includes(edge))return reply({},403);
   const allowed=['fields','limit','after','time_range','time_increment','level','use_account_attribution_setting','action_report_time'];if(Object.keys(params).some(x=>!allowed.includes(x)))return reply({},400);
   const d=await graph('act_'+meta.account+edge,params,meta.token);
   return reply({data:d.data??d,after:d.paging?.next?d.paging?.cursors?.after:null,more:!!d.paging?.next});
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return reply({},405);
  if(!['/','/index.html','/styles.css','/engine.js','/app.js','/boot.js'].includes(p))return reply({},404);
  const r=await env.ASSETS.fetch(request);const h=new Headers(r.headers);for(const [a,b]of Object.entries(secureHeaders))h.set(a,b);return new Response(r.body,{status:r.status,headers:h});
 }catch{return reply({error:'요청을 완료하지 못했습니다. 토큰의 광고계정 조회 권한·만료 또는 네트워크 상태를 확인하세요.'},502);}
}};


