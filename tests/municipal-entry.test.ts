import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMunicipalComparisonUrl,
  parseMunicipalComparisonQuery,
} from "../src/lib/municipal-entry";
import {
  DISTRITOS_LIMA,
  POSTULANTES_POR_AMBITO,
  obtenerOpcionesMunicipales,
} from "../src/lib/municipales";

const supportedAmbitos = new Set(
  obtenerOpcionesMunicipales().map((option) => option.slug),
);

test("municipal selection round-trips scalar canonical URL state", () => {
  const url = buildMunicipalComparisonUrl(
    { ambito: "ate", prioridad: "SOCIAL" },
    supportedAmbitos,
  );

  assert.equal(url, "/alcaldes/versus?ambito=ate&prioridad=SOCIAL");
  assert.deepEqual(
    parseMunicipalComparisonQuery(
      { ambito: "ate", prioridad: "SOCIAL" },
      supportedAmbitos,
    ),
    {
      status: "valid",
      requestedAmbito: "ate",
      ambito: "ate",
      prioridad: "SOCIAL",
    },
  );
});

test("Cercado normalizes to Lima Metropolitana with a visible notice", () => {
  const parsed = parseMunicipalComparisonQuery(
    { ambito: "lima-cercado" },
    supportedAmbitos,
  );

  assert.deepEqual(parsed, {
    status: "valid",
    requestedAmbito: "lima-cercado",
    ambito: "lima-metropolitana",
    notice:
      "Lima (Cercado) no elige una alcaldía distrital: corresponde comparar la Alcaldía de Lima Metropolitana.",
  });
  assert.equal(
    buildMunicipalComparisonUrl({ ambito: "lima-cercado" }, supportedAmbitos),
    "/alcaldes/versus?ambito=lima-metropolitana",
  );
});

test("missing, duplicated, or unsupported selection state never defaults a district", () => {
  assert.deepEqual(
    parseMunicipalComparisonQuery({}, supportedAmbitos),
    { status: "needs-selection" },
  );

  for (const query of [
    { prioridad: "SOCIAL" },
    { ambito: ["ate", "comas"] },
    { ambito: "ate", prioridad: ["SOCIAL", "AMBIENTAL"] },
    { ambito: "unknown" },
    { ambito: "ate", prioridad: "unknown" },
  ]) {
    assert.equal(
      parseMunicipalComparisonQuery(query, supportedAmbitos).status,
      "invalid",
    );
  }
});

test("the municipal builder retains catalog districts with zero candidacies", () => {
  const zeroCountDistrict = DISTRITOS_LIMA.find(
    (district) => !district.sinAlcaldiaPropia,
  );
  assert.ok(zeroCountDistrict, "a district with its own mayoralty is required");

  const originalTotal = POSTULANTES_POR_AMBITO.get(zeroCountDistrict.slug);
  POSTULANTES_POR_AMBITO.delete(zeroCountDistrict.slug);

  try {
    const options = obtenerOpcionesMunicipales();
    const zeroCountOption = options.find(
      (option) => option.slug === zeroCountDistrict.slug,
    );

    assert.equal(options.length, DISTRITOS_LIMA.length + 1);
    assert.deepEqual(
      options.slice(1).map((option) => option.slug),
      DISTRITOS_LIMA.map((district) => district.slug),
    );
    assert.deepEqual(zeroCountOption, {
      slug: zeroCountDistrict.slug,
      nombre: zeroCountDistrict.nombre,
      total: 0,
      description: undefined,
    });
    assert.equal(
      parseMunicipalComparisonQuery(
        { ambito: zeroCountDistrict.slug },
        new Set(options.map((option) => option.slug)),
      ).status,
      "valid",
    );
  } finally {
    if (originalTotal === undefined) {
      POSTULANTES_POR_AMBITO.delete(zeroCountDistrict.slug);
    } else {
      POSTULANTES_POR_AMBITO.set(zeroCountDistrict.slug, originalTotal);
    }
  }
});

test("the URL builder accepts only supported local municipal selections", () => {
  assert.equal(
    buildMunicipalComparisonUrl(undefined, supportedAmbitos),
    "/alcaldes/versus",
  );
  assert.throws(
    () =>
      buildMunicipalComparisonUrl(
        { ambito: "https://attacker.example/" },
        supportedAmbitos,
      ),
    /municipalidad/i,
  );
  assert.throws(
    () =>
      buildMunicipalComparisonUrl(
        { ambito: "ate", prioridad: "UNKNOWN" as "SOCIAL" },
        supportedAmbitos,
      ),
    /prioridad/i,
  );
  assert.throws(
    () =>
      buildMunicipalComparisonUrl(
        { ambito: "lima-cercado" },
        new Set(["lima-cercado"]),
      ),
    /municipalidad/i,
  );
});
