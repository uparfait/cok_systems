export default function DotSpinner({
  color = "#25b09b",
  size = 22,
}) {

  return (
    <>
      <style>
        {`
          @keyframes dot-spinner-rotate {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>

      <div
        className="animate-[dot-spinner-rotate_1s_steps(8)_infinite]"
        style={{
          width: "4px",
          height: "4px",
          borderRadius: "9999px",
          color,
          boxShadow: `
            ${1 * size}px ${0 * size}px 0 0 currentColor,
            ${0.707 * size}px ${0.707 * size}px 0 1px currentColor,
            ${0 * size}px ${1 * size}px 0 2px currentColor,
            ${-0.707 * size}px ${0.707 * size}px 0 3px currentColor,
            ${-1 * size}px ${0 * size}px 0 4px currentColor,
            ${-0.707 * size}px ${-0.707 * size}px 0 5px currentColor,
            ${0 * size}px ${-1 * size}px 0 6px currentColor
          `,
        }}
      />
    </>
  );
}