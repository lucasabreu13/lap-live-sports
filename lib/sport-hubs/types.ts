import type { NewsItem, ScoreItem, SportDefinition, SportId } from "@/lib/live-data";
import type { EspnCalendarItem, EspnStandingGroup } from "@/lib/providers/espn-provider";
import type { ProviderStatus } from "@/lib/providers/provider-types";

export type SportHubLayout = "team" | "tour" | "race" | "combat" | "event";

export type SportHubEntity = {
  title: string;
  category: string;
  description: string;
};

export type SportHubGuideItem = {
  title: string;
  value: string;
  description: string;
};

export type SportHubConfig = {
  sportId: SportId;
  layout: SportHubLayout;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCompetition: string;
  eventPaths: string[];
  standingsPath?: string;
  rankingProvider?: "standings" | "golf-leaderboard";
  rankingTitle: string;
  rankingDescription: string;
  entityTitle: string;
  entityDescription: string;
  entities: SportHubEntity[];
  guide: SportHubGuideItem[];
  spotlight?: { title: string; text: string };
  emptyEventMessage: string;
};

export type SportHubDetails = {
  sport: SportDefinition;
  config: SportHubConfig;
  events: ScoreItem[];
  live: ScoreItem[];
  upcoming: ScoreItem[];
  recent: ScoreItem[];
  calendar: EspnCalendarItem[];
  standings: EspnStandingGroup[];
  news: NewsItem[];
  generatedAt: string;
  availability: {
    events: ProviderStatus;
    calendar: ProviderStatus;
    standings: ProviderStatus;
    news: ProviderStatus;
  };
};
