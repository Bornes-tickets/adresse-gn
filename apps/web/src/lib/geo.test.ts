import {
  BEACON_REGEX,
  V1_BEACON_REGEX,
  formatDistance,
  haversineKm,
  isValidBeaconNumber,
  normalizeBeaconNumber,
} from "./geo";

import {
  describe,
  expect,
  it,
} from "vitest";


describe(
  "normalizeBeaconNumber V1",
  () => {
    it(
      "préserve un numéro V1 canonique",
      () => {
        expect(
          normalizeBeaconNumber(
            "BFA01-100000000",
          ),
        ).toBe(
          "BFA01-100000000",
        );
      },
    );

    it(
      "normalise un numéro V1 compact",
      () => {
        expect(
          normalizeBeaconNumber(
            "BFA01100000000",
          ),
        ).toBe(
          "BFA01-100000000",
        );
      },
    );

    it(
      "normalise un numéro V1 groupé",
      () => {
        expect(
          normalizeBeaconNumber(
            "BFA01-100 000 000",
          ),
        ).toBe(
          "BFA01-100000000",
        );
      },
    );

    it(
      "normalise un numéro V1 en minuscules",
      () => {
        expect(
          normalizeBeaconNumber(
            "bfa01-100000000",
          ),
        ).toBe(
          "BFA01-100000000",
        );
      },
    );

    it(
      "ne déduit jamais la commune depuis 9 chiffres",
      () => {
        const result =
          normalizeBeaconNumber(
            "100000000",
          );

        expect(result).toBe(
          "100000000",
        );

        expect(
          isValidBeaconNumber(
            result,
          ),
        ).toBe(false);
      },
    );
  },
);


describe(
  "Adresse GN V1 regex",
  () => {
    it(
      "valide le format V1 canonique",
      () => {
        const value =
          "CKY08-100000000";

        expect(
          V1_BEACON_REGEX.test(
            value,
          ),
        ).toBe(true);

        expect(
          BEACON_REGEX.test(
            value,
          ),
        ).toBe(true);

        expect(
          isValidBeaconNumber(
            value,
          ),
        ).toBe(true);
      },
    );

    it.each([
      "GN-CKY-582741",
      "GNCKY582741",
      "582741",
      "100000000",
      "BFA01-10000000",
      "BFA01-1000000000",
      "BFA1-100000000",
      "BFA001-100000000",
      "",
    ])(
      "rejette le format non V1 %s",
      (value) => {
        const normalized =
          normalizeBeaconNumber(
            value,
          );

        expect(
          isValidBeaconNumber(
            normalized,
          ),
        ).toBe(false);
      },
    );
  },
);


describe(
  "geo utilities",
  () => {
    it(
      "conserve une distance nulle entre deux points identiques",
      () => {
        expect(
          haversineKm(
            {
              lat: 9.5,
              lng: -13.7,
            },
            {
              lat: 9.5,
              lng: -13.7,
            },
          ),
        ).toBeCloseTo(0);
      },
    );

    it(
      "formate une distance inférieure à un kilomètre",
      () => {
        expect(
          formatDistance(
            0.85,
          ),
        ).toBe(
          "850 m",
        );
      },
    );

    it(
      "formate une distance en kilomètres",
      () => {
        expect(
          formatDistance(
            12.4,
          ),
        ).toBe(
          "12,4 km",
        );
      },
    );
  },
);
