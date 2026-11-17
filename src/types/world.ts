export type Lang = 'ar' | 'en';

export type BuildingCategory =
  | 'infrastructure'
  | 'agriculture'
  | 'factory'
  | 'energy'
  | 'civic'
  | 'science'
  | 'health';

export type BuildingStatus = 'planned' | 'constructing' | 'completed';

export type DecisionCategory =
  | 'infrastructure'
  | 'ecology'
  | 'economy'
  | 'society'
  | 'science';

export type DecisionStatus = 'active' | 'closed' | 'approved' | 'rejected';

export type NewsCategory = 'announcement' | 'milestone' | 'directive' | 'ecology';

export type EventSeverity = 'positive' | 'neutral' | 'warning';

export interface ResourceEffects {
  population?: number;
  food?: number;
  water?: number;
  energy?: number;
  treasury?: number;
  health?: number;
  education?: number;
  happiness?: number;
}

export interface SimulationBreakdown {
  dayNumber: number;
  populationDelta: number;
  foodConsumed: number;
  waterConsumed: number;
  productionTotals: ResourceEffects;
  upkeepTotals: ResourceEffects;
  decisionEffects: ResourceEffects;
  eventEffects: ResourceEffects;
  eventTitleEn: string;
  eventTitleAr: string;
}

export interface Civilization {
  id: string;
  nameEn: string;
  nameAr: string;
  islandNameEn: string;
  islandNameAr: string;
  eraEn: string;
  eraAr: string;
  dayNumber: number;
  level: number;
  population: number;
  food: number;
  water: number;
  energy: number;
  treasury: number;
  health: number;
  education: number;
  happiness: number;
  simVersion?: number;
  lastSimulationSummary?: SimulationBreakdown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Building {
  id: string;
  civId: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  category: BuildingCategory;
  status: BuildingStatus;
  progress: number;
  level: number;
  xPercent: number;
  yPercent: number;
  dailyOutput?: ResourceEffects;
  dailyUpkeep?: ResourceEffects;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DecisionBuildingBlueprint {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  category: BuildingCategory;
  status?: BuildingStatus;
  progress?: number;
  xPercent: number;
  yPercent: number;
  dailyOutput?: ResourceEffects;
  dailyUpkeep?: ResourceEffects;
}

export interface DecisionOption {
  id: string;
  labelEn: string;
  labelAr: string;
  summaryEn: string;
  summaryAr: string;
  effects: ResourceEffects;
  spawnBuilding?: DecisionBuildingBlueprint;
}

export interface Decision {
  id: string;
  civId: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  category: DecisionCategory;
  status: DecisionStatus;
  options: DecisionOption[];
  winningOptionId?: string;
  endsAt: { toDate: () => Date; seconds: number } | Date;
  approvedAt?: { toDate: () => Date; seconds: number } | Date;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Vote {
  userId: string;
  decisionId: string;
  optionId: string;
  createdAt?: unknown;
}

export interface ChronicleEntry {
  id: string;
  civId: string;
  decisionId?: string;
  dayNumber: number;
  titleEn: string;
  titleAr: string;
  outcomeEn: string;
  outcomeAr: string;
  winningOptionEn: string;
  winningOptionAr: string;
  totalVotes: number;
  winningPercentage: number;
  imageUrl: string;
  effects: ResourceEffects;
  executedAt?: { toDate: () => Date; seconds: number } | Date;
  createdBy: string;
}

export interface IslandEvent {
  id: string;
  civId: string;
  dayNumber: number;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  severity: EventSeverity;
  effects: ResourceEffects;
  breakdown: SimulationBreakdown;
  triggeredAt?: { toDate: () => Date; seconds: number } | Date;
  createdBy: string;
}

export interface NewsBulletin {
  id: string;
  civId: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  category: NewsCategory;
  createdBy: string;
  publishedAt?: { toDate: () => Date; seconds: number } | Date;
}

export interface CitizenWorldPosition {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface CitizenProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  citizenshipNumber?: number;
  citizenshipCode?: string;
  professionEn?: string;
  professionAr?: string;
  coins?: number;
  assets?: string[];
  xp?: number;
  level?: number;
  avatarColor?: string;
  worldPosition?: CitizenWorldPosition;
  isOnline?: boolean;
  votesCount: number;
  participationsCount: number;
  role: 'citizen' | 'admin' | 'founder';
  status: 'active' | 'suspended';
  lastVotedDecisionId: string;
  joinedAt?: { toDate: () => Date; seconds: number } | Date;
  lastActiveAt?: { toDate: () => Date; seconds: number } | Date;
}

export interface WorldRegistryCounter {
  id: string;
  totalRegistered: number;
  nextCitizenSeq: number;
  updatedAt?: { toDate: () => Date; seconds: number } | Date;
}

export interface WorldPresence {
  uid: string;
  displayName: string;
  citizenshipCode: string;
  professionEn: string;
  professionAr: string;
  avatarColor: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  isOnline: boolean;
  isInWorld: boolean;
  lastSeenAt?: { toDate: () => Date; seconds: number } | Date;
}

