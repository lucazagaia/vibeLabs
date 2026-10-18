"use client";

import { createIdListStore } from "./idListStore";

const store = createIdListStore("vibelabs-favourites");

export function useFavourites() {
  const favourites = store.useList();
  const { toggle } = store.useActions();
  return { favourites, toggleFavourite: toggle };
}
