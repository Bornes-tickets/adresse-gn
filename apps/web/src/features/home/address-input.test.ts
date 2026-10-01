import {
  extractAddressNumberFromQr,
  extractAddressNumberFromSpeech,
} from "./address-input";

import {
  describe,
  expect,
  it,
} from "vitest";


describe(
  "extractAddressNumberFromQr",
  () => {
    it(
      "accepte un numéro V1 canonique",
      () => {
        expect(
          extractAddressNumberFromQr(
            "CKY08-100000000",
          ),
        ).toBe(
          "CKY08-100000000",
        );
      },
    );

    it(
      "normalise un numéro V1 compact",
      () => {
        expect(
          extractAddressNumberFromQr(
            "CKY08100000000",
          ),
        ).toBe(
          "CKY08-100000000",
        );
      },
    );

    it(
      "extrait un numéro V1 contenu dans une valeur QR",
      () => {
        expect(
          extractAddressNumberFromQr(
            "adresse=CKY08-100000000",
          ),
        ).toBe(
          "CKY08-100000000",
        );
      },
    );

    it.each([
      "GN-CKY-582741",
      "GNCKY582741",
      "582741",
      "100000000",
      "",
    ])(
      "rejette une valeur QR non V1 %s",
      (value) => {
        expect(
          extractAddressNumberFromQr(
            value,
          ),
        ).toBeNull();
      },
    );
  },
);


describe(
  "extractAddressNumberFromSpeech",
  () => {
    it(
      "accepte un numéro V1 canonique",
      () => {
        expect(
          extractAddressNumberFromSpeech(
            "CKY08-100000000",
          ),
        ).toBe(
          "CKY08-100000000",
        );
      },
    );

    it(
      "normalise un numéro V1 compact",
      () => {
        expect(
          extractAddressNumberFromSpeech(
            "CKY08100000000",
          ),
        ).toBe(
          "CKY08-100000000",
        );
      },
    );

    it(
      "normalise une dictée V1 groupée",
      () => {
        expect(
          extractAddressNumberFromSpeech(
            "CKY08 100 000 000",
          ),
        ).toBe(
          "CKY08-100000000",
        );
      },
    );

    it(
      "extrait un numéro V1 dans une phrase",
      () => {
        expect(
          extractAddressNumberFromSpeech(
            "mon adresse est CKY08 100 000 000",
          ),
        ).toBe(
          "CKY08-100000000",
        );
      },
    );

    it(
      "normalise les lettres minuscules",
      () => {
        expect(
          extractAddressNumberFromSpeech(
            "cky08 100 000 000",
          ),
        ).toBe(
          "CKY08-100000000",
        );
      },
    );

    it.each([
      "GN-CKY-582741",
      "GNCKY582741",
      "582741",
      "100000000",
      "",
    ])(
      "rejette une dictée non V1 %s",
      (value) => {
        expect(
          extractAddressNumberFromSpeech(
            value,
          ),
        ).toBeNull();
      },
    );

    it(
      "ne tronque jamais 9 chiffres en ancien numéro",
      () => {
        expect(
          extractAddressNumberFromSpeech(
            "908182123",
          ),
        ).toBeNull();
      },
    );
  },
);
