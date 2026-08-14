export type EcomModelGender = "female" | "male" | "plus_female";
export type EcomModelAge = "adult" | "child";

export type EcomModelLibraryEntry = {
  id: string;
  name: string;
  gender: EcomModelGender;
  age: EcomModelAge;
  ossUrl: string;
};

export type EcomModelLibraryCatalog = {
  models: EcomModelLibraryEntry[];
};

export const ECOM_MODEL_GENDER_LABEL: Record<EcomModelGender, string> = {
  female: "女",
  male: "男",
  plus_female: "大码女",
};

export const ECOM_MODEL_AGE_LABEL: Record<EcomModelAge, string> = {
  adult: "成人",
  child: "儿童",
};
