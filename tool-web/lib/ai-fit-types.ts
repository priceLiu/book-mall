/** mock/models.json 形状 */
export type AiFitModelRecord = {
  id: string;
  name: string;
  style: string;
  gender?: string;
  height: string;
  weight: string;
  body: string;
  bust?: string;
  waist?: string;
  hips?: string;
  image: string;
  selected?: boolean;
  isCustom?: boolean;
};
