import {test,expect} from '@playwright/test';
import {getScoreBreakdown} from '../src/score';
import {getLevel,chooseCandidate,minimumDifficulty} from '../src/infiniteLevels';
import {analyzePuzzle} from '../src/puzzleEngine';

test('canonical score formula covers all bonuses and clamps',()=>{
 expect(getScoreBreakdown(8,77,0,false)).toEqual({board:4992,speed:1541,clean:950,independence:280,total:7763});
 expect(getScoreBreakdown(8,77,0,true)).toEqual({board:4992,speed:1541,clean:500,independence:0,total:7033});
 for(const mistakes of [1,2,3])expect(getScoreBreakdown(5,999,mistakes,false)).toEqual({board:1950,speed:0,clean:Math.max(0,360-mistakes*120),independence:280,total:2230+Math.max(0,360-mistakes*120)});
});
test('difficulty selection prefers the floor and falls back to the hardest',()=>{
 const base=getLevel(0),candidates=[100,280,500].map(logicalScore=>({...base,logicalScore}));
 expect(chooseCandidate(candidates,400,false,5)?.logicalScore).toBe(500);
 expect(chooseCandidate(candidates,900,true,9)?.logicalScore).toBe(500);
 expect(chooseCandidate([],900,true,9)).toBeNull();
 expect(minimumDifficulty(10,true,9)).toBe(900);
});
test('late generated puzzles and Moon Runs meet progression floors',async({},testInfo)=>{
 test.skip(testInfo.project.name!=='chromium','Pure generator suite runs once');test.setTimeout(180000);
 const early=[24,25,26].map(i=>getLevel(i).logicalScore);
 for(const i of [33,40,43,49,53]){
  const l=getLevel(i),analysis=analyzePuzzle(l.regions);
  expect(analysis.solutionCount).toBe(1);expect(analysis.logicalSolved).toBe(true);
  expect(analysis.logicalScore).toBe(l.logicalScore);
  expect(l.logicalScore).toBeGreaterThanOrEqual(l.special==='moon-run'?900:430);
  expect(l.logicalScore).toBeGreaterThan(Math.max(...early));
 }
});
