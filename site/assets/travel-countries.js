// Edit this file to update Rustin's travel map. Use ISO two-letter country/territory codes.
// Each distinct code counts as one destination; upcoming trips do not add to the count.
// GB covers England and Scotland. HK, MO, TW and PR are tracked separately.
// Rustin confirmed all Caribbean countries and territories except Cuba (CU) and Haiti (HT).
// Caribbean group: UN M49, https://unstats.un.org/unsd/methodology/m49/overview/
window.RUSTIN_TRAVEL = {
  visited: [
    "AE", "AF", "AG", "AI", "AT", "AW", "BB", "BE", "BL", "BQ", "BS", "CA",
    "CN", "CO", "CW", "DE", "DM", "DO", "EE", "EG", "ES", "FI", "FJ", "FR",
    "GB", "GD", "GP", "GR", "HK", "ID", "IN", "IT", "JM", "JP", "KG", "KN",
    "KY", "LC", "MA", "MF", "MO", "MQ", "MS", "MX", "NL", "NO", "NZ", "PA",
    "PE", "PH", "PL", "PR", "PT", "RU", "SA", "SE", "SG", "SX", "TC", "TT",
    "TW", "US", "VC", "VG", "VI", "VN"
  ],
  countryNotes: { GB: "England & Scotland" },
  showUpcoming: true,
  // Countries explicitly named in Upcoming Adventures. Cruise stops are not assumed.
  upcoming: ["US", "JP", "CL", "AQ"]
};
