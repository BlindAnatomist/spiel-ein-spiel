import importlib.util,unittest,numpy as np
from pathlib import Path
s=importlib.util.spec_from_file_location('analysis',Path(__file__).with_name('analyze-bot-validation.py'));a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
class Statistics(unittest.TestCase):
 def test_undefined(self):self.assertIsNone(a.rate(0,0));self.assertEqual(a.rate(0,1),0)
 def test_forced_loss(self):
  v=a.bid_counts({'alone':True,'result':{'reason':'euchred','makerTricks':2,'points':2}}, {'action':'call','forced':True,'round':2});d=a.counted(v);self.assertEqual(d['net_points'],-2);self.assertEqual(d['gross_points'],0);self.assertEqual(d['voluntary_opportunities'],0);self.assertIsNone(d['rates']['voluntary_call_rate']['value']);self.assertEqual(d['loner_euchres'],1)
 def test_loner_distinctions(self):
  for n in [3,4,5]:
   v=a.bid_counts({'alone':True,'result':{'reason':'loner-march' if n==5 else 'made','makerTricks':n,'points':4 if n==5 else 1}},{'action':'call','forced':False,'round':1});self.assertEqual(v[a.I['loner_five']],n==5);self.assertEqual(v[a.I['loner_three_four']],n!=5)
 def test_matched_ratio(self):
  rows=[[[1,2],[2,2]],[[4,8],[4,8]]];r=a.ratio_ci(rows,0,1,'matched',paired=True);self.assertAlmostEqual(r['estimate'],.1);self.assertEqual(r['blocks'],2)
 def test_repeated_observations(self):
  rows=np.array([[1,2],[4,8]]);r=a.ratio_ci(rows,0,1,'repetition');q=a.ratio_ci(rows*100,0,1,'repetition');self.assertEqual(r['ci95'],q['ci95']);self.assertEqual(q['blocks'],2)
 def test_fixed_context_weights(self):
  r=a.mean_ci({'a':[0]*2,'b':[1]*20},'strata');self.assertEqual(r['estimate'],.5);self.assertEqual(r['ci95'],[.5,.5])
 def test_unseen_risk(self):
  r=a.ratio_ci([[0,10],[0,20]],0,1,'rare',rare=True);self.assertEqual(r['estimate'],0);self.assertIsNone(r['ci95']);self.assertTrue(r['sparse'])
if __name__=='__main__':unittest.main()
