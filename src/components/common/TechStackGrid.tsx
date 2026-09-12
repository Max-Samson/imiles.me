'use client';

import {
  SiDocker,
  SiEsbuild,
  SiGithubactions,
  SiGo,
  SiGooglechrome,
  SiKeras,
  SiNodedotjs,
  SiOpencv,
  SiPostgresql,
  SiPython,
  SiPytorch,
  SiReact,
  SiRust,
  SiSqlite,
  SiSvg,
  SiTailwindcss,
  SiTypescript,
  SiVite,
  SiVuedotjs,
  SiWails,
} from '@icons-pack/react-simple-icons';
import { BarChart3 } from 'lucide-react';
import { motion, useInView } from 'motion/react';
import { useRef } from 'react';
import type { ProjectTech } from '@/data/projects';
import { type Locale, useTranslations } from '@/lib/i18n';

const iconMap: Record<string, React.ReactNode> = {
  go: <SiGo className="h-8 w-8" />,
  react: <SiReact className="h-8 w-8" />,
  typescript: <SiTypescript className="h-8 w-8" />,
  vue: <SiVuedotjs className="h-8 w-8" />,
  vite: <SiVite className="h-8 w-8" />,
  tailwindcss: <SiTailwindcss className="h-8 w-8" />,
  googlechrome: <SiGooglechrome className="h-8 w-8" />,
  rust: <SiRust className="h-8 w-8" />,
  python: <SiPython className="h-8 w-8" />,
  nodedotjs: <SiNodedotjs className="h-8 w-8" />,
  sqlite: <SiSqlite className="h-8 w-8" />,
  githubactions: <SiGithubactions className="h-8 w-8" />,
  pytorch: <SiPytorch className="h-8 w-8" />,
  opencv: <SiOpencv className="h-8 w-8" />,
  keras: <SiKeras className="h-8 w-8" />,
  docker: <SiDocker className="h-8 w-8" />,
  postgresql: <SiPostgresql className="h-8 w-8" />,
  echarts: <BarChart3 className="h-8 w-8" />,
  wails: <SiWails className="h-8 w-8" />,
  esbuild: <SiEsbuild className="h-8 w-8" />,
  svg: <SiSvg className="h-8 w-8" />,
  cordis: <span className="text-xl font-bold tracking-tight">Cordis</span>,
  nltk: <span className="text-2xl font-bold">N</span>,
};

interface TechStackGridProps {
  tech: ProjectTech[];
  lang?: Locale;
}

export default function TechStackGrid({ tech, lang }: TechStackGridProps) {
  const { t } = useTranslations(lang);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section ref={ref} className="container mx-auto px-4 py-12">
      <h2 className="mb-8 text-2xl font-bold">{t('NoteSectionFourTitle')}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tech.map((tItem, index) => (
          <motion.div
            key={tItem.name}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className="tech-stack-card"
          >
            <div className="tech-stack-icon">{iconMap[tItem.icon || '']}</div>
            <span className="text-sm font-medium">{tItem.name}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
