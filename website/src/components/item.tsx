import type { ItemView } from "@/lib/details";

export const QUALITY_COLORS = ["#9d9d9d", "#ffffff", "#1eff00", "#0070dd", "#a335ee", "#ff8000", "#e6cc80"];

// Icons are optional files in public/icons (see README). Without them the "?" tile shows through.
export function Icon({ name, size = 36, border }: { name: string | null; size?: number; border?: string }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded border bg-black/40 text-xs text-gray-600"
      style={{ width: size, height: size, borderColor: border ?? "rgba(255,255,255,0.15)" }}
    >
      ?
      {name && (
        <span
          className="absolute inset-0 rounded-[3px] bg-cover"
          style={{ backgroundImage: `url("/icons/${size > 36 ? "large" : "medium"}/${encodeURIComponent(name)}.png")` }}
        />
      )}
    </span>
  );
}

export function ItemTooltip({ item }: { item: ItemView }) {
  return (
    <span className="pointer-events-none absolute left-full top-0 z-20 ml-2 hidden w-64 flex-col gap-0.5 rounded-md border border-white/20 bg-[#0b0d12] p-2.5 text-left text-xs text-gray-200 shadow-xl group-hover:flex">
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
export function ItemSlot({ item }: { item: ItemView | null }) {
  if (!item) return <span className="inline-block h-9 w-9 rounded border border-white/10 bg-black/20" />;
  return (
    <span className="group relative inline-flex">
      <Icon name={item.icon} border={QUALITY_COLORS[item.quality]} />
      {item.count > 1 && (
        <span className="absolute bottom-0 right-0.5 text-[11px] font-semibold text-white [text-shadow:0_0_3px_#000,0_0_3px_#000]">{item.count}</span>
      )}
      <ItemTooltip item={item} />
    </span>
  );
}
