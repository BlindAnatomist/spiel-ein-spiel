"""Recompute the audit from retained and reconstructed games. Python 3 + NumPy.
Matched group/seed blocks are the resampling units; fixed matchup strata are retained.
"""
from pathlib import Path
from collections import defaultdict, Counter
import gzip,json,hashlib,sys,zipfile
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/bot-validation'
FIELDS='opportunities passes voluntary_opportunities voluntary_calls forced_calls calls made euchred marches loner_attempts loner_five loner_three_four loner_euchres maker_tricks gross_points net_points round_one_calls round_two_calls'.split()
I={k:i for i,k in enumerate(FIELDS)}
RATES={'call_rate':('calls','opportunities'),'voluntary_call_rate':('voluntary_calls','voluntary_opportunities'),'make_rate':('made','calls'),'euchre_rate':('euchred','calls'),'march_rate':('marches','calls'),'loner_attempt_rate':('loner_attempts','calls'),'loner_five_rate':('loner_five','loner_attempts'),'loner_three_four_rate':('loner_three_four','loner_attempts'),'loner_euchre_rate':('loner_euchres','loner_attempts'),'maker_tricks_per_call':('maker_tricks','calls'),'gross_points_per_call':('gross_points','calls'),'net_points_per_call':('net_points','calls')}
def empty():return np.zeros(len(FIELDS),dtype=np.int64)
def rate(n,d):return float(n/d) if d else None
def counted(v):
 d={k:int(v[i]) for k,i in I.items()};d['rates']={k:{'value':rate(d[n],d[q]),'numerator':d[n],'denominator':d[q],'denominator_name':q} for k,(n,q) in RATES.items()};return d
def rng(label):return np.random.default_rng(int(hashlib.sha256(label.encode()).hexdigest()[:8],16))
def interval(estimate,draws,n,primary=False,eligible=None,denominator=None,rare=False):
 d=np.asarray(draws);d=d[np.isfinite(d)];sparse=n<32 or (eligible is not None and eligible<32) or (denominator is not None and denominator<50)
 out={'blocks':n,'estimate':estimate,'ci95':np.quantile(d,[.025,.975]).tolist() if len(d) and not rare else None,'validResamples':len(d),'sparse':bool(sparse)}
 if primary:out['familyWise95']=np.quantile(d,[.025/16,1-.025/16]).tolist() if len(d) else None
 if eligible is not None:out.update(eligibleBlocks=int(eligible),denominator=int(denominator))
 if rare:out['note']='No observed numerator events; percentile bootstrap cannot estimate an unseen event risk.'
 return out

def ratio_ci(rows,num,den,label,paired=False,primary=False,rare=False):
 a=np.asarray(rows,dtype=float);n=len(a);r=rng(label);draws=[]
 def estimate(x):
  with np.errstate(divide='ignore',invalid='ignore'):
   return x[...,1,num]/x[...,1,den]-x[...,0,num]/x[...,0,den] if paired else x[...,num]/x[...,den]
 for start in range(0,1999,64):
  idx=r.integers(0,n,(min(64,1999-start),n));draws.extend(estimate(a[idx].sum(axis=1)).tolist())
 e=float(estimate(a.sum(axis=0)));e=e if np.isfinite(e) else None
 eligible=None if paired else int((a[:,den]>0).sum());denominator=None if paired else int(a[:,den].sum())
 return interval(e,draws,n,primary,eligible,denominator,rare and a[:,num].sum()==0)

def mean_ci(strata,label,primary=False):
 r=rng(label);draws=np.zeros(1999);means=[];n=0
 for key,values in sorted(strata.items()):
  a=np.asarray(values,dtype=float);n+=len(a);means.append(float(a.mean()));draws+=a[r.integers(0,len(a),(1999,len(a)))].mean(axis=1)
 return interval(float(np.mean(means)),draws/len(means),n,primary)

def bid_counts(h,b):
 v=empty();v[I['opportunities']]=1;v[I['passes']]=b['action']=='pass';v[I['voluntary_opportunities']]=not b['forced']
 if b['action']=='call':
  r=h['result'];made=r['reason']!='euchred';v[I['calls']]=1;v[I['forced_calls']]=b['forced'];v[I['voluntary_calls']]=not b['forced'];v[I['made']]=made;v[I['euchred']]=not made;v[I['marches']]=r['makerTricks']==5;v[I['loner_attempts']]=h['alone'];v[I['loner_five']]=h['alone'] and r['makerTricks']==5;v[I['loner_three_four']]=h['alone'] and r['makerTricks'] in (3,4);v[I['loner_euchres']]=h['alone'] and not made;v[I['maker_tricks']]=r['makerTricks'];v[I['gross_points']]=r['points'] if made else 0;v[I['net_points']]=r['points'] if made else -r['points'];v[I['round_one_calls']]=b['round']==1;v[I['round_two_calls']]=b['round']==2
 return v

def write(name,data):
 text=json.dumps(data,indent=None if name.endswith('.gz') else 2,allow_nan=False)+'\n'
 if name.endswith('.gz'):
  with gzip.open(OUT/name,'wt') as f:f.write(text)
 else:(OUT/name).write_text(text)

def read_chunk(job):
 p=OUT/'detailed'/f"{job['id']}.json.gz"
 if p.exists():return json.load(gzip.open(p))
 with zipfile.ZipFile(OUT/'reconstructed-results.zip') as z:return json.loads(gzip.decompress(z.read('detailed/'+p.name)))

def main():
 manifest=json.loads((OUT/'manifest.json').read_text());coverage=defaultdict(Counter);cases={};blocks={};matched=tail=0
 tables={k:defaultdict(empty) for k in ['profile','profile-seat','dealer-position','forced-suit','lineup-context','controlled-hand-outcomes']}
 profile_blocks=defaultdict(lambda:defaultdict(empty));seat=defaultdict(lambda:defaultdict(lambda:np.zeros((2,len(FIELDS)),dtype=np.int64)));profile_control=defaultdict(lambda:defaultdict(empty));symmetry=defaultdict(lambda:defaultdict(lambda:np.zeros((2,len(FIELDS)),dtype=np.int64)))
 pair=defaultdict(lambda:defaultdict(list));cost=defaultdict(lambda:[0.,0]);all_seeds=set();strong_seeds=set();rows=[]
 for job in manifest['jobs']:
  chunk=read_chunk(job);assert chunk['jobId']==job['id'];category=job['category'];assert len(chunk['games'])==job['count']*len(job['cases']);byid={c['id']:c for c in job['cases']};group=job['group'];matched+=chunk['matchedHands'];tail+=chunk['unmatchedTailHands']
  coverage[category]['worker_seconds']+=chunk['seconds'];blockgames=defaultdict(list)
  for g in chunk['games']:blockgames[g['block']].append(g)
  for block,games in blockgames.items():
   unit=(group,block);assert unit not in blocks;blocks[unit]=1;assert len(games)==len(job['cases']);prefix=min(len(g['hands']) for g in games);signatures={};blockout=defaultdict(list)
   for g in games:
    c=byid[g['caseId']];cases[g['caseId']]=1;assert g['lineup']==c['lineup'];assert g['dealer']==(block+c['rotation'])%4;all_seeds.add(g['seed']);
    if category=='strong':strong_seeds.add(g['seed'])
    cv=coverage[category];cv['games']+=1;cv['hands']+=len(g['hands']);cv['decisions']+=g['decisions'];scores=[0,0];seen=0
    for s,p in enumerate(g['lineup']):cost[p][0]+=g['policyMs'][s];cost[p][1]+=g['policyDecisions'][s]
    team=c['focal']%2;w=int(g['winner']==team);diff=g['score'][team]-g['score'][1-team];blockout[(c['family'],c['variant'])].append((w,diff))
    for h in g['hands']:
     assert h['deal']==signatures.setdefault(h['number'],h['deal']);assert h['number']==seen+1;seen+=1;assert h['dealer']==(g['dealer']+seen-1)%4;assert sum(b['action']=='call' for b in h['bids'])==1;scores[h['result']['team']]+=h['result']['points'];assert h['bids'][-1]['seat']==h['caller'];assert h['bids'][-1]['forced']==(len(h['bids'])==8)
     for index,b in enumerate(h['bids']):
      s=b['seat'];assert s==(h['dealer']+1+index)%4;assert b['round']==(1 if index<4 else 2);assert b['forced']==(index==7);p=g['lineup'][s];rel=(s-h['dealer'])%4;v=bid_counts(h,b)
      keys={'profile':(p,), 'profile-seat':(p,s),'dealer-position':(p,rel,b['round'],b['forced']),'lineup-context':(category,p,s,rel,g['lineup'][(s+2)%4],g['lineup'][(s+1)%4],g['lineup'][(s+3)%4],b['round'],b['forced'])}
      if b['forced']:keys['forced-suit']=(p,h['suit'])
      if c['family'] in ['teams','common','val']:keys['controlled-hand-outcomes']=(category,group,c['family'],c['variant'],0 if s%2==c['focal']%2 else 1)
      for t,key in keys.items():tables[t][key]+=v
      profile_blocks[p][unit]+=v
      if c['family']=='seat' and s in (1,3):
       side=0 if s==1 else 1;components=['all','same' if g['lineup'][1]==g['lineup'][3] else 'distinct',p,f'dealer-{rel}']
       if category=='strong':components.append('batch-1' if block<160 else 'batch-2')
       for mode in ['full']+(['prefix'] if h['number']<=prefix else []):
        for component in components:seat[(category,c['variant'],component,mode)][unit][side]+=v
       profile_control[(category,c['variant'],p)][unit]+=v
      if c['family']=='symmetry' and s in (1,3):symmetry[p][unit][0 if s==1 else 1]+=v
    assert scores==g['score'];assert g['score'][g['winner']]>=10
   if category=='cross':
    teamkey=next(k for k in blockout if k[0]=='teams');hi=teamkey[1];lo=next(k[1] for k in blockout if k[0]=='common' and k[1]!=hi);tier=lo.split('-')[0]+'-vs-'+hi.split('-')[0]
    teammean=np.mean(blockout[teamkey],axis=0);common=np.mean(blockout[('common',hi)],axis=0)-np.mean(blockout[('common',lo)],axis=0)
    for kind,vals in [('teams',teammean),('common',common)]:
     for key in [tier,lo+'-vs-'+hi]:pair[(kind,key)][group].append(vals.tolist())
   elif category=='val':
    val=np.mean(blockout[('val','val')],axis=0);partner=job['cases'][0]['lineup'][2]
    for (family,p),values in blockout.items():
     if p=='val':continue
     vals=val-np.mean(values,axis=0)
     for key in [p,p+'/partner-'+partner,p+'/'+group]:pair[('val',key)][group].append(vals.tolist())
  print('Loaded',job['id'],sum(x['games'] for x in coverage.values()),flush=True) if len(blocks)%256==0 else None
 assert sum(x['games'] for x in coverage.values())==manifest['expectedGames']==41024
 for cat,cv in coverage.items():cv['cases']=len({c['id'] for j in manifest['jobs'] if j['category']==cat for c in j['cases']});cv['blocks']=sum(j['count'] for j in manifest['jobs'] if j['category']==cat)
 old_dealer=json.load(gzip.open(OUT/'dealer-position_PRE_RESET.json.gz'))
 for row in old_dealer:
  v=tables['dealer-position'][tuple(row['key'])]
  for k in FIELDS:assert int(v[I[k]])==row[k],('dealer reconciliation',row['key'],k)
 for name,t in tables.items():
  for key,v in t.items():
   assert v[I['calls']]+v[I['passes']]==v[I['opportunities']];assert v[I['made']]+v[I['euchred']]==v[I['calls']];assert v[I['voluntary_calls']]+v[I['forced_calls']]==v[I['calls']];assert v[I['loner_five']]+v[I['loner_three_four']]+v[I['loner_euchres']]==v[I['loner_attempts']];assert v[I['net_points']]==v[I['gross_points']]-2*v[I['euchred']]
  output_rows=[{'key':list(k),**counted(v)} for k,v in sorted(t.items())]
  if name=='forced-suit':
   for row in output_rows:
    total=int(tables['profile'][(row['key'][0],)][I['forced_calls']]);row['suit_selection']={'value':rate(row['calls'],total),'numerator':row['calls'],'denominator':total,'denominator_name':'all forced calls by this profile'}
  write(name+'.json.gz',output_rows)
 allcalls=sum(v[I['calls']] for v in tables['profile'].values());assert allcalls==sum(x['hands'] for x in coverage.values())
 summary={'version':'v2-reconstruction','coverage':dict(coverage),'missing':0,'errors':[],'matchedHands':matched,'unmatchedTailHands':tail,'independentBlocks':len(blocks),'seat':{},'profileContrasts':{},'symmetry':{},'teams':{},'common':{},'val':{},'profiles':{},'cost':{p:{'policyMilliseconds':ms,'decisions':n,'microsecondsPerDecision':1000*ms/n} for p,(ms,n) in cost.items()}}
 for key,byblock in seat.items():
  primary=key[2:] == ('all','full');summary['seat']['/'.join(key)]={metric:ratio_ci(list(byblock.values()),I[n],I[d],str(key)+metric,paired=True,primary=primary and metric=='voluntary_call_rate') for metric,(n,d) in RATES.items() if metric in ['voluntary_call_rate','make_rate','net_points_per_call']}
 for (cat,variant,p),byblock in profile_control.items():
  base=cat+'-balanced'
  if p==base:continue
  other=profile_control[(cat,variant,base)];units=sorted(set(byblock)&set(other));rows=np.array([[other[u],byblock[u]] for u in units]);summary['profileContrasts'][f'{cat}/{variant}/{p}-minus-{base}']=ratio_ci(rows,I['voluntary_calls'],I['voluntary_opportunities'],cat+variant+p,paired=True)
 for p,b in symmetry.items():summary['symmetry'][p]=ratio_ci(list(b.values()),I['voluntary_calls'],I['voluntary_opportunities'],p+'symmetry',paired=True)
 for (kind,key),strata in pair.items():
  primary=key in ['casual-vs-strong','strong-vs-expert','casual-vs-expert'] if kind!='val' else '/' not in key
  summary[kind][key]={metric:mean_ci({g:[r[i] for r in v] for g,v in strata.items()},key+metric,primary=primary and metric=='win') for i,metric in enumerate(['win','score'])}
 for p,byblock in profile_blocks.items():
  stats=counted(tables['profile'][(p,)]);stats['uncertainty']={metric:ratio_ci(list(byblock.values()),I[n],I[d],p+metric,rare=metric in ['loner_euchre_rate','loner_five_rate']) for metric,(n,d) in RATES.items()};summary['profiles'][p]=stats
 # Independently compare restored complete counts and all primary point estimates with surviving original analysis.
 original=json.loads((OUT/'analysis-final.json').read_text());verified=[]
 for cat,cv in original['coverage'].items():
  for k in ['games','hands','decisions','cases','blocks']:assert summary['coverage'][cat][k]==cv[k],(cat,k)
 for key,old in original['primarySeat'].items():assert abs(summary['seat'][key]['voluntary_call_rate']['estimate']-old['estimate'])<1e-14;verified.append('seat/'+key)
 for kind in ['teams','common','val']:
  for key,row in original[kind].items():
   for metric,x in row.items():assert abs(summary[kind][key][metric]['estimate']-x['estimate'])<1e-14;verified.append(kind+'/'+key+'/'+metric)
 def simulation_seed(base,index):
  n=(base+(index+1)*0x9e3779b9)&0xffffffff;n=((n^(n>>16))*0x85ebca6b)&0xffffffff;n=((n^(n>>13))*0xc2b2ae35)&0xffffffff;return (n^(n>>16))&0xffffffff
 old_seeds={simulation_seed(b,i) for b in [20260924,20260924^0x6d2b79f5] for i in range(250)}
 assert not strong_seeds.intersection(old_seeds)
 summary['strongSeedIsolation']={'freshDistinctSeeds':len(strong_seeds),'originalDistinctSeeds':len(old_seeds),'overlap':0}
 assert len(all_seeds)==len(blocks),'Independent group/block seed collision'
 summary['recoveryVerification']={'allCategoryCountsMatchOriginal':True,'matchedPrimaryEstimates':verified,'note':'Costs change on rerun. Bootstrap seed labels are explicit in the analysis source; original intervals remain in analysis-final.json.'}
 write('summary.json',summary);write('recovery-verification.json',summary['recoveryVerification']);print('COMPLETE',sum(x['games'] for x in coverage.values()),sum(x['hands'] for x in coverage.values()),'blocks',len(blocks),'matched',matched,'tails',tail,flush=True)
 # Tactical outcomes are conditional continuations, never an optimality label.
 f=json.load(gzip.open(OUT/'fixtures.json.gz'));obs=f['tactical']['observations'];t={'games':len(f['tactical']['games']),'views':len(obs),'contexts':dict(Counter(k for o in obs for k in o['contexts'])),'lonerHands':len(f['loners']),'lonerOutcomes':dict(Counter(o['result']['reason'] for o in f['loners'])),'disagreements':{},'conditionalCosts':[]}
 for p in ['strong-balanced','strong-conservative','strong-assertive','strong-partnership']:
  t['disagreements'][p]=sum(o['choices'][0]['action']!=next(c['action'] for c in o['choices'] if c['profile']==p) for o in obs)
  for o in obs:
   v=o['choices'][0];c=next(c for c in o['choices'] if c['profile']==p)
   if v['outcome']['net']<c['outcome']['net']:t['conditionalCosts'].append({'seed':o['seed'],'hand':o['hand'],'decision':o['decision'],'seat':o['view']['seat'],'contexts':o['contexts'],'val':v,'alternative':c})
 def effective(card,trump):
  suit,rank=card.split(':');mate={'clubs':'spades','spades':'clubs','hearts':'diamonds','diamonds':'hearts'};return trump if rank=='J' and suit==mate[trump] else suit
 def trick_winner(plays,trump):
  led=effective(plays[0]['card'],trump)
  def value(play):
   card=play['card'];su,ra=card.split(':');ef=effective(card,trump)
   return (100 if ef==trump else 50 if ef==led else 0)+(8 if ra=='J' and su==trump else 7 if ra=='J' and ef==trump else ['9','10','J','Q','K','A'].index(ra))
  return max(plays,key=value)['seat']
 t['behavior']={}
 for p in ['val','strong-balanced','strong-conservative','strong-assertive','strong-partnership']:
  b=Counter()
  for o in obs:
   v=o['view'];choice=next(c for c in o['choices'] if c['profile']==p);action=choice['action']
   for context in o['contexts']:
    b[context+'_opportunities']+=1
    if action['type']!='play':continue
    if context=='partner-winning' and trick_winner(v['trick']+[{'seat':v['seat'],'card':action['card']}],v['trump'])==v['seat']:b['partner_overtakes']+=1
    if context=='trump-conservation' and effective(action['card'],v['trump'])==v['trump']:b['trump_plays']+=1
    if context=='lead' and effective(action['card'],v['trump'])==v['trump']:b['trump_leads']+=1
    if context=='partner-return':
     previous=[tr for tr in v['completedTricks'] if tr['plays'][0]['seat']==(v['seat']+2)%4 and tr['winner']%2==v['seat']%2]
     if any(effective(action['card'],v['trump'])==effective(tr['plays'][0]['card'],v['trump']) for tr in previous):b['partner_suit_returns']+=1
  t['behavior'][p]=dict(b)
 write('tactical-summary.json',t)
if __name__=='__main__':main()
