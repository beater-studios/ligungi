export interface UserRef {
  readonly id: string;
  readonly name: string;
}

export interface Opponent {
  readonly name: string;
  readonly user: UserRef | null;
  readonly rating: number | null;
}
