import { describe, expect, it } from "vitest";
import { findMunicipalityForAddress, municipalityQueryFromAddress, parseMunicipalitiesXml } from "./municipalities";

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

  it("extracts the municipality query from the text after the postal code", () => {
    expect(municipalityQueryFromAddress("Ernst-Mach-Straße 1, 7100 Neusiedl am See")).toBe("Neusiedl am See");
    expect(municipalityQueryFromAddress("Eisenstadt")).toBe("Eisenstadt");
  });

  it("prefers postal code matches that also match the extracted municipality name", () => {
    const municipalities = parseMunicipalitiesXml("<table><row><column>00001</column><column>Weiden am See</column><column>7121, 7100</column><column>10722</column><column>Weiden am See</column></row><row><column>00002</column><column>Neusiedl am See</column><column>7100</column><column>10713</column><column>Neusiedl am See</column></row></table>");
    expect(findMunicipalityForAddress("Ernst-Mach-Straße 1, 7100 Neusiedl am See", municipalities)?.code).toBe("10713");
  });
});
