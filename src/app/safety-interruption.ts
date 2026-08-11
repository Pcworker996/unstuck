const DIRECT_DANGER_PATTERN = new RegExp(
  "\\b(?:hurt(?:ing)?|harm(?:ing)?|kill(?:ing)?|shoot(?:ing)?|stab(?:bing)?|attack(?:ing)?|poison(?:ing)?)\\s+(?:myself|someone|someone else|another person|another|a person|anyone|people|others|other people|them|him|her|a stranger|stranger|my (?:child|kid|partner|wife|husband|daughter|son|neighbor|spouse|friend|parent|sibling|family|roommate|coworker|manager)|(?:their|the) (?:child|kid|partner|wife|husband|daughter|son|neighbor|spouse|friend|parent|sibling|family|roommate|coworker|manager))\\b",
  "i"
);

const SELF_DANGER_PATTERN = /\b(?:end my life|suicid[a-z]*|want to die|take my life|overdose)\b/i;
const UNSAFE_PATTERN = /\b(?:do not|don't)\s+feel\s+safe\b|\b(?:not safe|unsafe)\s+(?:right )?now\b|\b(?:currently|now)\s+unsafe\b|\bfeel\s+unsafe\s+(?:right now|at the moment|currently)\b/i;
const NEGATED_DANGER_PATTERN = /\b(?:not|never|no longer|don't|do not|won't|will not|wouldn't|would not)\s+(?:(?:want|plan|going)\s+to\s+)?(?:hurt(?:ing)?|harm(?:ing)?|kill(?:ing)?|shoot(?:ing)?|stab(?:bing)?|attack(?:ing)?|poison(?:ing)?|die|suicid[a-z]*|overdose)\b|\b(?:don't|do not)\s+feel\s+unsafe\b|\b(?:not|no|never)\s+(?:in\s+)?immediate danger\b|\b(?:not|no longer)\s+unsafe\b/gi;
const IMMEDIATE_DANGER_PATTERN = /\b(?:in\s+)?immediate danger\b/i;
const CURRENT_CONTEXT_PATTERN = /\b(?:right now|now|currently|today|tonight|immediately|at this moment)\b/i;
const CURRENT_INTENT_PATTERN = /\b(?:(?:might|may|could)(?!\s+have\b)|want to|plan to|going to|about to|will|thinking about|considering)\b/i;
const HISTORICAL_CONTEXT_PATTERN = /\b(?:yesterday|last night|last week|last year|earlier|in the past|used to)\b/i;
const PAST_DANGER_PATTERN = /\b(?:(?:might|may|could)\s+have|have|has|had|was|were)\s+(?:hurt|harmed?|killed?|shot|stabbed?|attacked?|poisoned?)\b/i;
const HISTORICAL_INTENT_PATTERN = /\b(?:was|were|had|used to)\s+(?:going to|planning to|thinking about|considering)\b/i;
const HISTORICAL_SELF_DANGER_PATTERN = /\b(?:had|was|were|used to)\s+(?:suicid[a-z]*|thoughts? of (?:dying|suicide))\b/i;
const SAFE_NOW_PATTERN = /\b(?:safe|not in danger|no longer unsafe)\s+now\b/i;
const LIVE_CONTRADICTION_PATTERN = /\b(?:but|however|though|and)\s+(?:i\s+)?(?:might|may|could|want to|plan to|going to|about to|will)\b/i;

export function indicatesImmediateDanger(quickDump: string): boolean {
  if (
    DIRECT_DANGER_PATTERN.test(quickDump) &&
    LIVE_CONTRADICTION_PATTERN.test(quickDump)
  ) {
    return true;
  }

  const actionableText = quickDump.replace(NEGATED_DANGER_PATTERN, " ");

  if (
    UNSAFE_PATTERN.test(actionableText) ||
    (IMMEDIATE_DANGER_PATTERN.test(actionableText) &&
      !HISTORICAL_CONTEXT_PATTERN.test(actionableText))
  ) {
    return true;
  }

  const directDanger = DIRECT_DANGER_PATTERN.test(actionableText);
  const selfDanger = SELF_DANGER_PATTERN.test(actionableText);
  if (!directDanger && !selfDanger) {
    return false;
  }

  const historicalScope =
    HISTORICAL_CONTEXT_PATTERN.test(actionableText) ||
    PAST_DANGER_PATTERN.test(actionableText) ||
    HISTORICAL_INTENT_PATTERN.test(actionableText) ||
    HISTORICAL_SELF_DANGER_PATTERN.test(actionableText);
  const currentIntent =
    CURRENT_INTENT_PATTERN.test(actionableText) &&
    !HISTORICAL_INTENT_PATTERN.test(actionableText);

  if (
    historicalScope &&
    !CURRENT_CONTEXT_PATTERN.test(actionableText) &&
    !currentIntent &&
    !SAFE_NOW_PATTERN.test(actionableText)
  ) {
    return false;
  }

  if (SAFE_NOW_PATTERN.test(actionableText) && historicalScope && !currentIntent) {
    return false;
  }

  return true;
}
