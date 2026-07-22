

export default function SpiralLoader({ 
  color = "#056daa", 
}) {
  return (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: color, borderTopColor: "transparent" }} />
        </div>
  );
}