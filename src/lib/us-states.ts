/** Two-letter US state codes (50 + DC excluded — workbook never uses DC). */
export const VALID_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
  "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
  "TX","UT","VT","VA","WA","WV","WI","WY",
]);

export function isValidState(code: unknown): code is string {
  return typeof code === "string" && VALID_STATES.has(code);
}
