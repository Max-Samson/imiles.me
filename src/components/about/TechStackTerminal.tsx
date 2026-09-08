import { AnimatedSpan, Terminal, TypingAnimation } from '@/registry/magicui/terminal';

interface TechStackTerminalProps {
  profile: Record<string, string | string[]>;
  successMessage: string;
}

export default function TechStackTerminal({ profile, successMessage }: TechStackTerminalProps) {
  return (
    <div className="not-prose flex justify-center bg-transparent px-0 py-3 sm:p-3">
      <Terminal className="w-full max-w-xl min-h-[450px] border border-black/10 bg-white font-mono text-sm shadow-xl transition-all duration-300 sm:min-h-[480px] dark:border-white/10 dark:bg-black/90">
        <TypingAnimation delay={200} className="text-slate-500 dark:text-gray-500">
          &gt; init --stack engineer.miles.ts
        </TypingAnimation>
        <AnimatedSpan className="mt-2 block font-medium text-slate-800 dark:text-white">
          <span className="text-purple-600 dark:text-purple-400">const</span>{' '}
          <span className="text-blue-600 dark:text-blue-400">miles</span> = {'{'}
        </AnimatedSpan>
        {Object.entries(profile).map(([field, value]) => (
          <AnimatedSpan key={field} className="block pl-4 text-slate-700 sm:pl-6 dark:text-white">
            {field}: {Array.isArray(value) ? '[' : ''}
            {(Array.isArray(value) ? value : [value]).map((item, index) => (
              <span key={item}>
                {index > 0 ? ', ' : ''}
                <span className="text-orange-600 dark:text-orange-400">'{item}'</span>
              </span>
            ))}
            {Array.isArray(value) ? '],' : ','}
          </AnimatedSpan>
        ))}
        <AnimatedSpan className="block text-slate-800 dark:text-white">{'};'}</AnimatedSpan>
        <AnimatedSpan className="mt-3 flex items-center gap-2 font-bold text-emerald-600 dark:text-green-500">
          <span className="h-2 w-2 shrink-0 rounded-full bg-green-500 motion-safe:animate-pulse" />
          <span>{successMessage}</span>
        </AnimatedSpan>
        <TypingAnimation delay={3000} className="block text-slate-400 dark:text-gray-500">
          &gt; _
        </TypingAnimation>
      </Terminal>
    </div>
  );
}
