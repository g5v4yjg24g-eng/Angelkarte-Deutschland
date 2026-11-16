// Themen der Anleitung: Symbol und Ziel je Thema (Texte stehen in de.guide.topics)
import type { ReactNode } from 'react';
import {
  BookIcon,
  ClockIcon,
  DatabaseIcon,
  FeedIcon,
  FishIcon,
  IdCardIcon,
  KnotIcon,
  MapIcon,
  ParagraphIcon,
  WeatherIcon,
} from '../../design/icons';
import type { GuideId } from '../../domain/guide';

export const GUIDE_ROUTE: Record<GuideId, string> = {
  map: '/',
  catch: '/',
  book: '/fangbuch',
  sessions: '/fangbuch/sessions',
  weather: '/wetter',
  law: '/mehr/recht',
  papers: '/mehr/papiere',
  knots: '/mehr/knoten',
  community: '/feed',
  backup: '/mehr/daten',
};

export function guideIcon(id: GuideId, size = 24): ReactNode {
  switch (id) {
    case 'map':
      return <MapIcon size={size} />;
    case 'catch':
      return <FishIcon size={size} />;
    case 'book':
      return <BookIcon size={size} />;
    case 'sessions':
      return <ClockIcon size={size} />;
    case 'weather':
      return <WeatherIcon size={size} />;
    case 'law':
      return <ParagraphIcon size={size} />;
    case 'papers':
      return <IdCardIcon size={size} />;
    case 'knots':
      return <KnotIcon size={size} />;
    case 'community':
      return <FeedIcon size={size} />;
    case 'backup':
      return <DatabaseIcon size={size} />;
  }
}
