import { JSX } from "react/jsx-runtime";
import { tcgHref } from "./affiliate-link-utils";

const AffiliateLinkComponent = ({ name, className, children }: { name?: string; className?: string; children: React.ReactNode }): JSX.Element => {
  return (
    <a className={className} href={tcgHref(name)} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export default AffiliateLinkComponent;