import { describe, expect, it } from "vitest";
import { parseMunicipalitiesXml } from "./municipalities";

describe("parseMunicipalitiesXml", () => {
  it("parses municipality fixtures", () => {
    expect(parseMunicipalitiesXml("<root><gemeinde><kennzahl>10101</kennzahl><name>Eisenstadt</name></gemeinde></root>")).toEqual([{ code: "10101", name: "Eisenstadt" }]);
    expect(parseMunicipalitiesXml("<root><row code=\"90001\" name=\"Wien\" /></root>")).toEqual([{ code: "90001", name: "Wien" }]);
  });
});
