import test from 'node:test';
import assert from 'node:assert/strict';
import { auditBotProfiles } from '../src/audit/bots.ts';

test('bot profile audit balances every strong strategy across left and right seats', () => {
  const gamesPerCase = 4;
  const report = auditBotProfiles({ tier: 'strong', gamesPerCase, seed: 20260924 });

  assert.equal(report.sameProfileSeatAudit.length, 4);
  assert.equal(report.roundRobin.length, 4);
  assert.equal(report.totalGames, 16 * gamesPerCase);
  assert.deepEqual(report.fixedTeam, { seat0: 'Balanced Strong', seat2: 'Val' });

  for (const profile of report.sameProfileSeatAudit) {
    assert.equal(profile.left.games, gamesPerCase);
    assert.equal(profile.right.games, gamesPerCase);
    assert.ok(profile.left.calls <= profile.left.opportunities);
    assert.ok(profile.right.calls <= profile.right.opportunities);
    assert.equal(profile.left.calls, profile.left.made + profile.left.euchred);
    assert.equal(profile.right.calls, profile.right.made + profile.right.euchred);
  }

  for (const profile of report.roundRobin) {
    assert.equal(profile.left.games, 3 * gamesPerCase);
    assert.equal(profile.right.games, 3 * gamesPerCase);
    assert.equal(profile.combined.games, 6 * gamesPerCase);
    assert.equal(profile.combined.calls, profile.combined.made + profile.combined.euchred);
    assert.ok(profile.combined.voluntaryCalls <= profile.combined.voluntaryOpportunities);
  }
});

test('bot profile audit is deterministic for a fixed seed', () => {
  const options = { tier: 'strong' as const, gamesPerCase: 2, seed: 77 };
  assert.deepEqual(auditBotProfiles(options), auditBotProfiles(options));
});

test('bot profile audit rejects invalid counts and tiers with too few profiles', () => {
  assert.throws(() => auditBotProfiles({ tier: 'strong', gamesPerCase: 0, seed: 1 }), /positive/);
});
