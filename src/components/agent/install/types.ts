/** Types locaux du formulaire d'installation. */

export interface InstallDetails {
  category: string;
  name: string;
  access_point_note: string;
  visibility: "private" | "public";
  owner_name: string;
  owner_phone: string;
  consent: boolean;
}

export const DETAILS_VIDES: InstallDetails = {
  category: "habitation",
  name: "",
  access_point_note: "",
  visibility: "private",
  owner_name: "",
  owner_phone: "",
  consent: false,
};
