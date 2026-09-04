import type {
  Metadata,
} from "next";

import {
  AddressDetailPage,
} from "../../../features/addresses/components/address-detail-page";


type Props = {
  params: Promise<{
    number: string;
  }>;
};


export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const {
    number,
  } =
    await params;

  const decodedNumber =
    decodeURIComponent(
      number,
    );

  return {
    title:
      `Adresse ${decodedNumber}`,

    description:
      `Position GPS, carte et itinéraire pour l'adresse ${decodedNumber} en Guinée.`,

    robots: {
      index: false,
      follow: true,
    },
  };
}


export default async function AddressPage({
  params,
}: Props) {
  const {
    number,
  } =
    await params;

  const decodedNumber =
    decodeURIComponent(
      number,
    );

  return (
    <AddressDetailPage
      number={decodedNumber}
    />
  );
}