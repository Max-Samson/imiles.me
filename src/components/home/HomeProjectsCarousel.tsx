'use client';

import ExpandingCarousel, {
  type ExpandingCarouselItem,
  type ExpandingCarouselProps,
} from '@/components/ui/expanding-carousel';
import { Floating3DParticles } from '@/registry/magicui/floating-3d-particles';

type HomeProjectsCarouselProps = Omit<ExpandingCarouselProps, 'renderMedia'>;

/** Supplies the project's live demo through the carousel media slot. */
export default function HomeProjectsCarousel(props: HomeProjectsCarouselProps) {
  function renderMedia(item: ExpandingCarouselItem) {
    if (item.id === 'floating-3d-particles') {
      return <Floating3DParticles quantity={260} color="#8B5CF6" depth={0.55} drift={0.75} />;
    }

    return undefined;
  }

  return <ExpandingCarousel {...props} renderMedia={renderMedia} />;
}
