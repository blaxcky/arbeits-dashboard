export interface Municipality {
  code: string;
  name: string;
}

export function parseMunicipalitiesXml(xmlText: string): Municipality[] {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("Gemeindedatei ist kein gültiges XML.");
  return [...document.querySelectorAll("gemeinde, municipality, row")].map((node) => {
    const code = textFrom(node, ["kennzahl", "gemeindekennzahl", "code", "GKZ"]);
    const name = textFrom(node, ["name", "gemeindename", "Gemeinde"]);
    return code && name ? { code, name } : null;
  }).filter((item): item is Municipality => Boolean(item));
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
