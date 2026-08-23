import React from "react";

function SkeletonBlock({ className, style }) {
  return (
    <div
      className={`animate-pulse ${className || ""}`}
      style={Object.assign({ backgroundColor: "rgba(5,109,170,0.08)" }, style)}
    />
  );
}

/**
 * Mirrors the real ProjectDetailPage layout (title block + illustration +
 * three stat cards) so nothing visibly jumps in size or position once the
 * actual project data replaces it.
 */
export default function DcsProjectDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto pb-16" aria-hidden="true">
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-10 items-center mb-8">
        <div className="flex flex-col gap-3">
          <SkeletonBlock className="h-6 w-40" />
          <SkeletonBlock className="h-9 w-3/4" />
          <SkeletonBlock className="lg:hidden w-full" style={{ minHeight: 180 }} />
          <div className="flex flex-col gap-2 mt-1">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-2/3" />
          </div>
          <SkeletonBlock className="h-3 w-56 mt-1" />
        </div>
        <SkeletonBlock className="hidden lg:block w-full" style={{ minHeight: 260 }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((index) => (
          <SkeletonBlock key={index} className="w-full" style={{ minHeight: 128 }} />
        ))}
      </div>
    </div>
  );
}
