"use client";

import JSZip from "jszip";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import * as QRCode from "qrcode";


type JsonMap = Record<string, unknown>;


function cleanName(value: string) {
  return value.replace(
    /[^A-Za-z0-9._-]+/g,
    "-",
  );
}


function beaconUrl(number: string) {
  return (
    `${window.location.origin}/a/`
    + encodeURIComponent(number)
  );
}


function dataUrlBytes(dataUrl: string) {
  const base64 =
    dataUrl.split(",", 2)[1];

  if(!base64){
    throw new Error(
      "Image QR invalide.",
    );
  }

  const binary = atob(base64);
  const bytes =
    new Uint8Array(binary.length);

  for(
    let index = 0;
    index < binary.length;
    index += 1
  ){
    bytes[index] =
      binary.charCodeAt(index);
  }

  return bytes;
}


function downloadBytes(
  bytes: Uint8Array,
  type: string,
  filename: string,
) {
  const stable =
    new Uint8Array(bytes);

  const blob =
    new Blob(
      [stable.buffer],
      {
        type,
      },
    );

  downloadBlob(
    blob,
    filename,
  );
}


function downloadBlob(
  blob: Blob,
  filename: string,
) {
  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    2000,
  );
}


async function generateQrPdf(
  numbers: string[],
  lotCode: string,
) {
  const document =
    await PDFDocument.create();

  const mono =
    await document.embedFont(
      StandardFonts.CourierBold,
    );

  const regular =
    await document.embedFont(
      StandardFonts.Helvetica,
    );

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const columns = 3;
  const rows = 4;
  const margin = 28;
  const qrSide =
    (25 / 25.4) * 72;

  const cellWidth =
    (pageWidth - margin * 2)
    / columns;

  const cellHeight =
    (pageHeight - margin * 2)
    / rows;

  const perPage =
    columns * rows;

  for(
    let offset = 0;
    offset < numbers.length;
    offset += perPage
  ){
    const page =
      document.addPage([
        pageWidth,
        pageHeight,
      ]);

    for(
      let column = 0;
      column <= columns;
      column += 1
    ){
      const x =
        margin
        + column * cellWidth;

      page.drawLine({
        start: {
          x,
          y: margin,
        },
        end: {
          x,
          y: pageHeight - margin,
        },
        thickness: 0.5,
        color: rgb(
          0.7,
          0.72,
          0.76,
        ),
        dashArray: [
          2,
          3,
        ],
      });
    }

    for(
      let row = 0;
      row <= rows;
      row += 1
    ){
      const y =
        margin
        + row * cellHeight;

      page.drawLine({
        start: {
          x: margin,
          y,
        },
        end: {
          x: pageWidth - margin,
          y,
        },
        thickness: 0.5,
        color: rgb(
          0.7,
          0.72,
          0.76,
        ),
        dashArray: [
          2,
          3,
        ],
      });
    }

    const current =
      numbers.slice(
        offset,
        offset + perPage,
      );

    for(
      let index = 0;
      index < current.length;
      index += 1
    ){
      const number =
        current[index]!;

      const column =
        index % columns;

      const row =
        Math.floor(
          index / columns,
        );

      const x0 =
        margin
        + column * cellWidth;

      const y0 =
        pageHeight
        - margin
        - (row + 1)
          * cellHeight;

      const dataUrl =
        await QRCode.toDataURL(
          beaconUrl(number),
          {
            errorCorrectionLevel: "H",
            width: 591,
            margin: 4,
          },
        );

      const png =
        await document.embedPng(
          dataUrlBytes(dataUrl),
        );

      const qx =
        x0
        + (
          cellWidth - qrSide
        ) / 2;

      const qy =
        y0
        + (
          cellHeight - qrSide
        ) / 2
        + 16;

      page.drawImage(
        png,
        {
          x: qx,
          y: qy,
          width: qrSide,
          height: qrSide,
        },
      );

      const textSize = 11;
      const width =
        mono.widthOfTextAtSize(
          number,
          textSize,
        );

      page.drawText(
        number,
        {
          x:
            x0
            + (
              cellWidth - width
            ) / 2,
          y: qy - 18,
          size: textSize,
          font: mono,
          color: rgb(
            0.1,
            0.12,
            0.16,
          ),
        },
      );

      page.drawText(
        "Adresse GN",
        {
          x: x0 + 12,
          y: qy - 30,
          size: 7,
          font: regular,
          color: rgb(
            0.45,
            0.48,
            0.55,
          ),
        },
      );
    }
  }

  const bytes =
    await document.save();

  downloadBytes(
    bytes,
    "application/pdf",
    `${cleanName(lotCode)}-QR.pdf`,
  );
}


async function generateQrZip(
  numbers: string[],
  lotCode: string,
) {
  const zip =
    new JSZip();

  for(const number of numbers){
    const dataUrl =
      await QRCode.toDataURL(
        beaconUrl(number),
        {
          errorCorrectionLevel: "H",
          width: 591,
          margin: 4,
        },
      );

    const base64 =
      dataUrl.split(",", 2)[1];

    if(!base64){
      throw new Error(
        `PNG QR impossible pour ${number}.`,
      );
    }

    zip.file(
      `${cleanName(number)}.png`,
      base64,
      {
        base64: true,
      },
    );
  }

  const blob =
    await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6,
      },
    });

  downloadBlob(
    blob,
    `${cleanName(lotCode)}-QR-PNG.zip`,
  );
}


function generateQrCsv(
  numbers: string[],
  lotCode: string,
) {
  function field(value: string){
    return /[",\r\n]/.test(value)
      ? `"${value.replace(
          /"/g,
          '""',
        )}"`
      : value;
  }

  const rows = [
    "public_number,qr_url,qr_filename,lot_code",
  ];

  for(const number of numbers){
    rows.push(
      [
        number,
        beaconUrl(number),
        `${number}.png`,
        lotCode,
      ].map(field).join(","),
    );
  }

  const blob =
    new Blob(
      [
        `${rows.join("\r\n")}\r\n`,
      ],
      {
        type:
          "text/csv;charset=utf-8",
      },
    );

  downloadBlob(
    blob,
    `${cleanName(lotCode)}-QR.csv`,
  );
}


function formatMoney(value: unknown) {
  const parsed =
    Number(value ?? 0);

  return (
    new Intl.NumberFormat(
      "fr-FR",
    ).format(
      Number.isFinite(parsed)
        ? parsed
        : 0,
    )
    + " GNF"
  );
}


function textValue(value: unknown) {
  if(
    value === null
    || value === undefined
    || value === ""
  ){
    return "-";
  }

  if(
    typeof value === "object"
  ){
    const record =
      value as JsonMap;

    return String(
      record.name
      ?? record.full_name
      ?? JSON.stringify(value),
    );
  }

  return String(value);
}


async function generateSimplePdf(
  title: string,
  reference: string,
  content: Array<[
    string,
    string,
  ]>,
  filename: string,
) {
  const document =
    await PDFDocument.create();

  let page =
    document.addPage();

  const regular =
    await document.embedFont(
      StandardFonts.Helvetica,
    );

  const bold =
    await document.embedFont(
      StandardFonts.HelveticaBold,
    );

  let y =
    page.getHeight() - 55;

  function ensureSpace(){
    if(y > 70){
      return;
    }

    page =
      document.addPage();

    y =
      page.getHeight() - 55;
  }

  page.drawText(
    "Adresse GN",
    {
      x: 45,
      y,
      size: 18,
      font: bold,
      color: rgb(
        0.1,
        0.15,
        0.25,
      ),
    },
  );

  y -= 34;

  page.drawText(
    title,
    {
      x: 45,
      y,
      size: 16,
      font: bold,
    },
  );

  y -= 24;

  page.drawText(
    reference,
    {
      x: 45,
      y,
      size: 11,
      font: bold,
    },
  );

  y -= 30;

  for(
    const [
      label,
      value,
    ] of content
  ){
    ensureSpace();

    page.drawText(
      `${label} :`,
      {
        x: 45,
        y,
        size: 9,
        font: bold,
      },
    );

    page.drawText(
      value.slice(
        0,
        90,
      ),
      {
        x: 180,
        y,
        size: 9,
        font: regular,
      },
    );

    y -= 18;
  }

  const bytes =
    await document.save();

  downloadBytes(
    bytes,
    "application/pdf",
    filename,
  );
}


async function generatePoPdf(document: JsonMap) {
  const content: Array<[
    string,
    string,
  ]> = [
    [
      "Lot",
      textValue(
        document.lot_code,
      ),
    ],
    [
      "Fournisseur",
      textValue(
        document.supplier,
      ),
    ],
    [
      "Date",
      textValue(
        document.issued_at,
      ),
    ],
    [
      "Livraison prevue",
      textValue(
        document.expected_delivery,
      ),
    ],
    [
      "Conditions",
      textValue(
        document.payment_terms,
      ),
    ],
    [
      "Statut",
      textValue(
        document.status,
      ),
    ],
  ];

  const detail =
    Array.isArray(
      document.lines,
    )
      ? document.lines
      : [];

  for(const item of detail){
    if(
      !item
      || typeof item !== "object"
    ){
      continue;
    }

    const row =
      item as JsonMap;

    content.push([
      `Ligne ${textValue(row.position)}`,
      (
        `${textValue(row.designation)} - `
        + `${textValue(row.quantity)} x `
        + `${formatMoney(row.unit_price_ht)}`
      ),
    ]);
  }

  content.push(
    [
      "Montant HT",
      formatMoney(
        document.amount_ht,
      ),
    ],
    [
      "TVA",
      formatMoney(
        document.tva_amount,
      ),
    ],
    [
      "Montant TTC",
      formatMoney(
        document.amount_ttc,
      ),
    ],
  );

  const reference =
    textValue(
      document.po_number,
    );

  await generateSimplePdf(
    "BON DE COMMANDE",
    reference,
    content,
    `${cleanName(reference)}.pdf`,
  );
}


async function generateDnPdf(document: JsonMap) {
  const reference =
    textValue(
      document.dn_number,
    );

  await generateSimplePdf(
    "BON DE LIVRAISON",
    reference,
    [
      [
        "Bon de commande",
        textValue(
          document.po_number,
        ),
      ],
      [
        "Lot",
        textValue(
          document.lot_code,
        ),
      ],
      [
        "Fournisseur",
        textValue(
          document.supplier,
        ),
      ],
      [
        "Expedie le",
        textValue(
          document.shipped_at,
        ),
      ],
      [
        "Recu le",
        textValue(
          document.received_at,
        ),
      ],
      [
        "Transporteur",
        textValue(
          document.carrier,
        ),
      ],
      [
        "Suivi",
        textValue(
          document.tracking_number,
        ),
      ],
      [
        "Quantite commandee",
        textValue(
          document.quantity_ordered,
        ),
      ],
      [
        "Quantite expediee",
        textValue(
          document.quantity_shipped,
        ),
      ],
      [
        "Quantite recue",
        textValue(
          document.quantity_received,
        ),
      ],
      [
        "Ecart",
        textValue(
          document.discrepancy,
        ),
      ],
      [
        "QC conforme",
        document.qc_passed === true
          ? "Oui"
          : document.qc_passed === false
            ? "Non"
            : "-",
      ],
      [
        "Defauts",
        textValue(
          document.defects,
        ),
      ],
      [
        "Receptionnaire",
        textValue(
          document.receiver_name,
        ),
      ],
      [
        "Notes",
        textValue(
          document.notes,
        ),
      ],
    ],
    `${cleanName(reference)}.pdf`,
  );
}


export async function handleBackofficeActionResult(
  result: Record<string, unknown>,
) {
  const signed =
    typeof result.signed_url === "string"
      ? result.signed_url
      : "";

  if(signed){
    window.open(
      signed,
      "_blank",
      "noopener,noreferrer",
    );

    return true;
  }

  const raw =
    result.client_export;

  if(
    !raw
    || typeof raw !== "object"
  ){
    return false;
  }

  const payload =
    raw as JsonMap;

  const kind =
    String(
      payload.kind ?? "",
    );

  if(
    kind === "qr_pdf"
    || kind === "qr_zip"
    || kind === "qr_csv"
  ){
    const numbers =
      Array.isArray(
        payload.numbers,
      )
        ? payload.numbers.map(
            (value) =>
              String(value),
          )
        : [];

    const lotCode =
      String(
        payload.lot_code
        ?? "LOT",
      );

    if(!numbers.length){
      throw new Error(
        "Aucun numéro à exporter.",
      );
    }

    if(kind === "qr_pdf"){
      await generateQrPdf(
        numbers,
        lotCode,
      );
    }
    else if(kind === "qr_zip"){
      await generateQrZip(
        numbers,
        lotCode,
      );
    }
    else{
      generateQrCsv(
        numbers,
        lotCode,
      );
    }

    return true;
  }

  if(
    kind === "po_pdf"
    || kind === "dn_pdf"
  ){
    const document =
      payload.document;

    if(
      !document
      || typeof document !== "object"
    ){
      throw new Error(
        "Données du document absentes.",
      );
    }

    if(kind === "po_pdf"){
      await generatePoPdf(
        document as JsonMap,
      );
    }
    else{
      await generateDnPdf(
        document as JsonMap,
      );
    }

    return true;
  }

  return false;
}
