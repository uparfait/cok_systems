

export default function SpiralLoader({
  color = "#056daa",
  padded = true,
  size = 24,
}) {
  return (
        <div className={`flex items-center justify-center ${padded ? "py-8" : ""}`}>
          <div className="border-2 border-t-transparent rounded-full animate-spin shrink-0" style={{ width: size, height: size, borderColor: color, borderTopColor: "transparent" }} />
        </div>
  );
}
