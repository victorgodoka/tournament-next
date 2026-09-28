import Image, { type ImageProps } from "next/image";
import { twJoin, twMerge } from "tailwind-merge";

interface LogoProps {
  width?: string
  height?: string
  dual?: boolean
  variant?: "cyan" | "gold" | "bw"
}

interface FullLogoProps extends LogoProps {
  type: 'default' | 'shadow' | 'box'
}

const fillColors = {
  cyan: ['#00fdff', '#4a6fd8'],
  gold: ['', ''],
  bw: ['#eef1f8', '#080a14'],
}

const LogoDefault = ({ width = "200", height = "200", variant = "cyan", dual }: LogoProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width={width} height={height} fill="none" role="img" aria-label="Omega mark">
    <defs>
      <clipPath id="ol"><rect x="-40" y="-40" width="137.4" height="300" /></clipPath>
      <clipPath id="orr"><rect x="102.6" y="-40" width="300" height="300" /></clipPath>
    </defs>
    <g transform="translate(10.975,8.89) scale(0.8903)">
      <g clip-path="url(#ol)">
        <path fillRule="evenodd" fill={fillColors[variant][0]} d="M 68.27 171.26 A 78.0 78.0 0 0 1 23.57 115.55 L -1.0 100.0 L 23.57 84.45 A 78.0 78.0 0 0 1 84.45 23.57 L 100.0 -1.0 L 115.55 23.57 A 78.0 78.0 0 0 1 176.43 84.45 L 201.0 100.0 L 176.43 115.55 A 78.0 78.0 0 0 1 131.73 171.26 L 116.74 205.68 L 118.71 142.02 A 46.0 46.0 0 1 0 81.29 142.02 L 83.26 205.68 Z M 74.99 156.18 A 61.5 61.5 0 1 1 125.01 156.18 L 123.59 152.99 A 58.0 58.0 0 1 0 76.41 152.99 Z" /></g>
      <g clip-path="url(#orr)">
        <path fillRule="evenodd" fill={twJoin(dual ? fillColors[variant][1] : fillColors[variant][0])} d="M 68.27 171.26 A 78.0 78.0 0 0 1 23.57 115.55 L -1.0 100.0 L 23.57 84.45 A 78.0 78.0 0 0 1 84.45 23.57 L 100.0 -1.0 L 115.55 23.57 A 78.0 78.0 0 0 1 176.43 84.45 L 201.0 100.0 L 176.43 115.55 A 78.0 78.0 0 0 1 131.73 171.26 L 116.74 205.68 L 118.71 142.02 A 46.0 46.0 0 1 0 81.29 142.02 L 83.26 205.68 Z M 74.99 156.18 A 61.5 61.5 0 1 1 125.01 156.18 L 123.59 152.99 A 58.0 58.0 0 1 0 76.41 152.99 Z" /></g>
    </g>
  </svg>
)

const LogoWithShadow = ({ width = "200", height = "200", variant = "cyan" }: LogoProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 200"
    width={width}
    height={height}
    fill="none"
    role="img"
    aria-label="Omega mark"
  >
    <g transform="translate(10.799,8.838) scale(0.8376)">
      <path
        d="M 68.27 171.26 A 78.0 78.0 0 0 1 23.57 115.55 L -1.0 100.0 L 23.57 84.45 A 78.0 78.0 0 0 1 84.45 23.57 L 100.0 -1.0 L 115.55 23.57 A 78.0 78.0 0 0 1 176.43 84.45 L 201.0 100.0 L 176.43 115.55 A 78.0 78.0 0 0 1 131.73 171.26 L 116.74 205.68 L 118.71 142.02 A 46.0 46.0 0 1 0 81.29 142.02 L 83.26 205.68 Z"
        fill={fillColors[variant][0]}
        transform="translate(13.0,13.0)"
      />
      <path
        fillRule="evenodd"
        fill={fillColors[variant][1]}
        d="M 68.27 171.26 A 78.0 78.0 0 0 1 23.57 115.55 L -1.0 100.0 L 23.57 84.45 A 78.0 78.0 0 0 1 84.45 23.57 L 100.0 -1.0 L 115.55 23.57 A 78.0 78.0 0 0 1 176.43 84.45 L 201.0 100.0 L 176.43 115.55 A 78.0 78.0 0 0 1 131.73 171.26 L 116.74 205.68 L 118.71 142.02 A 46.0 46.0 0 1 0 81.29 142.02 L 83.26 205.68 Z M 74.99 156.18 A 61.5 61.5 0 1 1 125.01 156.18 L 123.59 152.99 A 58.0 58.0 0 1 0 76.41 152.99 Z"
      />
    </g>
  </svg>
);

const LogoBox = ({ width = "200", height = "200", variant = "cyan" }: LogoProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width={width} height={height} fill="none" role="img" aria-label="Omega mark">
    <g transform="translate(8.0,8.0) scale(0.9735)">
      <path d="M 13.0 13.0 H 189.0 V 189.0 H 13.0 Z" fill={fillColors[variant][1]} />
      <mask id="mk" maskUnits="userSpaceOnUse" x="0" y="0" width="176.0" height="176.0">
        <path d="M 0 0 H 176.0 V 176.0 H 0 Z" fill="#ffffff" />
        <g transform="translate(18.328,16.697) scale(0.6967)" fill="#000000" fillRule="evenodd">
          <path d="M 68.27 171.26 A 78.0 78.0 0 0 1 23.57 115.55 L -1.0 100.0 L 23.57 84.45 A 78.0 78.0 0 0 1 84.45 23.57 L 100.0 -1.0 L 115.55 23.57 A 78.0 78.0 0 0 1 176.43 84.45 L 201.0 100.0 L 176.43 115.55 A 78.0 78.0 0 0 1 131.73 171.26 L 116.74 205.68 L 118.71 142.02 A 46.0 46.0 0 1 0 81.29 142.02 L 83.26 205.68 Z M 74.99 156.18 A 61.5 61.5 0 1 1 125.01 156.18 L 123.59 152.99 A 58.0 58.0 0 1 0 76.41 152.99 Z" />
        </g>
      </mask>
      <path d="M 0 0 H 176.0 V 176.0 H 0 Z" fill={fillColors[variant][0]} mask="url(#mk)" /></g>
  </svg>
)

const Logo = (props: FullLogoProps) => {
  switch (props.type) {
    case 'shadow':
      return <LogoWithShadow {...props} />
    case 'box':
      return <LogoBox {...props} />
    default:
      return <LogoDefault {...props} />
  }
}

export default Logo;
