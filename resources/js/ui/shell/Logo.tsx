import { BrandIcon } from '../brand/BrandIcon'

/** The app icon where the chrome needs it (24–63 px: the flat icon from the brand masters). */
export function LogoTile({ size = 28 }: { size?: number }) {
  return <BrandIcon size={size} />
}
