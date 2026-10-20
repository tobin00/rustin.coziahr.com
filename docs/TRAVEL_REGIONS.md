# Travel statistics: countries, other destinations, and continents

`site/assets/travel-regions.js` is the shared classification catalog for every
ISO two-letter code in `site/assets/vendor/leaflet/iso-codes.json`. It contains
249 destinations, including all 193 United Nations member states. The data is
verified as of **October 20, 2026**. It contains no visit history: Rustin's actual
visits remain in `travel-countries.js`, and friends' visits remain in their own
saved maps.

Each entry has this shape:

```javascript
window.RUSTIN_REGIONS["US"]
// { continent: "North America", unMember: true }
```

## What the totals mean

- **Countries** counts distinct visited codes with `unMember: true`. It uses the
  [UN's current membership list](https://research.un.org/en/unmembers/currentmembers)
  as a clear, reproducible counting rule. The world total under this rule is 193.
- **Other destinations** counts the remaining distinct visited ISO codes.
  This includes territories, separately tracked areas, and places outside UN
  membership. It does not claim that every place in this group is a territory.
- **Destinations** is the sum of countries and other destinations. Hong Kong,
  Macau, Taiwan, and Puerto Rico retain separate ISO codes and map selections.
- **Continents** counts the primary continent groups represented in the actual
  visited list. Planned travel never adds to any visited total. Visiting U.S.
  states does not add more countries or continents.

England, Scotland, Wales, and Northern Ireland have their own shapes in the
personal UK breakdown. England and Scotland are confirmed visited in
`travel-uk.js`; Wales and Northern Ireland are not yet recorded. These are
constituent countries of the United Kingdom, which retains one ISO destination
code (`GB`) and one UN member-country count in the world totals. The separate
**2 of 4 UK countries explored** count does not increase the 68 world destinations
or the continent totals.

This membership convention is a travel-statistics rule, not a statement about
sovereignty, borders, or recognition. The Holy See (`VA`) and State of Palestine
(`PS`) are not UN member states; Taiwan (`TW`), Cook Islands (`CK`), and Niue (`NU`)
also remain in other destinations under this specific convention.

## The seven travel-continent groups

The site uses Africa, Antarctica, Asia, Europe, North America, Oceania, and South
America. These are seven display groups derived from the
[UN Statistics Division's M49 geographic table](https://unstats.un.org/unsd/methodology/m49/overview/),
with these explicit display rules:

- M49's Americas are split into South America and North America. North America
  includes M49's Northern America, Central America, and Caribbean groups.
- Oceania includes Australia, New Zealand, Melanesia, Micronesia, and Polynesia.
  The label is Oceania because the group includes more than Australia.
- Every destination belongs to one primary group so the breakdown adds up to
  the destination total. Countries spanning regions do not count twice.
- Russia (`RU`) is Europe; Egypt (`EG`) is Africa. Türkiye (`TR`), Cyprus (`CY`),
  Kazakhstan (`KZ`), Armenia (`AM`), Azerbaijan (`AZ`), and Georgia (`GE`) are Asia,
  following M49. France (`FR`) is Europe; its separately coded destinations
  retain their own geographic groups, such as Guadeloupe (`GP`) in North America.
- Antarctica (`AQ`) is explicitly assigned Antarctica; M49 leaves its region
  fields blank. It is the only ISO destination that establishes an Antarctic
  continent visit in this conservative model.
- Taiwan (`TW`), the only catalog code absent from M49's overview table, is
  assigned Asia using the pinned Natural Earth map-unit metadata below.
- The subantarctic island codes retain M49's groups: Bouvet Island (`BV`) and
  South Georgia and the South Sandwich Islands (`GS`) are South America; Heard
  Island and McDonald Islands (`HM`) are Oceania. They do not by themselves
  establish a visit to the Antarctic continent. `SG` means Singapore, in Asia.

These are consistent statistical display groups. ISO codes do not define an
official seven-continent system, and the catalog does not infer which part of
a large or transcontinental country someone visited.

## Confirmed current totals

Rustin's 68 distinct visited codes currently give **50 countries**, **18 other
destinations**, and **6 of 7 continents**. By primary continent:

| Continent | All visited destinations |
| --- | ---: |
| Africa | 2 |
| Antarctica | 0 |
| Asia | 14 |
| Europe | 18 |
| North America | 30 |
| Oceania | 2 |
| South America | 2 |

The 18 other-destination codes are `AI`, `AW`, `BL`, `BQ`, `CW`, `GP`, `HK`, `KY`,
`MF`, `MO`, `MQ`, `MS`, `PR`, `SX`, `TC`, `TW`, `VG`, and `VI`. These totals are a
verification snapshot; the website calculates its totals from the current
visited codes and this catalog.

## Sources and preparation

The catalog is a small local asset. Visitors do not contact any source below,
and the website needs no additional service, key, or package.

1. **Geography:** the English `downloadTableEN` table at
   <https://unstats.un.org/unsd/methodology/m49/overview/>, retrieved October 20,
   2026. The table contains 248 distinct ISO alpha-2 codes. Retain its region
   and intermediate-region fields, applying the explicit display rules above.
   The downloaded HTML snapshot had SHA-256
   `b9048114f6e7f2abda83bf03d4263c9d7cd1bd7230e3d0461025ee7839a7a1fb`.
2. **Membership:** the 193 country headings, from Afghanistan through Zimbabwe,
   in the UN Dag Hammarskjöld Library's current-members page at
   <https://research.un.org/en/unmembers/currentmembers>, retrieved October 20,
   2026. Match these names to the M49 table after normalizing whitespace,
   apostrophes, and a leading “The”. Match the headings “United Kingdom” and
   “United States” to `GB` and `US`. All 193 headings matched one distinct ISO
   code. The downloaded HTML snapshot had SHA-256
   `53328d2f8a364da3969dba313057315b7250e0ec386a18f090a41dfabce448d3`.
3. **Taiwan's geographic group:** Natural Earth map units at pinned commit
   [`117488dc884bad03366ff727eca013e434615127`](https://github.com/nvkelso/natural-earth-vector/blob/117488dc884bad03366ff727eca013e434615127/geojson/ne_10m_admin_0_map_units.geojson).
   The feature with `ISO_A2_EH: "TW"` has `CONTINENT: "Asia"`. The exact source
   file SHA-256 is
   `57da82be755f4afccd8f3b14251bb2752f5df1395f47d2d86f817470c4a48862`.
   Natural Earth data is public domain; its generalization is not a boundary
   authority.

The official UN HTML pages can change, so the checksums identify the retrieved
preparation snapshots rather than promising permanent immutable downloads.
The shipped catalog retains only factual ISO-code membership and geographic
group classifications, not the source page text or its presentation.

Adding a normal visit needs no catalog edit: add its code to the visited list.
When updating the underlying ISO catalog or UN membership rule, review this
metadata too. Validate that its keys exactly match the ISO catalog, every entry
has one of the seven group labels and a boolean membership value, and the number
of member codes matches the verified UN list. Recheck the special cases above.
Do not derive membership from a country's map shape, its parent territory, or
its `independent` flag in another dataset.
