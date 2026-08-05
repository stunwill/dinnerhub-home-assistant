const nativeToISOString = Date.prototype.toISOString;

/**
 * DinnerHub plans meals by local calendar date, not UTC date.
 *
 * The existing frontend date helper builds a Date in local time and then calls
 * toISOString(). In positive UTC offsets, that can turn early-morning local
 * dates into the previous UTC calendar day. Shift by the browser timezone
 * offset before serialising so date-only values remain on the user's local day.
 */
Date.prototype.toISOString = function dinnerHubLocalISOString(): string {
  const localWallClock = new Date(this.getTime() - this.getTimezoneOffset() * 60_000);
  return nativeToISOString.call(localWallClock);
};
