'use client';
import Phonetic from './Phonetic';
import SocialLinksGrid from './SocialLinksGrid';
import { LightRays } from '@/registry/magicui/light-rays';
import {
  Terminal,
  TypingAnimation,
  AnimatedSpan,
} from '@/registry/magicui/terminal';
export default function AboutHero() {
  return (
    <main className="relative mx-auto max-w-3xl px-6 pt-24 pb-16">
      <LightRays />
      <div className="mb-10">
        <h1 className="text-4xl font-bold font-family:'Rock Salt', cursive">
          Miles
        </h1>
        <Phonetic
          ipa="Front-end development engineer who is improving his skills"
          className="mt-1 block"
        />
      </div>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        {/* <p>
          <strong>Urmzd</strong> derives from <em>Ahura Mazda</em> — the Avestan
          name meaning "Lord of Wisdom." It's a name rooted in Zoroastrian
          tradition, carried across Central Asia into Tajik and Persian cultures
          where my family originates.
        </p>

        <p>
          I'm a software engineer based in Austin, Texas. I build tools that
          turn structured thinking into working software — from developer
          utilities and machine learning pipelines to interactive web
          experiences like this site. When I'm not writing code, I'm likely on
          the mats training Brazilian Jiu-Jitsu or exploring a new city. For the
          full story, check out my <a href="/blog/welcome">welcome post</a>.
        </p> */}
        <div className="flex justify-center">
          <Terminal>
            <TypingAnimation>&gt; fetch profile --user "Miles"</TypingAnimation>
            <AnimatedSpan className="text-green-500 text-sm md:text-base">
              ✔ Initializing bio metadata...
            </AnimatedSpan>
            <AnimatedSpan className="text-green-500 text-sm md:text-base">
              ✔ Syncing skill sets: [Html, Css, JavaScript,TypeScript,Vue3,
              React, Astro, Tailwind CSS, Go, Java]
            </AnimatedSpan>
            <TypingAnimation>Success! Profile metadata synced.</TypingAnimation>
          </Terminal>
        </div>
        <h2>Get in Touch</h2>
        <SocialLinksGrid />
      </div>
    </main>
  );
}
