/**
 * Predefined industries. `terms` are the localised search phrases sent to the
 * business provider; `googleType` is a Places (New) type used as includedType
 * when known; `osm` are Overpass tag selectors for the free fallback provider.
 */
export type Industry = {
  key: string;
  label: { en: string; nl: string };
  terms: { en: string[]; nl: string[] };
  googleType?: string;
  osm: string[];
  /** Relative commercial value for the Opportunity Score business component (0.8–1.1) */
  commercialWeight: number;
};

export const INDUSTRIES: Industry[] = [
  { key: "contractors", label: { en: "General contractors", nl: "Aannemers" }, terms: { en: ["general contractor", "building contractor"], nl: ["aannemer", "aannemersbedrijf", "bouwbedrijf"] }, googleType: "general_contractor", osm: ['["craft"="builder"]', '["office"="construction_company"]'], commercialWeight: 1.1 },
  { key: "roofers", label: { en: "Roofers", nl: "Dakdekkers" }, terms: { en: ["roofer", "roofing contractor"], nl: ["dakdekker", "dakdekkersbedrijf"] }, googleType: "roofing_contractor", osm: ['["craft"="roofer"]'], commercialWeight: 1.1 },
  { key: "painters", label: { en: "Painters", nl: "Schilders" }, terms: { en: ["painter", "painting contractor"], nl: ["schilder", "schildersbedrijf"] }, googleType: "painter", osm: ['["craft"="painter"]'], commercialWeight: 1.0 },
  { key: "electricians", label: { en: "Electricians", nl: "Elektriciens" }, terms: { en: ["electrician"], nl: ["elektricien", "elektrotechnisch installatiebedrijf"] }, googleType: "electrician", osm: ['["craft"="electrician"]'], commercialWeight: 1.05 },
  { key: "plumbers", label: { en: "Plumbers", nl: "Loodgieters" }, terms: { en: ["plumber"], nl: ["loodgieter", "loodgietersbedrijf"] }, googleType: "plumber", osm: ['["craft"="plumber"]'], commercialWeight: 1.05 },
  { key: "installers", label: { en: "HVAC / installation companies", nl: "Installatiebedrijven" }, terms: { en: ["hvac contractor", "heating installer"], nl: ["installatiebedrijf", "cv installateur", "warmtepomp installateur"] }, googleType: "hvac_contractor", osm: ['["craft"="hvac"]', '["craft"="heating_engineer"]'], commercialWeight: 1.1 },
  { key: "restaurants", label: { en: "Restaurants", nl: "Restaurants" }, terms: { en: ["restaurant"], nl: ["restaurant"] }, googleType: "restaurant", osm: ['["amenity"="restaurant"]'], commercialWeight: 0.9 },
  { key: "hairdressers", label: { en: "Hairdressers", nl: "Kappers" }, terms: { en: ["hair salon", "hairdresser"], nl: ["kapper", "kapsalon"] }, googleType: "hair_salon", osm: ['["shop"="hairdresser"]'], commercialWeight: 0.8 },
  { key: "dentists", label: { en: "Dentists", nl: "Tandartsen" }, terms: { en: ["dentist"], nl: ["tandarts", "tandartspraktijk"] }, googleType: "dentist", osm: ['["amenity"="dentist"]'], commercialWeight: 1.1 },
  { key: "real-estate", label: { en: "Real estate agents", nl: "Makelaars" }, terms: { en: ["real estate agency"], nl: ["makelaar", "makelaarskantoor"] }, googleType: "real_estate_agency", osm: ['["office"="estate_agent"]'], commercialWeight: 1.1 },
  { key: "lawyers", label: { en: "Lawyers", nl: "Advocaten" }, terms: { en: ["lawyer", "law firm"], nl: ["advocaat", "advocatenkantoor"] }, googleType: "lawyer", osm: ['["office"="lawyer"]'], commercialWeight: 1.1 },
  { key: "physiotherapists", label: { en: "Physiotherapists", nl: "Fysiotherapeuten" }, terms: { en: ["physiotherapist", "physical therapy clinic"], nl: ["fysiotherapeut", "fysiotherapie praktijk"] }, googleType: "physiotherapist", osm: ['["healthcare"="physiotherapist"]'], commercialWeight: 1.0 },
  { key: "car-dealers", label: { en: "Car dealers & garages", nl: "Autobedrijven" }, terms: { en: ["car dealer", "auto repair shop"], nl: ["autobedrijf", "garagebedrijf", "autogarage"] }, googleType: "car_repair", osm: ['["shop"="car"]', '["shop"="car_repair"]'], commercialWeight: 1.05 },
  { key: "cleaning", label: { en: "Cleaning companies", nl: "Schoonmaakbedrijven" }, terms: { en: ["cleaning service", "cleaning company"], nl: ["schoonmaakbedrijf", "schoonmaakdienst"] }, osm: ['["craft"="cleaning"]', '["office"="company"]["name"~"schoonmaak|cleaning",i]'], commercialWeight: 1.0 },
  { key: "landscapers", label: { en: "Landscapers", nl: "Hoveniers" }, terms: { en: ["landscaper", "landscaping company"], nl: ["hovenier", "hoveniersbedrijf", "tuinaanleg"] }, googleType: "landscaper", osm: ['["craft"="gardener"]'], commercialWeight: 1.05 },
  { key: "solar", label: { en: "Solar panel installers", nl: "Zonnepanelenbedrijven" }, terms: { en: ["solar panel installer", "solar energy company"], nl: ["zonnepanelen installateur", "zonnepanelen bedrijf"] }, osm: ['["craft"="electrician"]["name"~"zon|solar",i]', '["shop"="energy"]'], commercialWeight: 1.1 },
];

export const INDUSTRY_MAP = new Map(INDUSTRIES.map((i) => [i.key, i]));

export function industryLabel(key: string | null | undefined, lang: "en" | "nl" = "en") {
  if (!key) return null;
  return INDUSTRY_MAP.get(key)?.label[lang] ?? null;
}

export const COUNTRIES: { code: string; name: string; lang: "en" | "nl" | "de" | "fr" }[] = [
  { code: "NL", name: "Netherlands", lang: "nl" },
  { code: "BE", name: "Belgium", lang: "nl" },
  { code: "DE", name: "Germany", lang: "de" },
  { code: "GB", name: "United Kingdom", lang: "en" },
  { code: "US", name: "United States", lang: "en" },
  { code: "IE", name: "Ireland", lang: "en" },
  { code: "FR", name: "France", lang: "fr" },
  { code: "ES", name: "Spain", lang: "en" },
  { code: "AU", name: "Australia", lang: "en" },
  { code: "CA", name: "Canada", lang: "en" },
];
