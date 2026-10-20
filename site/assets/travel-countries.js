// Edit this file to update Rustin's travel map. Use ISO two-letter country/territory codes.
// Each distinct code counts as one destination; upcoming trips do not add to the count.
// GB covers England and Scotland. HK, MO, TW and PR are tracked separately.
window.RUSTIN_TRAVEL = {
  visited: [
    "AE", "AF", "AT", "BE", "BS", "CA", "CN", "CO", "DE", "EE", "EG", "ES", "FI", "FJ",
    "FR", "GB", "GR", "HK", "ID", "IN", "IT", "JM", "JP", "KG", "MA", "MO", "MX", "NL", "NO", "NZ",
    "PA", "PE", "PH", "PL", "PR", "PT", "RU", "SA", "SE", "SG", "TW", "US", "VN"
  ],
  countryNotes: { GB: "England & Scotland" },
  showUpcoming: true,
  // Countries explicitly named in Upcoming Adventures. Cruise stops are not assumed.
  upcoming: ["US", "JP", "CL", "AQ"]
};
