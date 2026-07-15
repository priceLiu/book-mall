import { CharactersClient } from "./characters-client";

export const metadata = {
  title: "角色库 · canvas-web",
  description: "三视图角色入库，可在画布快速插入。",
};

export default function CharactersPage() {
  return <CharactersClient />;
}
