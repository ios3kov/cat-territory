import { getLevel, getDailyLevel } from './infiniteLevels';
self.onmessage = (event:MessageEvent<{index?:number;dateKey?:string}>) => {
  try { self.postMessage({level:event.data.dateKey?getDailyLevel(event.data.dateKey):getLevel(event.data.index!)}); }
  catch(error) { self.postMessage({error:error instanceof Error?error.message:'Unable to create territory.'}); }
};
