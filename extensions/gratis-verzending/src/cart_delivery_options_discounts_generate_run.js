// Gratis verzending voor de hele bestelling (NL/BE) zodra er minstens één
// product met de tag "gratis-verzending" in de winkelwagen zit.
// Duitsland, speciale bezorging (Alu-RIB op afspraak) en pakketten met een
// zwaar product (tag "zwaar-pakket") blijven betaald.

const LANDEN = ["NL", "BE"];
const UITGESLOTEN = /rib/i; // "Speciale RIB-bezorging op afspraak"

export function cartDeliveryOptionsDiscountsGenerateRun(input) {
  if (!input.discount.discountClasses.includes("SHIPPING")) {
    return { operations: [] };
  }

  const heeftGratisProduct = input.cart.lines.some(
    (line) =>
      line.merchandise.__typename === "ProductVariant" &&
      line.merchandise.product.hasAnyTag,
  );
  if (!heeftGratisProduct) return { operations: [] };

  const candidates = [];
  for (const group of input.cart.deliveryGroups) {
    const land = group.deliveryAddress?.countryCode;
    if (!land || !LANDEN.includes(land)) continue;
    // Pakket met een zwaar product (tag "zwaar-pakket") nooit gratis.
    const zwaar = (group.cartLines ?? []).some(
      (l) => l.merchandise.__typename === "ProductVariant" && l.merchandise.product.zwaar,
    );
    if (zwaar) continue;
    for (const option of group.deliveryOptions) {
      if (UITGESLOTEN.test(option.title ?? "")) continue;
      candidates.push({
        message: "Gratis verzending",
        targets: [{ deliveryOption: { handle: option.handle } }],
        value: { percentage: { value: 100 } },
      });
    }
  }

  if (!candidates.length) return { operations: [] };
  return {
    operations: [
      { deliveryDiscountsAdd: { candidates, selectionStrategy: "ALL" } },
    ],
  };
}
