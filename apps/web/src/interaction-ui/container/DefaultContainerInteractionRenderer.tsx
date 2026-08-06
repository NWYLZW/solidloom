import {
  Box,
  Boxes,
  PackagePlus,
  Save,
  Settings2,
  ShoppingBag,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  ContainerInteractionRendererProps,
  NavigationContainerProduct,
} from "../types";
import { useInteractionDialogKeyboard } from "../dialog/useInteractionDialogKeyboard";
import "./DefaultContainerInteractionRenderer.css";

function formatPrice(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function cloneProducts(products: NavigationContainerProduct[]) {
  return products.map((product) => ({ ...product }));
}

export function DefaultContainerInteractionRenderer({
  controller,
  presentation,
}: ContainerInteractionRendererProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const { close, configure, empty, labels, state, take } = controller;
  const [view, setView] = useState<"items" | "settings">("items");
  const [draftTitle, setDraftTitle] = useState(state.title);
  const [draftProducts, setDraftProducts] = useState(() => cloneProducts(state.products));
  const firstAvailableProduct = state.products.find((product) => product.stock > 0);
  const [selectedProductId, setSelectedProductId] = useState(firstAvailableProduct?.id ?? "");
  const selectedProduct = state.products.find((product) => product.id === selectedProductId);
  const availableProductIds = useMemo(() => (
    state.products.filter((product) => product.stock > 0).map((product) => product.id)
  ), [state.products]);

  useEffect(() => {
    setDraftTitle(state.title);
    setDraftProducts(cloneProducts(state.products));
  }, [state.products, state.title]);

  useEffect(() => {
    if (selectedProduct?.stock) return;
    setSelectedProductId(firstAvailableProduct?.id ?? "");
  }, [firstAvailableProduct?.id, selectedProduct?.stock]);

  const moveSelection = useCallback((direction: -1 | 1) => {
    if (availableProductIds.length === 0) return;
    const currentIndex = availableProductIds.indexOf(selectedProductId);
    const nextIndex = currentIndex === -1
      ? (direction === 1 ? 0 : availableProductIds.length - 1)
      : (currentIndex + direction + availableProductIds.length) % availableProductIds.length;
    setSelectedProductId(availableProductIds[nextIndex] ?? "");
  }, [availableProductIds, selectedProductId]);

  const selectBoundary = useCallback((boundary: "first" | "last") => {
    const nextId = boundary === "first"
      ? availableProductIds[0]
      : availableProductIds[availableProductIds.length - 1];
    setSelectedProductId(nextId ?? "");
  }, [availableProductIds]);

  const takeSelectedProduct = useCallback(() => {
    if (selectedProduct && selectedProduct.stock > 0) take(selectedProduct.id);
  }, [selectedProduct, take]);

  const modalPresentation = presentation === "modal" || presentation === "sheet";
  useInteractionDialogKeyboard({
    dialogRef: panelRef,
    enabled: modalPresentation,
    onClose: close,
    onMoveSelection: view === "items" ? moveSelection : undefined,
    onPrimaryAction: view === "items" ? takeSelectedProduct : undefined,
    onSelectBoundary: view === "items" ? selectBoundary : undefined,
  });

  const submitConfiguration = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    configure({ products: draftProducts, title: draftTitle });
  };

  const updateProduct = (
    productId: string,
    field: "name" | "stock" | "unitPrice",
    value: string | number,
  ) => {
    setDraftProducts((products) => products.map((product) => (
      product.id === productId ? { ...product, [field]: value } : product
    )));
  };

  const addProduct = () => {
    const id = `product-${Date.now().toString(36)}`;
    setDraftProducts((products) => [
      ...products,
      { id, name: labels.containerProduct, stock: 0, unitPrice: 0 },
    ]);
  };

  return (
    <>
      <div className="interaction-container-backdrop" aria-hidden="true" />
      <section
        aria-labelledby={titleId}
        aria-modal={modalPresentation ? true : undefined}
        className="interaction-container-panel"
        data-container-view={view}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="interaction-container-header">
          <span className="interaction-container-kind-icon" aria-hidden="true">
            <Box size={17} />
          </span>
          <div className="interaction-container-heading-copy">
            <strong id={titleId}>{state.title}</strong>
            <span>{labels.containerProducts} · {state.products.length}</span>
          </div>
          {state.canConfigure && (
            <button
              aria-label={view === "settings" ? labels.containerItemsView : labels.containerConfigure}
              aria-pressed={view === "settings"}
              className="interaction-container-configure"
              title={view === "settings" ? labels.containerItemsView : labels.containerConfigure}
              type="button"
              onClick={() => setView((current) => current === "settings" ? "items" : "settings")}
            >
              {view === "settings"
                ? <Boxes aria-hidden="true" size={16} />
                : <Settings2 aria-hidden="true" size={16} />}
            </button>
          )}
          <button
            aria-label={labels.containerClose}
            aria-keyshortcuts="Escape"
            className="interaction-container-close"
            type="button"
            onClick={close}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        {view === "items" ? (
          <div className="interaction-container-body">
            <div
              aria-label={empty ? labels.containerEmpty : labels.containerContents}
              aria-keyshortcuts="ArrowUp ArrowDown Home End"
              className="interaction-container-products"
              role="listbox"
            >
              {state.products.map((product) => (
                <button
                  aria-selected={selectedProductId === product.id}
                  className="interaction-container-product"
                  data-dialog-initial-focus={selectedProductId === product.id && product.stock > 0}
                  data-dialog-selection
                  data-selected={selectedProductId === product.id}
                  disabled={product.stock <= 0}
                  key={product.id}
                  role="option"
                  type="button"
                  onClick={() => setSelectedProductId(product.id)}
                >
                  <span className="interaction-container-product-icon" aria-hidden="true">
                    <Box size={15} />
                  </span>
                  <span className="interaction-container-product-copy">
                    <strong>{product.name}</strong>
                    <span>{formatPrice(product.unitPrice, state.currency)}</span>
                  </span>
                  <span className="interaction-container-product-stock">
                    {product.stock > 0
                      ? `${labels.containerStock} ${product.stock}`
                      : labels.containerUnavailable}
                  </span>
                </button>
              ))}
              {state.products.length === 0 && (
                <div className="interaction-container-empty">{labels.containerEmpty}</div>
              )}
            </div>
          </div>
        ) : (
          <form className="interaction-container-settings" onSubmit={submitConfiguration}>
            <div className="interaction-container-access">
              <ShieldCheck aria-hidden="true" size={16} />
              <span>{labels.containerConfigureGranted}</span>
            </div>
            <label>
              <span>{labels.containerName}</span>
              <input
                maxLength={120}
                required
                type="text"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
            </label>
            <div className="interaction-container-catalog-heading">
              <span>{labels.containerProducts}</span>
              <button type="button" onClick={addProduct}>
                <PackagePlus aria-hidden="true" size={15} />
                <span>{labels.containerAddProduct}</span>
              </button>
            </div>
            <div className="interaction-container-catalog">
              {draftProducts.map((product) => (
                <div className="interaction-container-product-editor" key={product.id}>
                  <label className="interaction-container-product-name">
                    <span>{labels.containerProduct}</span>
                    <input
                      maxLength={120}
                      required
                      type="text"
                      value={product.name}
                      onChange={(event) => updateProduct(product.id, "name", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{labels.containerPrice}</span>
                    <input
                      min={0}
                      required
                      step="0.01"
                      type="number"
                      value={product.unitPrice}
                      onChange={(event) => updateProduct(product.id, "unitPrice", Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>{labels.containerStock}</span>
                    <input
                      max={128}
                      min={0}
                      required
                      type="number"
                      value={product.stock}
                      onChange={(event) => updateProduct(product.id, "stock", Number(event.target.value))}
                    />
                  </label>
                  <button
                    aria-label={`${labels.containerDeleteProduct} ${product.name}`}
                    className="interaction-container-delete-product"
                    title={labels.containerDeleteProduct}
                    type="button"
                    onClick={() => setDraftProducts((products) => (
                      products.filter((candidate) => candidate.id !== product.id)
                    ))}
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button className="interaction-container-apply" type="submit">
              <Save aria-hidden="true" size={15} />
              <span>{labels.containerConfigureApply}</span>
            </button>
          </form>
        )}

        {view === "items" && (
          <footer className="interaction-container-footer">
            <button
              aria-label={labels.containerTakeSelected}
              aria-keyshortcuts="Enter"
              className="interaction-container-take"
              data-dialog-primary-action
              disabled={!selectedProduct || selectedProduct.stock <= 0}
              title={labels.containerTakeSelected}
              type="button"
              onClick={takeSelectedProduct}
            >
              <ShoppingBag aria-hidden="true" size={15} />
              <span>{labels.containerTakeSelected}</span>
            </button>
          </footer>
        )}
      </section>
    </>
  );
}
