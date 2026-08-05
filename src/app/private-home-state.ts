export type PersonalAccount = {
  id: string;
  displayName: string;
};

export type PrivateHomeState =
  | { kind: "sign-in" }
  | { kind: "private-home"; person: PersonalAccount };

export function privateHomeState(
  person: PersonalAccount | undefined
): PrivateHomeState {
  if (!person) {
    return { kind: "sign-in" };
  }

  return { kind: "private-home", person };
}
