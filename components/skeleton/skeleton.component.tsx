import type { CSSProperties } from "react";
import "./skeleton.styles.css";

type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  radius?: string;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
};

const toCssSize = (value?: string | number) =>
  typeof value === "number" ? `${value}px` : value;

const SkeletonComponent = ({
  width,
  height,
  radius,
  circle = false,
  className,
  style,
}: SkeletonProps) => {
  const classes = ["skeleton", circle ? "skeleton--circle" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      aria-hidden="true"
      style={{
        width: toCssSize(width),
        height: toCssSize(height),
        borderRadius: circle ? "var(--radius-full)" : radius,
        ...style,
      }}
    />
  );
};

export default SkeletonComponent;
