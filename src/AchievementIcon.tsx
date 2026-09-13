import { Brain, Cat, CircleHelp, Crown, House, Moon, PawPrint, Sparkles, Sun } from 'lucide-react';
export function AchievementIcon({id,secret=false}:{id:string;secret?:boolean}){
 const Icon=secret?CircleHelp:({first:PawPrint,ten:House,clean:Sparkles,instinct:Brain,'big-cat':Cat,'daily-first':Sun,apex:Crown,perfect:Sparkles,'no-hint':Brain,'moon-run':Moon,daily:Sun} as const)[id]??PawPrint;
 return <Icon size={20} strokeWidth={1.8} aria-hidden="true"/>;
}
