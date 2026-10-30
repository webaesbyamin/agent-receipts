// Regenerates the favicon set from assets/mark.svg:  node scripts/icons.mjs
//   src/app/icon.svg          the mark itself (browsers use it at any size)
//   src/app/favicon.ico       16, 32 and 48 px PNGs in one .ico
//   src/app/apple-icon.png    180 px, opaque (iOS rounds the corners itself)
//   public/icon-192.png, public/icon-512.png   for manifest.webmanifest
// verify.webaes.com and the hosted demo use the same files.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'assets', 'mark.svg'), 'utf-8')
const png = (source, size) => Buffer.from(new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng())

/** An .ico holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt16LE(1, e + 4) // colour planes
    header.writeUInt16LE(32, e + 6) // bits per pixel
    header.writeUInt32LE(data.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...images.map((i) => i.data)])
}

// Apple touch icons must be opaque: square corners, iOS applies its own mask
const opaque = svg.replace('rx="14"', 'rx="0"')

copyFileSync(join(root, 'assets', 'mark.svg'), join(root, 'src', 'app', 'icon.svg'))
writeFileSync(join(root, 'src', 'app', 'favicon.ico'), ico([16, 32, 48].map((size) => ({ size, data: png(svg, size) }))))
writeFileSync(join(root, 'src', 'app', 'apple-icon.png'), png(opaque, 180))
writeFileSync(join(root, 'public', 'icon-192.png'), png(svg, 192))
writeFileSync(join(root, 'public', 'icon-512.png'), png(svg, 512))
console.log('icons: icon.svg, favicon.ico (16/32/48), apple-icon.png (180), icon-192.png, icon-512.png')
