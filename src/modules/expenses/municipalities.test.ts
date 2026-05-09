import { describe, expect, it } from "vitest";
import { findMunicipalityForAddress, parseMunicipalitiesXml } from "./municipalities";

describe("parseMunicipalitiesXml", () => {
  it("parses municipality fixtures", () => {
    expect(parseMunicipalitiesXml("<root><gemeinde><kennzahl>10101</kennzahl><name>Eisenstadt</name></gemeinde></root>")).toEqual([{ code: "10101", name: "Eisenstadt" }]);
    expect(parseMunicipalitiesXml("<root><row code=\"90001\" name=\"Wien\" /></root>")).toEqual([{ code: "90001", name: "Wien" }]);
  });

  it("parses the official locality reference list shape", () => {
    expect(parseMunicipalitiesXml("<table><row><column>17223</column><column>Wien,Innere Stadt</column><column>1010</column><column>90001</column><column>Wien</column></row></table>")).toEqual([
      { code: "90001", name: "Wien", localityName: "Wien,Innere Stadt", postalCodes: "1010" }
    ]);
  });

  it("finds municipality codes from postal code or locality", () => {
    const municipalities = parseMunicipalitiesXml("<table><row><column>17223</column><column>Wien,Innere Stadt</column><column>1010</column><column>90001</column><column>Wien</column></row><row><column>00001</column><column>Eisenstadt</column><column>7000</column><column>10101</column><column>Eisenstadt</column></row></table>");
    expect(findMunicipalityForAddress("Stephansplatz 1, 1010 Wien", municipalities)?.code).toBe("90001");
    expect(findMunicipalityForAddress("Eisenstadt", municipalities)?.code).toBe("10101");
  });
});
