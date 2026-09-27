import type { DimensionView } from "../model";

const AXES: { id: DimensionView["id"]; angle: number }[] = [
  { id: "F", angle: -90 },
  { id: "R", angle: 0 },
  { id: "E", angle: 90 },
  { id: "M", angle: 180 },
];

export function RadarChart({
  dimensions,
  large = false,
}: {
  dimensions: { id: DimensionView["id"]; name: string; score: number | null }[];
  large?: boolean;
}) {
  const size = 320;
  const center = size / 2;
  const radius = 112;
  const byId = Object.fromEntries(dimensions.map((item) => [item.id, item])) as Record<
    string,
    { name: string; score: number | null }
  >;

  const ring = (level: number) =>
    AXES.map((axis) => xy(axis.angle, radius * level, center)).join(" ");

  const valuePoints = AXES.map((axis) => {
    const score = byId[axis.id]?.score ?? 0;
    return xy(axis.angle, radius * (Math.max(0, score) / 100), center);
  }).join(" ");

  return (
    <figure className={large ? "radar-layout large" : "radar-layout"}>
      <AxisLabel area="top" item={byId.F} />
      <AxisLabel area="left" item={byId.M} />
      <svg viewBox={`0 0 ${size} ${size}`} className="radar-svg" role="img" aria-label="四维雷达图">
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <polygon key={level} points={ring(level)} fill="none" stroke="#e5d9cc" strokeWidth="1" />
        ))}
        {AXES.map((axis) => {
          const [x, y] = xy(axis.angle, radius, center).split(" ").map(Number);
          return (
            <line key={axis.id} x1={center} y1={center} x2={x} y2={y} stroke="#d9cbbd" strokeWidth="1" />
          );
        })}
        <polygon points={valuePoints} fill="rgba(141, 70, 54, 0.22)" stroke="#8d4636" strokeWidth="2" />
        {AXES.map((axis) => {
          const score = byId[axis.id]?.score ?? 0;
          const [x, y] = xy(axis.angle, radius * (Math.max(0, score) / 100), center)
            .split(" ")
            .map(Number);
          return <circle key={axis.id} cx={x} cy={y} r="4.5" fill="#8d4636" />;
        })}
      </svg>
      <AxisLabel area="right" item={byId.R} />
      <AxisLabel area="bottom" item={byId.E} />
    </figure>
  );
}

function AxisLabel({
  area,
  item,
}: {
  area: "top" | "right" | "bottom" | "left";
  item?: { name: string; score: number | null };
}) {
  return (
    <div className={`radar-label ${area}`}>
      <span>{item?.name}</span>
      <strong>{item?.score ?? "暂无"}</strong>
    </div>
  );
}

function xy(angle: number, distance: number, center: number): string {
  const rad = (angle * Math.PI) / 180;
  const x = center + Math.cos(rad) * distance;
  const y = center + Math.sin(rad) * distance;
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}
