export interface Municipality {
  code: string;
  name: string;
  localityName?: string;
  postalCodes?: string;
}

export function parseMunicipalitiesXml(xmlText: string): Municipality[] {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("Gemeindedatei ist kein gültiges XML.");
  return [...document.querySelectorAll("gemeinde, municipality, row")].map((node): Municipality | null => {
    const columns = [...node.children].filter((child) => child.tagName.toLowerCase() === "column").map((column) => column.textContent?.trim() ?? "");
    if (columns.length >= 5) {
      const localityName = columns[1];
      const postalCodes = columns[2];
      const code = columns[3];
      const name = columns[4];
      return code && name ? { code, name, localityName, postalCodes } : null;
    }
    const code = textFrom(node, ["kennzahl", "gemeindekennzahl", "code", "GKZ"]);
    const name = textFrom(node, ["name", "gemeindename", "Gemeinde"]);
    return code && name ? { code, name } : null;
  }).filter((item): item is Municipality => Boolean(item));
}

export function findMunicipalityForAddress(address: string, municipalities: Municipality[]): Municipality | null {
  const normalizedAddress = normalizeSearchText(address);
  if (!normalizedAddress) return null;

  const municipalityQuery = municipalityQueryFromAddress(address);
  const normalizedMunicipalityQuery = normalizeSearchText(municipalityQuery);
  const postalMatches = address.match(/\b\d{4}\b/g) ?? [];
  for (const postalCode of postalMatches) {
    const matches = municipalities.filter((municipality) => municipality.postalCodes?.split(",").map((code) => code.trim()).includes(postalCode));
    const queryMatches = normalizedMunicipalityQuery
      ? matches.filter((municipality) => municipalitySearchText(municipality).includes(normalizedMunicipalityQuery))
      : [];
    const uniqueQueryCodes = new Set(queryMatches.map((municipality) => municipality.code));
    if (queryMatches.length > 0 && uniqueQueryCodes.size === 1) return queryMatches[0];

    const uniqueCodes = new Set(matches.map((municipality) => municipality.code));
    if (matches.length > 0 && uniqueCodes.size === 1) return matches[0];
  }

  const exactLocality = municipalities.find((municipality) => municipality.localityName && normalizedAddress.includes(normalizeSearchText(municipality.localityName)));
  if (exactLocality) return exactLocality;

  return municipalities.find((municipality) => normalizedAddress.includes(normalizeSearchText(municipality.name))) ?? null;
}

export function municipalityQueryFromAddress(address: string): string {
  const trimmedAddress = address.trim();
  const postalCodeMatch = trimmedAddress.match(/\b\d{4}\b\s*(.*)$/);
  const query = postalCodeMatch?.[1]?.replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/g, "").trim();
  return query || trimmedAddress;
}

export function municipalitySearchText(municipality: Municipality): string {
  return normalizeSearchText(`${municipality.localityName ?? ""} ${municipality.name} ${municipality.postalCodes ?? ""} ${municipality.code}`);
}

function textFrom(node: Element, names: string[]): string {
  for (const name of names) {
    const attribute = node.getAttribute(name);
    if (attribute?.trim()) return attribute.trim();
    const child = node.querySelector(name);
    if (child?.textContent?.trim()) return child.textContent.trim();
  }
  return "";
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
