export type WishlistFlySource = {
  x: number;
  y: number;
  width: number;
  height: number;
  imageUri: string;
};

type WishlistFlyEvent = WishlistFlySource;

type Point = { x: number; y: number };

let wishlistTarget: Point | null = null;
const listeners = new Set<(event: WishlistFlyEvent) => void>();

export function setWishlistFlyTarget(point: Point | null) {
  wishlistTarget = point;
}

export function getWishlistFlyTarget() {
  return wishlistTarget;
}

export function subscribeWishlistFly(
  listener: (event: WishlistFlyEvent) => void,
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitWishlistFly(event: WishlistFlyEvent) {
  if (!wishlistTarget || !event.imageUri) return;
  listeners.forEach((listener) => listener(event));
}
