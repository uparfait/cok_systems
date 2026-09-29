/**
 * HOW MUCH OF A ROW each widget claims, and therefore how many of them a
 * row holds.
 *
 * A widget's size is a SHARE OF A ROW, not a fixed width. Whatever still
 * fits beside it shares the row, and whatever a row ends up holding widens
 * evenly to fill it, so no gap is ever left at the end - a row of ten
 * very small cards where twelve would fit is ten slightly wider cards, not
 * ten cards and a hole. A widget only starts a new row when it genuinely
 * does not fit in what is left of the current one, which is why two cards
 * and a chart can share one row while eleven cards and a chart cannot.
 *
 * A CHART is a drawing and needs room: a third of a row (small), a half
 * (medium) or the whole of it (large). A KPI CARD is one number and needs
 * far less, so it has a step below small and a wide screen holds:
 *
 *   very small  12 per row      medium   4 per row
 *   small        6 per row      large    3 per row
 *
 * Narrow screens hold fewer of each - twelve cards across a phone would
 * be twelve columns of nothing - and the card's own contents scale to
 * whatever width it ends up with (see kpi_density in charts/density.js),
 * so a card made very small stays readable instead of spilling out.
 *
 * The classes are written out in full because Tailwind reads them from
 * the source; each basis subtracts its share of the 0.75rem gaps so the
 * intended count really fits.
 */

export const KPI_SIZES = ["xs", "small", "medium", "large"];
export const CHART_SIZES = ["small", "medium", "large"];

export const KPI_PER_ROW = { xs: 12, small: 6, medium: 4, large: 3 };
export const CHART_PER_ROW = { xs: 3, small: 3, medium: 2, large: 1, full: 1 };

const KPI_CLASSES = {
  xs: "grow basis-[calc(33.333%-0.75rem)] sm:basis-[calc(16.666%-0.75rem)] lg:basis-[calc(8.333%-0.75rem)]",
  small: "grow basis-[calc(50%-0.75rem)] sm:basis-[calc(25%-0.75rem)] lg:basis-[calc(16.666%-0.75rem)]",
  medium: "grow basis-[calc(50%-0.75rem)] sm:basis-[calc(33.333%-0.75rem)] lg:basis-[calc(25%-0.75rem)]",
  large: "grow basis-full sm:basis-[calc(50%-0.75rem)] lg:basis-[calc(33.333%-0.75rem)]",
};

const CHART_CLASSES = {
  xs: "grow basis-full sm:basis-[calc(50%-0.75rem)] lg:basis-[calc(33.333%-0.75rem)]",
  small: "grow basis-full sm:basis-[calc(50%-0.75rem)] lg:basis-[calc(33.333%-0.75rem)]",
  medium: "grow basis-full sm:basis-[calc(50%-0.75rem)]",
  large: "grow basis-full",
  full: "grow basis-full",
};

export const is_kpi_widget = (widget) => !!widget && widget.chart_type === "kpi";


/** The sizes this widget may be given, in order. */
export const sizes_for = (widget) => (is_kpi_widget(widget) ? KPI_SIZES : CHART_SIZES);

/** How many widgets of this size a wide row holds. */
export function per_row(widget, size) {
  const held = size || (widget && widget.size) || "medium";
  return is_kpi_widget(widget) ? KPI_PER_ROW[held] || KPI_PER_ROW.medium : CHART_PER_ROW[held] || CHART_PER_ROW.medium;
}

/**
 * The share of a row this widget claims. `whole` is for the one case where
 * size gives way: a board holding a single chart gives it the whole row,
 * because one small drawing floating in empty space reads as broken.
 */
export function row_class(widget, whole) {
  if (whole) return CHART_CLASSES.full;
  const size = (widget && widget.size) || "medium";
  if (is_kpi_widget(widget)) return KPI_CLASSES[size] || KPI_CLASSES.small;
  return CHART_CLASSES[size] || CHART_CLASSES.medium;
}
