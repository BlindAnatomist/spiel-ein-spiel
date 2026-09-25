import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundCues } from '../web/sound.ts';

class FakeParam {
  value=0;
  events:Array<{kind:'set'|'ramp';value:number;time:number}>=[];
  setValueAtTime(value:number,time:number){this.value=value;this.events.push({kind:'set',value,time});}
  linearRampToValueAtTime(value:number,time:number){this.value=value;this.events.push({kind:'ramp',value,time});}
}
class FakeOscillator {
  type:OscillatorType='sine';
  frequency=new FakeParam();
  onended:(()=>void)|null=null;
  starts:number[]=[];
  stops:number[]=[];
  connect(){}
  disconnect(){}
  start(time:number){this.starts.push(time);}
  stop(time?:number){this.stops.push(time ?? -1);}
}
class FakeGain {
  gain=new FakeParam();
  connect(){}
  disconnect(){}
}
class FakeContext {
  state:AudioContextState='suspended';
  currentTime=10;
  destination={};
  resumeCalls=0;
  oscillators:FakeOscillator[]=[];
  gains:FakeGain[]=[];
  async resume(){this.resumeCalls++;this.state='running';}
  createOscillator(){const o=new FakeOscillator();this.oscillators.push(o);return o;}
  createGain(){const g=new FakeGain();this.gains.push(g);return g;}
}

test('enabling sound resumes audio explicitly and supports an audible confirmation pattern', async () => {
  const context=new FakeContext();
  const cues=createSoundCues(()=>context as unknown as AudioContext);
  assert.equal(await cues.setEnabled(true),true);
  assert.equal(context.resumeCalls,1);
  cues.play('enabled');
  assert.equal(context.oscillators.length,2);
  assert.ok(context.gains.some(g=>g.gain.events.some(e=>e.kind==='ramp'&&e.value>=0.06)));
  assert.ok(context.oscillators.every(o=>o.type==='triangle'));
});

test('card, trick and result cues are short scheduled patterns and never await playback', async () => {
  const context=new FakeContext();
  const cues=createSoundCues(()=>context as unknown as AudioContext);
  await cues.setEnabled(true);
  const counts:Record<string,number>={card:1,trick:2,'hand-win':3,'hand-loss':2,'game-win':4,'game-loss':3};
  for(const [cue,count] of Object.entries(counts)){
    const before=context.oscillators.length;
    cues.play(cue as Parameters<typeof cues.play>[0]);
    assert.equal(context.oscillators.length-before,count,cue);
  }
  const longest=Math.max(...context.oscillators.flatMap(o=>o.stops.map((stop,i)=>stop-o.starts[i]!)));
  assert.ok(longest<=0.20);
});

test('disabling sound immediately prevents future cues', async () => {
  const context=new FakeContext();
  const cues=createSoundCues(()=>context as unknown as AudioContext);
  await cues.setEnabled(true);
  cues.play('trick');
  const before=context.oscillators.length;
  assert.equal(await cues.setEnabled(false),false);
  cues.play('game-win');
  assert.equal(context.oscillators.length,before);
});
