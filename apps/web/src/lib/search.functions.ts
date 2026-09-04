import { searchAddress } from "@/features/addresses/api";


export async function searchBeacon({
  data,
}: {
  data: {
    number: string;
  };
}) {
  return searchAddress(
    data.number
  );
}
