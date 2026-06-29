export default function SpiralLoader({ 
  width = "4px", 
  height = "4px", 
  color = "#155dfc", 
  className = "" 
}) {
  return (
    <>
      <style>
        {`
          @keyframes l27 {
            100% { transform: rotate(1turn); }
          }
          .custom-spiral-loader {
            --d: 22px;
            border-radius: 50%;
            animation: l27 1s infinite steps(8);
          }
        `}
      </style>
      <div
        className={`custom-spiral-loader ${className}`}
        style={{
          width,
          height,
          color,
          boxShadow: `
            calc(1 * var(--d)) calc(0 * var(--d)) 0 0,
            calc(0.707 * var(--d)) calc(0.707 * var(--d)) 0 1px,
            calc(0 * var(--d)) calc(1 * var(--d)) 0 2px,
            calc(-0.707 * var(--d)) calc(0.707 * var(--d)) 0 3px,
            calc(-1 * var(--d)) calc(0 * var(--d)) 0 4px,
            calc(-0.707 * var(--d)) calc(-0.707 * var(--d)) 0 5px,
            calc(0 * var(--d)) calc(-1 * var(--d)) 0 6px
          `,
        }}
      />
    </>
  );
}