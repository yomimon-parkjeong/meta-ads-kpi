(function(root){
'use strict';
const sum=(xs,k)=>xs.reduce((a,x)=>a+(Number(x[k])||0),0);
const ratio=(a,b)=>b>0?a/b:null;
const delta=(a,b)=>a!=null&&b>0?a/b-1:null;
const median=xs=>{const a=xs.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2:null};
function metrics(x={}){
 return {...x,spend:x.spend||0,revenue:x.revenue||0,purchases:x.purchases||0,impressions:x.impressions||0,link_clicks:x.link_clicks||0,
 roas:ratio(x.revenue,x.spend),cpa:ratio(x.spend,x.purchases),aov:ratio(x.revenue,x.purchases),link_ctr:ratio(x.link_clicks,x.impressions),cpm:ratio(x.spend*1000,x.impressions),cpc:ratio(x.spend,x.link_clicks),cvr:ratio(x.purchases,x.lpv),arrival:ratio(x.lpv,x.link_clicks),atc_rate:ratio(x.atc,x.lpv),hook:ratio(x.video3,x.impressions),hold:ratio(x.thruplay,x.video3)};
}
function aggregate(rows){const out={};for(const k of ['spend','revenue','purchases','impressions','clicks','link_clicks','lpv','atc','checkout','video3','plays','thruplay'])out[k]=sum(rows,k);return metrics(out)}
function product(ad,data){
 const camp=data.campaigns[ad.campaign_id]?.name||'';const txt=camp+' '+(data.adsets[ad.adset_id]?.name||'')+' '+(ad.name||'');
 const patterns=[['키즈탭프로',/키즈탭\s*프로|키즈탭프로/],['키즈탭',/키즈탭/],['듀얼USB',/듀얼|USB/i],['플레이돌맥스',/플레이돌\s*맥스/],['플레이돌',/플레이돌/],['멀티보드',/멀티보드/],['클레이',/클레이/],['마이크',/마이크/],['사운드북',/사운드북/]];
 return patterns.find(x=>x[1].test(txt))?.[0]||camp||'미분류';
}
const labels={OUTCOME_SALES:'판매',CONVERSIONS:'전환',OUTCOME_TRAFFIC:'트래픽',LINK_CLICKS:'링크 클릭',OUTCOME_ENGAGEMENT:'참여',OUTCOME_AWARENESS:'인지도',OUTCOME_LEADS:'잠재고객',OUTCOME_APP_PROMOTION:'앱 홍보',OFFSITE_CONVERSIONS:'웹사이트 등 외부 전환',VALUE:'전환 가치',LANDING_PAGE_VIEWS:'랜딩 페이지 조회',PURCHASE:'구매',ADD_TO_CART:'장바구니 담기',INITIATED_CHECKOUT:'결제 시작',IMPRESSIONS:'노출',THRUPLAY:'ThruPlay',LOWEST_COST_WITHOUT_CAP:'최저 비용 · 한도 없음',COST_CAP:'비용 한도',LOWEST_COST_WITH_BID_CAP:'입찰가 한도',LOWEST_COST_WITH_MIN_ROAS:'최소 ROAS 기준',AUCTION:'경매',CLICK_THROUGH:'클릭',VIEW_THROUGH:'조회',ENGAGED_VIDEO_VIEW:'참여 동영상 조회',facebook:'페이스북',instagram:'인스타그램',audience_network:'Audience Network',messenger:'메신저',mobile:'모바일',desktop:'데스크톱'};
const label=x=>x==null||x===''?'미확인':labels[x]||String(x);
function config(ad,data){
 const s=data.settings?.adsets?.[ad.adset_id]||{},c=data.settings?.campaigns?.[ad.campaign_id]||{},t=s.targeting||{};
 const known=!!s.id&&!!c.id,event=s.promoted_object?.custom_event_type,goal=s.optimization_goal;
 const conversionGoal=['OFFSITE_CONVERSIONS','VALUE'].includes(goal);
 const purchase=known&&conversionGoal&&event==='PURCHASE';
 const knownOther=known&&!!goal&&(conversionGoal?!!event&&event!=='PURCHASE':true);
 const goalKind=purchase?'purchase':knownOther?'other':'unknown';
 const resultKey=conversionGoal?({PURCHASE:'purchases',ADD_TO_CART:'atc',INITIATED_CHECKOUT:'checkout'}[event]||null):({LANDING_PAGE_VIEWS:'lpv',LINK_CLICKS:'link_clicks',THRUPLAY:'thruplay',IMPRESSIONS:'impressions',REACH:'reach'}[goal]||null);
 const resultLabel=goal==='LANDING_PAGE_VIEWS'?'랜딩뷰':conversionGoal?label(event):label(goal);
 const hasDetails=Object.keys(t).some(k=>['interests','behaviors','family_statuses','flexible_spec','life_events'].includes(k)&&t[k]?.length);
 const audience=(t.custom_audiences?.length?'맞춤타겟 포함 · 종류 확인 필요':hasDetails?'상세 타겟 조건 있음':s.targeting?'관심사·맞춤타겟 조건 미표시':'타겟 미확인');
 const advantage=t.targeting_automation?.advantage_audience;
 const notes=[];
 if(goalKind==='other')notes.push('구매 외 목표의 광고입니다. '+resultLabel+' 성과를 먼저 확인하고 구매·ROAS는 후속 성과로 참고하세요.');
 if(goalKind==='unknown')notes.push('최적화 목표·이벤트를 확인하지 못했습니다. 구매 성과만으로 교체·위닝을 판정하지 않습니다.');
 if(advantage===1)notes.push('Advantage+ 타겟 사용: 입력한 관심사·연령 범위를 실제 도달 타겟으로 단정하지 마세요.');
 if(t.targeting_optimization||t.targeting_relaxation_types)notes.push('별도 타겟 확장 관련 설정이 있습니다. Advantage+ 사용 여부와 전체 확장 여부는 동일하지 않습니다.');
 if(t.custom_audiences?.length)notes.push('맞춤타겟 포함만으로 리타겟팅·유사타겟을 확정하지 않습니다. 타겟 생성 규칙 확인이 필요합니다.');
 const since=data.windows?.['7']?.since,until=data.windows?.['7']?.until;
 if(s.updated_time&&since&&until&&s.updated_time.slice(0,10)>=since&&s.updated_time.slice(0,10)<=until)notes.push('최근 성과 7일 구간 안에 세트 수정 기록이 있습니다. 변경 항목·이전 값은 미확보이므로 성과 변화의 원인으로 확정하지 않습니다.');
 if(s.learning_stage_info?.status==='LEARNING')notes.push('현재 학습 중으로 응답했습니다. 단기 변동을 소재 피로도로 바로 해석하지 마세요.');
 return {known,goalKind,purchase,resultKey,resultLabel,event,goal,objective:c.objective,audience,advantage,notes,adset:s,campaign:c,targeting:t,collected_at:data.settings?.collected_at||null};
}
function applyConfig(r,ctx){
 r.config=ctx;r.audience=ctx.audience;
 if(ctx.goalKind!=='purchase'&&r.windows['7'].impressions>0){
  r.verdict=ctx.goalKind==='other'?'목표별 검토':'설정 확인';r.priority=4;
  r.reason=[ctx.notes[0]];
  r.flags=r.flags.filter(x=>x.includes('LPV/링크클릭')||x.includes('빈도'));
  r.flags.push('구매 표본 등급과 CPA·ROAS는 후속 성과 참고값입니다. 현재 목표의 소재 평가와 구분합니다.');
 }
 return r;
}
function budgetOwner(ad,data){
 const c=data.campaigns[ad.campaign_id],s=data.adsets[ad.adset_id];
 if(c&&(Number(c.daily_budget)>0||Number(c.lifetime_budget)>0))return {id:c.id,name:c.name,type:'캠페인',mode:'CBO',daily:Number(c.daily_budget)||0,lifetime:Number(c.lifetime_budget)||0,updated:c.updated_time,status:c.effective_status};
 if(s&&(Number(s.daily_budget)>0||Number(s.lifetime_budget)>0))return {id:s.id,name:s.name,type:'광고 세트',mode:'ABO',daily:Number(s.daily_budget)||0,lifetime:Number(s.lifetime_budget)||0,updated:s.updated_time,status:s.effective_status};
 return null;
}
function diagnose(w,opts={}){
 const a=metrics(w['3']),b=metrics(w.prev3),c=metrics(w['7']),d=metrics(w.prev7),m=metrics(w['30']);
 const pm=metrics(w.prev30);const changes={cpa3:delta(a.cpa,b.cpa),ctr3:delta(a.link_ctr,b.link_ctr),cpm3:delta(a.cpm,b.cpm),roas3:delta(a.roas,b.roas),cpa7:delta(c.cpa,d.cpa),ctr7:delta(c.link_ctr,d.link_ctr),roas7:delta(c.roas,d.roas),cpa30:delta(m.cpa,pm.cpa),roas30:delta(m.roas,pm.roas)};
 const flags=[]; let verdict='유지 관찰',priority=4,confidence='낮음',reason=[];
 const enough7=c.purchases>=5&&d.purchases>=5&&c.impressions>=1500&&d.impressions>=1500;
 const enough3=a.purchases>=3&&b.purchases>=3&&a.impressions>=1000&&b.impressions>=1000;
 if(c.impressions===0){verdict='과거 소재';priority=7;reason.push('최근 7일 노출 없음. 30일·이전 30일 위닝 이력 확인 대상.');}
 else if(!enough7){verdict='표본 부족';priority=5;reason.push('현재·직전 7일 각각 구매 5건 및 노출 1,500회 기준을 충족하지 못함. 자동 교체 판단 보류.');}
 else {
   confidence=c.purchases>=15&&d.purchases>=15&&a.purchases>=5&&b.purchases>=5?'충분':'보통';
   const bad3=enough3&&changes.cpa3>=.3&&changes.ctr3<=-.2;
   const bad7=changes.cpa7>=.25&&changes.roas7<=-.2;
   if(bad3&&bad7){verdict='교체 검토';priority=1;reason.push('3일 CPA 30% 이상 상승·링크 CTR 20% 이상 하락과 7일 CPA 상승·ROAS 하락이 함께 관찰됨.');}
   else if(bad3){verdict='단기 경보';priority=2;reason.push('3일 구매 효율과 클릭 반응이 함께 하락했으나 7일 추세로 확인되지 않음. 대체 훅 준비 후 재확인.');}
   else if(bad7){verdict='퍼널 점검';priority=2;reason.push('7일 구매 효율 하락. 클릭 반응·랜딩·오퍼·타겟 변화 확인 후 소재 교체 여부 결정.');}
   else if(changes.cpm3>=.25&&changes.ctr3>-.1){verdict='입찰·타겟 점검';priority=3;reason.push('CPM 상승과 클릭 반응 유지가 함께 관찰됨. 소재 피로도로 단정하지 않음.');}
   else {reason.push('지속적 악화 조건이 함께 확인되지 않음. 현 소재 유지와 비교 테스트 권고.');}
 }
 if(!enough3&&c.impressions>0)flags.push('3일 구매 표본 부족');
 if(a.arrival>1||c.arrival>1)flags.push('LPV/링크클릭 100% 초과: 집계 정의·귀속 차이 확인');
 if(a.frequency>=2.5)flags.push('3일 빈도 '+a.frequency.toFixed(2)+' (보조 신호)');
 if(a.purchases===0&&a.link_clicks>=100)flags.push('최근 3일 링크클릭 100회 이상·구매 0건: 추적·랜딩 우선 점검');
 if(opts.targetRoas>0&&c.roas!=null)flags.push(c.roas>=opts.targetRoas?'7일 목표 ROAS 충족':'7일 목표 ROAS 미달');
 if(opts.targetCpa>0&&c.cpa!=null)flags.push(c.cpa<=opts.targetCpa?'7일 목표 CPA 충족':'7일 목표 CPA 미달');
 if(m.purchases>=10&&m.cpa&&c.cpa>m.cpa*1.3)flags.push('7일 CPA가 30일 기준보다 30% 이상 높음 (구간 중첩 참고)');
 if(m.purchases>=10&&pm.purchases>=10&&changes.cpa30>=.3&&changes.roas30<=-.2)flags.push('직전 30일 대비 장기 효율 하락. 최근 반등과 분리해 상품·오퍼·계절·집행 조건 확인');
 return {verdict,priority,confidence,reason,flags,changes,enough3,enough7,windows:{'3':a,prev3:b,'7':c,prev7:d,'30':m,prev30:metrics(w.prev30)}};
}
function analyze(data,opts={}){
 const ids=[...new Set(Object.values(data.periods).flatMap(x=>Object.keys(x)))];
 const rows=ids.map(id=>{const ad=data.ads[id]||{id,name:id};const w={};for(const k of Object.keys(data.periods))w[k]=data.periods[k][id]||{};return applyConfig({...ad,product:product(ad,data),owner:budgetOwner(ad,data),...diagnose(w,opts)},config(ad,data))});
 for(const row of rows){
  const peers=rows.filter(x=>row.config.purchase&&x.config.purchase&&x.id!==row.id&&(!row.creative_id||x.creative_id!==row.creative_id)&&x.product===row.product&&x.adset_id===row.adset_id&&x.windows['30'].purchases>=5);
  const reference=median(peers.map(x=>x.windows['30'].roas));
  row.peer_count=peers.length;row.peer_roas=reference;
  row.operational=[];
  const daily=data.daily.filter(x=>x.id===row.id&&x.date>=data.windows['7'].since&&x.date<=data.windows['7'].until&&x.spend>0);
  const cpav=daily.filter(x=>x.purchases>0).map(x=>x.spend/x.purchases);const avg=cpav.reduce((a,b)=>a+b,0)/cpav.length;
  row.volatility={spendDays:daily.length,purchaseDays:cpav.length,zeroPurchaseDays:daily.length-cpav.length,cpaCV:cpav.length>=4&&avg>0?Math.sqrt(cpav.reduce((s,v)=>s+(v-avg)**2,0)/cpav.length)/avg:null};
  if(row.config.purchase&&row.windows['7'].purchases===0&&row.windows['7'].link_clicks>=100)row.operational.push('무전환 우선 점검');
  if(row.config.purchase&&row.changes.roas7<=-.3&&row.changes.cpa7!=null&&row.changes.cpa7<.25)row.operational.push('구매금액·오퍼 점검');
  if(row.config.purchase&&row.changes.cpa30>=.3&&row.changes.roas30<=-.2&&row.windows['30'].purchases>=10&&row.windows.prev30.purchases>=10)row.operational.push('장기 효율 재점검');
  row.reviewPriority=row.operational.includes('무전환 우선 점검')?1:row.operational.includes('구매금액·오퍼 점검')?2:row.priority;
  row.winner=row.config.purchase&&row.windows['30'].purchases>=10&&peers.length>=1&&row.windows['30'].roas>=reference&&row.windows['7'].purchases>=5&&row.verdict!=='교체 검토'&&row.windows['7'].cpa<=row.windows['30'].cpa*1.3;
  row.pastWinner=row.windows.prev30.purchases>=10&&row.windows['7'].impressions===0;
 }
 return rows.sort((a,b)=>a.reviewPriority-b.reviewPriority||b.windows['7'].spend-a.windows['7'].spend);
}
function reconcile(data){return ['3','7','30'].map(k=>{const api=metrics(data.account_periods[k]);const ads=aggregate(Object.values(data.periods[k]));const filtered=aggregate(Object.values(data.periods[k]).filter(x=>data.campaigns[x.campaign_id]?.status==='ACTIVE'));return {window:k,api,ads,activeCampaigns:filtered,spendDiff:ads.spend-api.spend,revenueDiff:ads.revenue-api.revenue,purchaseDiff:ads.purchases-api.purchases,excludedSpend:api.spend-filtered.spend}})}
function budgetPlan(owner,rows,opts={}){
 const pct=Number(opts.pct)||0;const now=opts.now||Date.now();
 const list=rows.filter(r=>r.owner?.id===owner?.id);const m=aggregate(list.map(x=>x.windows['7']));const blockers=[];
 if(!owner)blockers.push('예산 소유자 확인 불가');
 if(list.some(r=>r.config?.goalKind!=='purchase'))blockers.push('구매 목표가 아닌 광고 또는 목표 미확인 광고 포함: 목표별 예산 기준 필요');
 if(opts.dataQualityReady!==true)blockers.push('집계 대조 미해결: 수동 검토 필요');
 if(!owner?.daily)blockers.push('일일 예산 아님 또는 예산 미확인');
 if(owner?.status!=='ACTIVE')blockers.push('예산 소유자 비활성');
 if(!pct||Math.abs(pct)>20)blockers.push('변경폭은 0% 초과·±20% 이내의 내부 실험 제한');
 if(!(opts.targetRoas>0||opts.targetCpa>0))blockers.push('목표 ROAS 또는 CPA 입력 필요');
 if(m.purchases<15)blockers.push('소유자 기준 최근 7일 구매 15건 미만');
 if(owner?.updated&&now-new Date(owner.updated).getTime()<72*3600000)blockers.push('최근 72시간 내 수정: 수정 종류 확인 전 보류');
 if(opts.snapshotAgeHours>24)blockers.push('성과 스냅샷 24시간 초과');
 if(!opts.snapshotAgeHours&&opts.snapshotAgeHours!==0)blockers.push('성과 스냅샷 시각 확인 필요');
 if(pct>0){
  if(opts.targetRoas>0&&m.roas<opts.targetRoas)blockers.push('목표 ROAS 미달');
  if(opts.targetCpa>0&&(m.cpa==null||m.cpa>opts.targetCpa))blockers.push('목표 CPA 미달');
  if(list.some(r=>['교체 검토','퍼널 점검','단기 경보'].includes(r.verdict)))blockers.push('하위 소재 악화 신호');
 }else if(pct<0){
  const bad=(opts.targetRoas>0&&m.roas<opts.targetRoas)||(opts.targetCpa>0&&m.cpa>opts.targetCpa);
  if(!bad)blockers.push('목표 미달 근거 없음');
 }
 return {owner,metrics:m,pct,oldBudget:owner?.daily||0,newBudget:owner?.daily?Math.round(owner.daily*(1+pct/100)):null,blockers,eligible:blockers.length===0,mode:'SIMULATION_ONLY',note:'±20%·72시간은 내부 시뮬레이션 가드레일이며 Meta 공식 안전 보장 기준이 아님. 예산≠실제 지출. 매출 증가 예측 아님.'};
}
function backtest(data,offset=7){
 const snapshotEnd=new Date(data.windows['7'].until+'T00:00:00Z');const end=new Date(snapshotEnd.getTime()-(offset-7)*86400000);const cutoff=new Date(snapshotEnd.getTime()-offset*86400000);
 const date=d=>new Date(d+'T00:00:00Z');const ids=[...new Set(data.daily.map(r=>r.id))];const results=[];
 for(const id of ids){
  const daily=data.daily.filter(x=>x.id===id);const window=(n,offset=0)=>aggregate(daily.filter(x=>{const gap=(cutoff-date(x.date))/86400000;return gap>=offset&&gap<offset+n}));
  const w={'3':window(3),prev3:window(3,3),'7':window(7),prev7:window(7,7),'30':window(30),prev30:{}};
  const decision=diagnose(w);const after=aggregate(daily.filter(x=>date(x.date)>cutoff&&date(x.date)<=end));
  const eligible=w['7'].purchases>=5&&after.purchases>=5;
  if(eligible){const cpaChange=delta(after.cpa,w['7'].cpa);const roasChange=delta(after.roas,w['7'].roas);results.push({id,name:data.ads[id]?.name||id,verdict:decision.verdict,before:w['7'],after,cpaChange,roasChange,alert:['교체 검토','단기 경보','퍼널 점검'].includes(decision.verdict),worsened:cpaChange>=.2&&roasChange<=-.15});}
 }
 const count=(a,b)=>results.filter(x=>x.alert===a&&x.worsened===b).length;
 return {cutoff:cutoff.toISOString().slice(0,10),holdoutStart:new Date(cutoff.getTime()+86400000).toISOString().slice(0,10),holdoutEnd:end.toISOString().slice(0,10),results,tp:count(true,true),fp:count(true,false),fn:count(false,true),tn:count(false,false),note:'과거 시점 재생 검증. 현재 조회한 과거 귀속값이므로 당시 실시간 스냅샷 재현이 아님. 이후 CPA +20%·ROAS -15%를 사후 악화로 정의. 광고 중지·예산·타겟 변화 통제 없음. 실제 교체 효과/증분 매출 검증 아님.'};
}
const api={metrics,aggregate,delta,median,diagnose,analyze,reconcile,budgetOwner,budgetPlan,backtest,config,label};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AuditEngine=api;
})(typeof window!=='undefined'?window:globalThis);
