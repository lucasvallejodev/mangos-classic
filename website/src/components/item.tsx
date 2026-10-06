import type { ItemView } from "@/lib/details";

export const QUALITY_COLORS = ["#9d9d9d", "#ffffff", "#1eff00", "#0070dd", "#a335ee", "#ff8000", "#e6cc80"];

// Icons are optional files in public/icons (see README). Without them the "?" tile shows through.
export function Icon({ name, size = 36, border }: { name: string | null; size?: number; border?: string }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center border bg-black/50 text-xs text-gray-700"
      style={{ width: size, height: size, borderColor: border ?? "rgba(255,255,255,0.14)", borderWidth: size > 36 ? 2 : 1 }}
    >
      ?
      {name && (
        <span
          className="absolute inset-0 bg-cover"
          style={{ backgroundImage: `url("/icons/${size > 36 ? "large" : "medium"}/${encodeURIComponent(name)}.png")` }}
        />
      )}
    </span>
  );
}

const TOOLTIP_SIDES = {
  right: "left-full top-0 ml-2",
  left: "right-full top-0 mr-2",
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
};

// Shown on hover of the nearest ancestor with class "group relative"
export function ItemTooltip({ item, side = "right" }: { item: ItemView; side?: keyof typeof TOOLTIP_SIDES }) {
  return (
    <span
      className={`pointer-events-none absolute z-30 hidden w-64 flex-col gap-0.5 border border-white/25 bg-[#070a12]/95 p-2.5 text-left text-xs normal-case tracking-normal text-gray-200 shadow-2xl group-hover:flex ${TOOLTIP_SIDES[side]}`}
    >
      <span className="text-sm font-medium" style={{ color: QUALITY_COLORS[item.quality] }}>{item.name}</span>
      {item.lines.map((line, i) => (
        <span key={i} className={line.startsWith('"') ? "text-amber-200/80" : line.startsWith("Enchant") || line.endsWith("(temporary)") ? "text-emerald-300" : ""}>
          {line}
        </span>
      ))}
      {item.itemLevel > 0 && <span className="text-gray-500">Item level {item.itemLevel}</span>}
    </span>
  );
}

// One inventory square: icon, stack count, tooltip on hover
export function ItemSlot({ item, side, size = 56 }: { item: ItemView | null; side?: keyof typeof TOOLTIP_SIDES; size?: number }) {
  if (!item) return <span className="inline-block border-2 border-white/10 bg-black/30" style={{ width: size, height: size }} />;
  return (
    <span className="group relative inline-flex">
      <Icon name={item.icon} size={size} border={QUALITY_COLORS[item.quality]} />
      {item.count > 1 && (
        <span className="absolute bottom-0.5 right-1 text-sm font-semibold text-white [text-shadow:0_0_3px_#000,0_0_3px_#000]">{item.count}</span>
      )}
      <ItemTooltip item={item} side={side} />
    </span>
  );
}
