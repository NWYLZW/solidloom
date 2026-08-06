import type {
  NavigationContainerItem,
  NavigationContainerProduct,
} from "../interaction-ui/types";

export interface ContainerProductDefinition {
  id: string;
  name: string;
  unitPrice: number;
}

export function createContainerProductState(
  definitions: ContainerProductDefinition[],
  items: NavigationContainerItem[],
): NavigationContainerProduct[] {
  if (definitions.length === 0) {
    const legacyProducts = new Map<string, NavigationContainerProduct>();
    for (const item of items) {
      const productId = item.productId ?? `legacy-${item.name}`;
      const current = legacyProducts.get(productId);
      if (current) current.stock += 1;
      else legacyProducts.set(productId, {
        id: productId,
        name: item.name,
        stock: 1,
        unitPrice: 0,
      });
    }
    return [...legacyProducts.values()];
  }

  const stockByProductId = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    stockByProductId.set(item.productId, (stockByProductId.get(item.productId) ?? 0) + 1);
  }
  return definitions.map((product) => ({
    ...product,
    stock: stockByProductId.get(product.id) ?? 0,
  }));
}

export function reconcileContainerInventory({
  capacity,
  currentItems,
  requestedProducts,
}: {
  capacity: number;
  currentItems: NavigationContainerItem[];
  requestedProducts: NavigationContainerProduct[];
}) {
  const products: ContainerProductDefinition[] = [];
  const seenProductIds = new Set<string>();
  for (const [index, requested] of requestedProducts.slice(0, 32).entries()) {
    const baseId = requested.id.trim() || `product-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (seenProductIds.has(id)) id = `${baseId}-${suffix++}`;
    seenProductIds.add(id);
    products.push({
      id,
      name: requested.name.trim() || `商品 ${index + 1}`,
      unitPrice: Number.isFinite(requested.unitPrice)
        ? Math.max(0, Math.min(1_000_000_000, requested.unitPrice))
        : 0,
    });
  }

  const currentByProductId = new Map<string, NavigationContainerItem[]>();
  for (const item of currentItems) {
    if (!item.productId) continue;
    const group = currentByProductId.get(item.productId) ?? [];
    group.push(item);
    currentByProductId.set(item.productId, group);
  }

  const usedIds = new Set(currentItems.map((item) => item.id));
  const items: NavigationContainerItem[] = [];
  for (const [index, product] of products.entries()) {
    const requestedStock = Math.max(0, Math.min(
      capacity - items.length,
      Math.round(requestedProducts[index]?.stock ?? 0),
    ));
    const existing = currentByProductId.get(requestedProducts[index]?.id ?? product.id) ?? [];
    for (let itemIndex = 0; itemIndex < requestedStock; itemIndex += 1) {
      const preserved = existing[itemIndex];
      if (preserved) {
        items.push({ ...preserved, name: product.name, productId: product.id });
        continue;
      }
      let sequence = itemIndex + 1;
      let id = `${product.id}-restock-${sequence}`;
      while (usedIds.has(id)) id = `${product.id}-restock-${++sequence}`;
      usedIds.add(id);
      items.push({ id, name: product.name, productId: product.id });
    }
  }

  return { items, products };
}
